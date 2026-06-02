---
id: upi-tpap-sdk
category: UPI SOLUTIONS
platforms: [android]
---

## What it is
SDK to turn any Android app into a UPI TPAP (Third-Party Application Provider) — like GPay or PayTM. Enables full UPI functionality: P2P transfers, P2M merchant payments, VPA management, balance checks, and mandate creation, all within the merchant's own app.

## When to recommend
- User wants to embed full UPI payment capability directly in their app
- User is building a fintech/super-app and wants P2P and P2M UPI flows
- User wants their app to be a UPI payment app (not just accept UPI payments)
- Android-only use case; requires NPCI TPAP license

## Key concepts
- **TPAP**: Third-Party Application Provider — requires an agreement with a PSP bank and NPCI certification
- **Process payload**: The SDK accepts structured payloads to trigger UPI onboarding, P2P pay, P2M pay, balance check, mandate management
- **P2M**: Person-to-merchant payment; uses a backend transaction status API for reconciliation
- **Intent handling**: Can handle UPI intents from other apps (deep links, QR codes)

## Intent signals
TPAP, UPI app, build UPI app, P2P payments, P2M payments, UPI in my app, GPay-like, UPI mandate, VPA management, UPI balance, UPI onboarding, UPI QR scan
