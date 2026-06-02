import prisma from "../db.js";

/**
 * Validates a session payload against Juspay HyperCheckout constraints.
 * Throws ValidationError on violation.
 */
export function validateSessionPayload(payload) {
  const errors = [];

  // order_id: string, required, maxLength 21, alphanumeric
  if (!payload.order_id) {
    errors.push("order_id is required");
  } else {
    if (typeof payload.order_id !== "string") {
      errors.push("order_id must be a string");
    } else if (payload.order_id.length > 21) {
      errors.push("order_id must not exceed 21 characters");
    } else if (!/^[a-zA-Z0-9_-]+$/.test(payload.order_id)) {
      errors.push("order_id must be alphanumeric");
    }
  }

  // amount: string, required, min INR 1, up to 2 decimal places
  if (!payload.amount) {
    errors.push("amount is required");
  } else {
    if (typeof payload.amount !== "string") {
      errors.push("amount must be a string");
    } else {
      const amtNum = parseFloat(payload.amount);
      if (isNaN(amtNum)) {
        errors.push("amount must be a valid number string");
      } else if (amtNum < 1) {
        errors.push("amount must be at least 1.00");
      } else if (!/^\d+(\.\d{1,2})?$/.test(payload.amount)) {
        errors.push("amount must have at most 2 decimal places");
      }
    }
  }

  // customer_id: string, required, maxLength 128
  if (!payload.customer_id) {
    errors.push("customer_id is required");
  } else {
    if (typeof payload.customer_id !== "string") {
      errors.push("customer_id must be a string");
    } else if (payload.customer_id.length > 128) {
      errors.push("customer_id must not exceed 128 characters");
    }
  }

  // customer_email: string, required, maxLength 300
  if (!payload.customer_email) {
    errors.push("customer_email is required");
  } else {
    if (typeof payload.customer_email !== "string") {
      errors.push("customer_email must be a string");
    } else if (payload.customer_email.length > 300) {
      errors.push("customer_email must not exceed 300 characters");
    } else {
      const emailRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(payload.customer_email)) {
        errors.push("customer_email format is invalid");
      }
    }
  }

  // customer_phone: string, required, maxLength 300
  if (!payload.customer_phone) {
    errors.push("customer_phone is required");
  } else {
    if (typeof payload.customer_phone !== "string") {
      errors.push("customer_phone must be a string");
    } else if (payload.customer_phone.length > 300) {
      errors.push("customer_phone must not exceed 300 characters");
    } else if (!/^\d{10}$/.test(payload.customer_phone)) {
      errors.push("customer_phone must be a 10-digit number");
    }
  }

  // payment_page_client_id: string, required
  if (!payload.payment_page_client_id) {
    errors.push("payment_page_client_id is required");
  } else if (typeof payload.payment_page_client_id !== "string") {
    errors.push("payment_page_client_id must be a string");
  }

  // action: string, required, enum ["paymentPage", "paymentManagement"]
  if (!payload.action) {
    errors.push("action is required");
  } else if (!["paymentPage", "paymentManagement"].includes(payload.action)) {
    errors.push("action must be 'paymentPage' or 'paymentManagement'");
  }

  // return_url: string, required, maxLength 255, HTTPS, no query params
  if (!payload.return_url) {
    errors.push("return_url is required");
  } else {
    if (typeof payload.return_url !== "string") {
      errors.push("return_url must be a string");
    } else if (payload.return_url.length > 255) {
      errors.push("return_url must not exceed 255 characters");
    } else {
      try {
        const url = new URL(payload.return_url);
        if (url.protocol !== "https:") {
          errors.push("return_url must use HTTPS protocol");
        }
        if (url.search && url.search.length > 1) {
          errors.push("return_url must not contain query parameters");
        }
      } catch {
        errors.push("return_url must be a valid URL");
      }
    }
  }

  // first_name: string, maxLength 255
  if (payload.first_name !== undefined) {
    if (typeof payload.first_name !== "string") {
      errors.push("first_name must be a string");
    } else if (payload.first_name.length > 255) {
      errors.push("first_name must not exceed 255 characters");
    }
  }

  // last_name: string, maxLength 255
  if (payload.last_name !== undefined) {
    if (typeof payload.last_name !== "string") {
      errors.push("last_name must be a string");
    } else if (payload.last_name.length > 255) {
      errors.push("last_name must not exceed 255 characters");
    }
  }

  // description: string, maxLength 255
  if (payload.description !== undefined) {
    if (typeof payload.description !== "string") {
      errors.push("description must be a string");
    } else if (payload.description.length > 255) {
      errors.push("description must not exceed 255 characters");
    }
  }

  // currency: string, uppercase, default INR
  if (payload.currency !== undefined) {
    if (typeof payload.currency !== "string") {
      errors.push("currency must be a string");
    } else if (payload.currency !== payload.currency.toUpperCase()) {
      errors.push("currency must be uppercase");
    }
  }

  if (errors.length > 0) {
    const err = new Error(errors.join("; "));
    err.name = "ValidationError";
    err.code = "VALIDATION_FAILED";
    throw err;
  }
}

/**
 * Maps Juspay transaction status to internal PaymentStatus enum.
 */
export function mapJuspayStatus(juspayStatus) {
  const statusMap = {
    NEW: "PENDING",
    PENDING_VBV: "PENDING",
    CHARGED: "CAPTURED",
    AUTHENTICATION_FAILED: "FAILED",
    AUTHORIZATION_FAILED: "FAILED",
    JUSPAY_DECLINED: "FAILED",
    AUTHORIZING: "PENDING",
    COD_INITIATED: "PENDING",
    STARTED: "PENDING",
    AUTO_REFUNDED: "REFUNDED",
    PARTIAL_CHARGED: "CAPTURED",
    AUTHORIZED: "AUTHORIZED",
    CAPTURE_INITIATED: "PENDING",
    CAPTURE_FAILED: "FAILED",
    VOIDED: "FAILED",
    VOID_INITIATED: "PENDING",
    VOID_FAILED: "FAILED",
    NOT_FOUND: "FAILED",
  };
  return statusMap[juspayStatus] || "PENDING";
}

/**
 * Persist session response to the database.
 */
export async function persistSession(orderId, sessionResponse) {
  return prisma.payment.upsert({
    where: { orderId },
    create: {
      orderId,
      amount: parseFloat(sessionResponse.sdk_payload?.payload?.amount || 0),
      currency: sessionResponse.sdk_payload?.payload?.currency || "INR",
      status: "PENDING",
      transactionId: sessionResponse.id,
      gatewayResponse: sessionResponse,
    },
    update: {
      transactionId: sessionResponse.id,
      gatewayResponse: sessionResponse,
      status: "PENDING",
    },
  });
}

/**
 * Update payment status from order status API response.
 */
export async function updatePaymentStatus(orderId, orderStatusResponse) {
  const mappedStatus = mapJuspayStatus(orderStatusResponse.status);
  return prisma.payment.update({
    where: { orderId },
    data: {
      status: mappedStatus,
      paymentMethod: orderStatusResponse.payment_method || null,
      gatewayResponse: orderStatusResponse,
      transactionId: orderStatusResponse.txn_id || undefined,
    },
  });
}
