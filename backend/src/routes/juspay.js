import express from "express";
import prisma from "../db.js";
import { createSession, getOrderStatus } from "../clients/juspay.js";
import {
  validateSessionPayload,
  persistSession,
  updatePaymentStatus,
} from "../services/juspay.js";

const router = express.Router();

/**
 * POST /api/juspay/session
 * Creates a HyperCheckout session.
 */
router.post("/session", async (req, res) => {
  try {
    const payload = {
      payment_page_client_id: process.env.JUSPAY_CLIENT_ID || process.env.JUSPAY_MERCHANT_ID,
      action: "paymentPage",
      return_url: process.env.JUSPAY_RETURN_URL,
      ...req.body,
    };

    validateSessionPayload(payload);

    const sessionResponse = await createSession(payload);

    const order = await prisma.order.findUnique({
      where: { orderNumber: req.body.order_id },
    });

    if (order) {
      await persistSession(order.id, sessionResponse);
    }

    res.json({
      success: true,
      sdkPayload: sessionResponse.sdk_payload,
      paymentLinks: sessionResponse.payment_links,
      orderId: sessionResponse.order_id,
      juspayOrderId: sessionResponse.id,
      status: sessionResponse.status,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(422).json({
        success: false,
        error_code: "VALIDATION_FAILED",
        error_message: err.message,
      });
    }

    if (err.name === "JuspayError") {
      return res.status(err.httpStatus || 500).json({
        success: false,
        error_code: err.code,
        error_message: err.message,
        details: err.juspayResponse,
      });
    }

    console.error("[Juspay] Session creation error:", err);
    res.status(500).json({
      success: false,
      error_code: "INTERNAL_ERROR",
      error_message: "An unexpected error occurred",
    });
  }
});

/**
 * GET /api/juspay/order-status/:orderId
 * Checks the status of a Juspay order.
 */
router.get("/order-status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { customer_id } = req.query;

    const statusResponse = await getOrderStatus(orderId, customer_id);

    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: { payment: true },
    });

    if (order?.payment) {
      await updatePaymentStatus(order.id, statusResponse);
    }

    res.json({
      success: true,
      orderId: statusResponse.order_id,
      juspayOrderId: statusResponse.id,
      status: statusResponse.status,
      statusId: statusResponse.status_id,
      amount: statusResponse.amount,
      currency: statusResponse.currency,
      paymentMethod: statusResponse.payment_method,
      paymentMethodType: statusResponse.payment_method_type,
      txnId: statusResponse.txn_id,
      gateway: statusResponse.txn_detail?.gateway,
      refunded: statusResponse.refunded,
      amountRefunded: statusResponse.amount_refunded,
    });
  } catch (err) {
    if (err.name === "JuspayError") {
      return res.status(err.httpStatus || 500).json({
        success: false,
        error_code: err.code,
        error_message: err.message,
        details: err.juspayResponse,
      });
    }

    console.error("[Juspay] Order status error:", err);
    res.status(500).json({
      success: false,
      error_code: "INTERNAL_ERROR",
      error_message: "An unexpected error occurred",
    });
  }
});

/**
 * POST /api/juspay/webhook
 * Receives asynchronous webhook events from Juspay.
 */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Basic ")) {
      // Decode and verify username/password if desired
    }

    const payload = JSON.parse(req.body);

    console.log("[Juspay Webhook] Received:", payload.event_name, "for order", payload.order_id);

    if (payload.order_id && payload.status) {
      const order = await prisma.order.findUnique({
        where: { orderNumber: payload.order_id },
        include: { payment: true },
      });

      if (order?.payment) {
        await updatePaymentStatus(order.id, payload);
      }
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("[Juspay] Webhook error:", err);
    res.status(400).json({ status: "error", message: err.message });
  }
});

export default router;
