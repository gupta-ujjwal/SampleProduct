---
id: ec-headless
category: CHECKOUT
platforms: [android, ios, flutter, react-native, cordova, capacitor, web]
---

## What it is
Express Checkout SDK for merchants who want to build a fully custom payment UI. The SDK handles the payment logic, session management, and network calls while the merchant owns and renders every UI element.

## When to recommend
- User wants to build their own checkout UI (custom design, custom payment method list)
- User does NOT want a pre-built payment page
- User needs fine-grained control over the payment flow and UI rendering
- User is building on mobile (Android/iOS/Flutter/React Native) or web

## Key concepts
- **Customer**: Must be created first; the SDK is customer-centric
- **Payment Methods API**: Fetch available methods for the customer and order before rendering UI
- **Session**: Backend creates a session; client SDK uses it to initiate payment
- **Headless**: SDK manages payment processing; merchant code manages all UI

## Intent signals
custom UI, custom checkout, headless SDK, build my own payment page, custom payment form, control the UI, own the design, branded checkout
