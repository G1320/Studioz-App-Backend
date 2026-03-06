/**
 * Platform fee tier configuration.
 *
 * Marginal / bracket application:
 *   - 9 % on the first ₪15 000 of monthly Studioz booking revenue
 *   - 7 % on ₪15 001 – ₪40 000
 *   - 5 % on everything above ₪40 000
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

export const PLATFORM_FEE_TIERS: FeeTier[] = [
  { maxAmount: 15_000, rate: 0.09, label: '9%' },
  { maxAmount: 40_000, rate: 0.07, label: '7%' },
  { maxAmount: null,   rate: 0.05, label: '5%' },
];

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
  };
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
 * Returns `null` if the vendor is already in the highest tier.
 */
export function getNextTierNudge(
  monthlyRevenue: number,
  tiers: FeeTier[] = PLATFORM_FEE_TIERS
): NextTierNudge | null {
  for (const tier of tiers) {
    if (tier.maxAmount !== null && monthlyRevenue < tier.maxAmount) {
      // Next threshold is this tier's ceiling
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
  return null; // Already in highest tier
}
