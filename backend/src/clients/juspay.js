import "dotenv/config";

const API_KEY = process.env.JUSPAY_API_KEY;
const MERCHANT_ID = process.env.JUSPAY_MERCHANT_ID;
const CLIENT_ID = process.env.JUSPAY_CLIENT_ID || MERCHANT_ID;
const ENVIRONMENT = process.env.JUSPAY_ENVIRONMENT || "sandbox";

const BASE_URL =
  ENVIRONMENT === "production"
    ? "https://api.juspay.in"
    : "https://sandbox.juspay.in";

function getAuthHeader() {
  if (!API_KEY) {
    throw new Error("JUSPAY_API_KEY environment variable is not set");
  }
  return "Basic " + Buffer.from(API_KEY + ":").toString("base64");
}

function getHeaders(routingId) {
  if (!MERCHANT_ID) {
    throw new Error("JUSPAY_MERCHANT_ID environment variable is not set");
  }
  return {
    Authorization: getAuthHeader(),
    "x-merchantid": MERCHANT_ID,
    "Content-Type": "application/json",
    ...(routingId ? { "x-routing-id": routingId } : {}),
  };
}

/**
 * Create a HyperCheckout session via Juspay Session API.
 */
export async function createSession(params) {
  const payload = {
    order_id: params.order_id,
    amount: params.amount,
    customer_id: params.customer_id,
    customer_email: params.customer_email,
    customer_phone: params.customer_phone,
    payment_page_client_id: CLIENT_ID,
    action: "paymentPage",
    return_url: params.return_url,
    ...(params.first_name && { first_name: params.first_name }),
    ...(params.last_name && { last_name: params.last_name }),
    ...(params.description && { description: params.description }),
    ...(params.currency && { currency: params.currency }),
    ...(params.get_upi_deep_links && {
      "options.get_upi_deep_links": "true",
    }),
  };

  const response = await fetch(`${BASE_URL}/session`, {
    method: "POST",
    headers: getHeaders(params.customer_id),
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(
      data.error_message || data.error_info?.developer_message || "Session creation failed"
    );
    err.name = "JuspayError";
    err.code = data.error_code || `HTTP_${response.status}`;
    err.httpStatus = response.status;
    err.juspayResponse = data;
    throw err;
  }

  return data;
}

/**
 * Get order status from Juspay Order Status API.
 */
export async function getOrderStatus(order_id, customer_id) {
  const response = await fetch(`${BASE_URL}/orders/${encodeURIComponent(order_id)}`, {
    method: "GET",
    headers: {
      ...getHeaders(customer_id),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(
      data.error_message || data.error_info?.developer_message || "Order status check failed"
    );
    err.name = "JuspayError";
    err.code = data.error_code || `HTTP_${response.status}`;
    err.httpStatus = response.status;
    err.juspayResponse = data;
    throw err;
  }

  return data;
}
