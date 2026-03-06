import { Request, Response } from 'express';
import { paymentCanaryService } from '../../services/paymentCanaryService.js';
import handleRequest from '../../utils/requestHandler.js';

/**
 * POST /api/payment-canary/run
 * Manually trigger a canary payment test
 */
export const triggerCanaryTest = handleRequest(async (_req: Request, _res: Response) => {
  const result = await paymentCanaryService.runCanaryTest();
  return {
    testId: result.testId,
    status: result.status,
    chargeLatencyMs: result.chargeLatencyMs,
    refundLatencyMs: result.refundLatencyMs,
    sumitPaymentId: result.sumitPaymentId,
    refundId: result.refundId,
    errorMessage: result.errorMessage,
    timestamp: result.timestamp
  };
});

/**
 * GET /api/payment-canary/history
 * Get recent canary test results
 */
export const getCanaryHistory = handleRequest(async (req: Request, _res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
  const results = await paymentCanaryService.getRecentResults(limit);
  return { results, count: results.length };
});

/**
 * POST /api/payment-canary/setup-card
 * One-time setup: save the admin's credit card for canary tests
 * Body: { singleUseToken, name, email, phone }
 * Returns the customerId to configure in .env as CANARY_SUMIT_CUSTOMER_ID
 */
export const setupCanaryCard = handleRequest(async (req: Request, res: Response) => {
  const { singleUseToken, name, email, phone } = req.body;

  if (!singleUseToken) {
    res.status(400);
    return { error: 'singleUseToken is required. Generate one from the Sumit tokenization widget.' };
  }

  const result = await paymentCanaryService.saveCanaryCard(singleUseToken, {
    name: name || 'Canary Test Admin',
    email: email || '',
    phone: phone || ''
  });

  if (!result.success) {
    res.status(400);
    return { error: result.error };
  }

  return {
    success: true,
    customerId: result.customerId,
    lastFourDigits: result.lastFourDigits,
    instructions: `Set CANARY_SUMIT_CUSTOMER_ID=${result.customerId} in your .env file and restart the server.`
  };
});
