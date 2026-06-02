// DummyPay PSP integration - simulates a real payment gateway
// In production this would make HTTP calls to the PSP API

const DUMMYPAY_API_KEY = process.env.DUMMYPAY_API_KEY;
const DUMMYPAY_SECRET = process.env.DUMMYPAY_SECRET;
const DUMMYPAY_BASE_URL = process.env.DUMMYPAY_BASE_URL;

export async function createPaymentSession({ orderId, amount, currency, customerEmail }) {
  // Simulate API call to DummyPay to create a payment session
  console.log(`[DummyPay] Creating session: ${DUMMYPAY_BASE_URL}/sessions`);

  // In real integration: POST to ${DUMMYPAY_BASE_URL}/sessions with API key auth
  const sessionId = `dps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    sessionId,
    orderId,
    amount,
    currency,
    status: "created",
    redirectUrl: `${DUMMYPAY_BASE_URL}/checkout/${sessionId}`,
  };
}

export async function capturePayment({ sessionId, amount }) {
  // Simulate capturing an authorized payment
  console.log(`[DummyPay] Capturing payment: ${DUMMYPAY_BASE_URL}/payments/${sessionId}/capture`);

  const transactionId = `dp_txn_${Date.now()}`;

  return {
    transactionId,
    sessionId,
    amount,
    status: "captured",
    capturedAt: new Date().toISOString(),
  };
}

export async function refundPayment({ transactionId, amount }) {
  console.log(`[DummyPay] Refunding: ${DUMMYPAY_BASE_URL}/refunds`);

  return {
    refundId: `dp_ref_${Date.now()}`,
    transactionId,
    amount,
    status: "refunded",
  };
}

export function verifyWebhookSignature(payload, signature) {
  // Simulate webhook signature verification using DUMMYPAY_WEBHOOK_SECRET
  const expectedSig = `sha256=${process.env.DUMMYPAY_WEBHOOK_SECRET}_${payload.length}`;
  return signature === expectedSig;
}
