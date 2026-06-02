import express from "express";
import prisma from "../db.js";
import { createPaymentSession, capturePayment } from "../services/dummypay.js";

const router = express.Router();

// GET /api/homepage - returns homepage message and merchant info
router.get("/homepage", async (req, res) => {
  res.json({
    merchantName: process.env.MERCHANT_NAME,
    message: `Welcome to ${process.env.MERCHANT_NAME}! Browse our collection and pay securely via DummyPay.`,
    bannerText: "Summer Sale - Up to 30% off on electronics!",
  });
});

// GET /api/products - list all active products
router.get("/products", async (req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ products });
});

// POST /api/orders - create an order
router.post("/orders", async (req, res) => {
  const { userId, items } = req.body; // items: [{ productId, quantity }]

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });

  const totalAmount = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    return sum + product.price * item.quantity;
  }, 0);

  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      userId,
      totalAmount,
      items: {
        create: items.map((item) => {
          const product = products.find((p) => p.id === item.productId);
          return {
            productId: item.productId,
            quantity: item.quantity,
            price: product.price,
          };
        }),
      },
    },
    include: { items: { include: { product: true } } },
  });

  // Create payment session with DummyPay PSP
  const pspSession = await createPaymentSession({
    orderId: order.id,
    amount: totalAmount,
    currency: order.currency,
    customerEmail: "test@example.com",
  });

  // Store payment record with PSP session reference
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      amount: totalAmount,
      currency: order.currency,
      transactionId: pspSession.sessionId,
      gatewayResponse: pspSession,
    },
  });

  res.json({ order, payment, pspSession });
});

// GET /api/orders/:id - get order details
router.get("/orders/:id", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      items: { include: { product: true } },
      payment: true,
      user: true,
    },
  });

  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order });
});

// POST /api/payments/:paymentId/fulfill - capture payment via DummyPay and confirm order
router.post("/payments/:paymentId/fulfill", async (req, res) => {
  const { paymentId } = req.params;
  const { paymentMethod } = req.body;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });

  if (!payment) return res.status(404).json({ error: "Payment not found" });

  // Call DummyPay to capture the payment
  const captureResult = await capturePayment({
    sessionId: payment.transactionId,
    amount: payment.amount,
  });

  const [updatedPayment, updatedOrder] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "CAPTURED",
        transactionId: captureResult.transactionId,
        paymentMethod: paymentMethod || "card",
        gatewayResponse: captureResult,
      },
    }),
    prisma.order.update({
      where: { id: payment.orderId },
      data: { status: "CONFIRMED" },
    }),
  ]);

  res.json({
    success: true,
    message: "Payment fulfilled successfully",
    payment: updatedPayment,
    order: updatedOrder,
  });
});

// GET /api/payments/:paymentId - get payment status
router.get("/payments/:paymentId", async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.paymentId },
    include: { order: { include: { items: { include: { product: true } } } } },
  });

  if (!payment) return res.status(404).json({ error: "Payment not found" });
  res.json({ payment });
});

export default router;
