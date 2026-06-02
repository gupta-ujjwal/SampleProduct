---
id: hyper-checkout
category: CHECKOUT
platforms: [android, ios, web, flutter, react-native, cordova, capacitor, iframe-web]
---

## What it is
Pre-built, customizable payment page UI that handles the entire checkout experience — card, UPI, netbanking, wallets, EMI, and more. The merchant creates a session on the backend, then launches the SDK which renders and manages the full payment UI.

## When to recommend
- User wants a ready-made payment page without building UI from scratch
- User wants Juspay to handle payment method display, orchestration, and redirects
- User's app is mobile (Android/iOS/Flutter/React Native) or web-based
- User wants the fastest path to accepting all payment methods

## Key concepts
- **Session**: Backend creates an order session; the SDK payload from the response is passed to the client SDK to launch checkout
- **Order Status API**: Always reconcile server-to-server after callback — never trust SDK result alone
- **Webhook**: Async notification for final payment status; idempotent handling required
- **iframe-web vs web**: Two separate web integrations — iframe embeds checkout in a div; web redirect is a full-page redirect

## iframe-web: Modal Popup Layout

The SDK injects an `<iframe>` into `<div id="HyperSDKDiv">`. The SDK does not create a modal — the merchant must wrap that div in one. When generating the iframe-web integration, always emit a modal with these properties:

- **Overlay**: fixed, full-viewport, `z-index` above all page content, semi-transparent dark backdrop, `pointer-events: all` so no clicks reach the page behind it, flex-centered
- **Modal**: the `#HyperSDKDiv` itself — full width and height of the popup, no border on the injected iframe
- **Lifecycle**: show the overlay before calling `process()`; hide it on `process_result` in the callback

Fetch the code reference from the docs to get the correct selector names, SDK callback events, and any minimum-dimension constraints before generating the implementation.

## Intent signals
checkout UI, payment page, payment screen, pre-built UI, hosted payment, accept payments, mobile payments, Android payment, iOS payment, Flutter payment, React Native payment, web checkout, iframe checkout, customizable checkout

## Test Scripts

### Step 7B-1 — Session creation

```bash
bash .claude/skills/integrate/scripts/test/hyper-checkout/session.sh \
  "$SESSION_ENDPOINT" "$TEST_ORDER_ID" "$TEST_AMOUNT" \
  "$TEST_CUSTOMER_ID" "$TEST_CUSTOMER_EMAIL" "$TEST_CUSTOMER_PHONE" \
  "$TEST_FIRST_NAME" "$TEST_LAST_NAME"
```

Verify: HTTP 200 AND response body contains `sdkPayload` AND DB row for `$TEST_ORDER_ID` exists with `payment_status = NEW`.

Extract `juspay_order_id` from the response as `TEST_JUSPAY_ORDER_ID` for the webhook test.

### Step 7B-2 — Order status

```bash
bash .claude/skills/integrate/scripts/test/hyper-checkout/order-status.sh \
  "$ORDER_STATUS_ENDPOINT" "$TEST_ORDER_ID"
```

Verify: HTTP 200 AND response body contains a `status` field.
