---
id: upi-plugin-sdk
category: UPI SOLUTIONS
platforms: [android, ios, flutter, react-native, cordova]
---

## What it is
HyperUPI — a pre-built, customizable in-app UPI payment plugin. Enables 1-click UPI payments on the merchant's checkout page without needing a full TPAP license. The SDK handles UPI onboarding, payment, and balance check with Juspay's PSP bank partnership.

## When to recommend
- User wants to add UPI payment to their existing checkout page
- User wants 1-click UPI (saved VPA, intent flow) without building a full TPAP
- User is on Android, iOS, Flutter, React Native, or Cordova
- User does NOT need P2P — only P2M (collecting payments from customers)

## Key concepts
- **Process payload**: SDK accepts structured payloads for UPI onboarding, pay, balance check, management
- **Session token**: Backend generates a session token that the SDK uses to authenticate
- **Callbacks**: SDK fires callbacks for transaction created, charged, succeeded, failed, order failed
- **No NPCI TPAP license needed**: Works through Juspay's PSP partnership

## Intent signals
UPI plugin, in-app UPI, 1-click UPI, UPI on checkout, HyperUPI, UPI payment method, add UPI to checkout, UPI collect, UPI intent, Android UPI, iOS UPI
