/**
 * Platform fee configuration.
 *
 * Progressive tiers (feature-flagged via PROGRESSIVE_PLATFORM_FEES=true):
 *   - 9 % on the first ₪15 000 of monthly Studioz booking revenue
 *   - 7 % on ₪15 001 – ₪40 000
 *   - 5 % on everything above ₪40 000
 *
 * Default (flag off): flat 9 % on all qualifying volume.
 *
 * `maxAmount: null` means "no upper limit" (the final bracket).
 */

export interface FeeTier {
  /** Upper boundary of this bracket (ILS). `null` = unlimited. */
  maxAmount: number | null;
  /** Fee rate as a decimal (0.09 = 9 %). */
  rate: number;
  /** Human-readable label for API / UI. */
  label: string;
}

/** Flat platform fee rate when progressive tiers are disabled. */
export const PLATFORM_FEE_FLAT_RATE = 0.09;
export const PLATFORM_FEE_FLAT_LABEL = '9%';

/**
 * Progressive fee tiers. Only used when `isProgressivePlatformFeesEnabled()` is true.
 */
export const PLATFORM_FEE_TIERS: FeeTier[] = [
  { maxAmount: 15_000, rate: 0.09, label: '9%' },
  { maxAmount: 40_000, rate: 0.07, label: '7%' },
  { maxAmount: null, rate: 0.05, label: '5%' },
];

/**
 * Backend feature flag for progressive / marginal platform fees.
 * Default OFF → flat 9%. Enable with PROGRESSIVE_PLATFORM_FEES=true.
 */
export function isProgressivePlatformFeesEnabled(): boolean {
  const raw = process.env.PROGRESSIVE_PLATFORM_FEES;
  if (raw == null || raw === '') return false;
  return raw === 'true' || raw === '1' || raw.toLowerCase() === 'yes';
}

export type PlatformFeeModel = 'flat' | 'tiered';

export function getActiveFeeModel(): PlatformFeeModel {
  return isProgressivePlatformFeesEnabled() ? 'tiered' : 'flat';
}

export interface TierBreakdownItem {
  tierIndex: number;
  label: string;
  rate: number;
  amountInBand: number;
  feeAmount: number;
}

export interface TierCalculationResult {
  totalFeeAmount: number;
  effectiveRate: number;
  tierIndex: number;
  tierLabel: string;
  breakdown: TierBreakdownItem[];
  feeModel: PlatformFeeModel;
}

/**
 * Flat 9% fee on the full volume.
 */
export function calculateFlatFee(monthlyRevenue: number): TierCalculationResult {
  const amount = Math.max(0, monthlyRevenue);
  const totalFeeAmount = parseFloat((amount * PLATFORM_FEE_FLAT_RATE).toFixed(2));

  return {
    totalFeeAmount,
    effectiveRate: PLATFORM_FEE_FLAT_RATE,
    tierIndex: 0,
    tierLabel: PLATFORM_FEE_FLAT_LABEL,
    breakdown: amount > 0
      ? [
          {
            tierIndex: 0,
            label: PLATFORM_FEE_FLAT_LABEL,
            rate: PLATFORM_FEE_FLAT_RATE,
            amountInBand: amount,
            feeAmount: totalFeeAmount,
          },
        ]
      : [],
    feeModel: 'flat',
  };
}

/**
 * Calculate the platform fee using marginal / bracket tiers.
 *
 * @param monthlyRevenue  Total qualifying transaction volume (ILS) for the period.
 * @param tiers           Tier config (defaults to PLATFORM_FEE_TIERS).
 * @returns               Total fee, effective rate, current tier, and per-bracket breakdown.
 */
export function calculateTieredFee(
  monthlyRevenue: number,
  tiers: FeeTier[] = PLATFORM_FEE_TIERS
): TierCalculationResult {
  let remaining = monthlyRevenue;
  let previousMax = 0;
  let totalFee = 0;
  let currentTierIndex = 0;
  const breakdown: TierBreakdownItem[] = [];

  for (let i = 0; i < tiers.length; i++) {
    if (remaining <= 0) break;

    const tier = tiers[i];
    const bandCeiling = tier.maxAmount !== null ? tier.maxAmount - previousMax : remaining;
    const amountInBand = Math.min(remaining, bandCeiling);
    const feeForBand = parseFloat((amountInBand * tier.rate).toFixed(2));

    breakdown.push({
      tierIndex: i,
      label: tier.label,
      rate: tier.rate,
      amountInBand,
      feeAmount: feeForBand,
    });

    totalFee += feeForBand;
    remaining -= amountInBand;
    previousMax = tier.maxAmount ?? previousMax;

    if (amountInBand > 0) {
      currentTierIndex = i;
    }
  }

  totalFee = parseFloat(totalFee.toFixed(2));
  const effectiveRate = monthlyRevenue > 0 ? totalFee / monthlyRevenue : tiers[0].rate;

  return {
    totalFeeAmount: totalFee,
    effectiveRate: parseFloat(effectiveRate.toFixed(4)),
    tierIndex: currentTierIndex,
    tierLabel: tiers[currentTierIndex].label,
    breakdown,
    feeModel: 'tiered',
  };
}

/**
 * Active fee calculator — flat 9% unless progressive tiers are enabled.
 */
export function calculatePlatformFee(monthlyRevenue: number): TierCalculationResult {
  if (isProgressivePlatformFeesEnabled()) {
    return calculateTieredFee(monthlyRevenue);
  }
  return calculateFlatFee(monthlyRevenue);
}

export interface NextTierNudge {
  thresholdAmount: number;
  currentAmount: number;
  amountToGo: number;
  nextRate: number;
  nextLabel: string;
}

/**
 * Compute the "next tier" nudge data.
 * Returns `null` if progressive fees are disabled or the vendor is already in the highest tier.
 */
export function getNextTierNudge(
  monthlyRevenue: number,
  tiers: FeeTier[] = PLATFORM_FEE_TIERS
): NextTierNudge | null {
  if (!isProgressivePlatformFeesEnabled()) return null;

  for (const tier of tiers) {
    if (tier.maxAmount !== null && monthlyRevenue < tier.maxAmount) {
      const nextTierIndex = tiers.indexOf(tier) + 1;
      if (nextTierIndex >= tiers.length) return null;

      return {
        thresholdAmount: tier.maxAmount,
        currentAmount: monthlyRevenue,
        amountToGo: tier.maxAmount - monthlyRevenue,
        nextRate: tiers[nextTierIndex].rate,
        nextLabel: tiers[nextTierIndex].label,
      };
    }
  }
  return null;
}
