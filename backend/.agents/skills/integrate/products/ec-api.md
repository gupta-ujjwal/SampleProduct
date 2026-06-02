---
id: ec-api
category: CHECKOUT
platforms: []
---

## What it is
Express Checkout REST API — server-to-server payment integration with no frontend SDK. The merchant's backend calls Juspay APIs directly to create orders, process payments (card, UPI, netbanking, wallets), and handle responses.

## When to recommend
- User is building a fully custom frontend and wants only backend API calls
- User already has their own payment UI and needs the Juspay processing layer
- User needs maximum flexibility over the entire payment flow server-side
- User does not want any Juspay SDK on the client

## Key concepts
- **Customer**: Create a customer object first; most payment flows require a customer ID
- **Create Order**: Initiates a payment; returns a redirect URL or direct response depending on payment method
- **Payment Methods**: Card, UPI Collect, UPI Intent, Netbanking, Wallet — each has its own endpoint
- **HMAC verification**: Return URL and webhooks must be verified using HMAC-SHA256

## Intent signals
REST API, backend API, server-side payments, API only, no SDK, custom frontend with API, process payments from server, direct API integration
