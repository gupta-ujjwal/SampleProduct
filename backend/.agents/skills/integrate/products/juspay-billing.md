---
id: juspay-billing
category: BILLING
platforms: []
---

## What it is
End-to-end mandate lifecycle management for subscription and recurring billing. Merchants configure billing plans on the dashboard; Juspay handles mandate registration, execution scheduling, retries, and the full subscription lifecycle as configuration — not custom code.

## When to recommend
- User needs subscription billing (SaaS, D2C, lending, insurance)
- User wants recurring charges on a schedule (weekly, monthly, annual)
- User wants Juspay to manage mandate execution automatically
- User needs plan changes, free trials, add-ons, or introductory pricing

## Key concepts
- **Plan**: A billing configuration (amount, frequency, trial period) created in the dashboard
- **Session API**: Used to present a mandate registration flow to the customer
- **Mandate Register**: Customer authorizes a recurring debit on their payment instrument
- **Execution**: Juspay debits the customer automatically per the plan schedule
- **Webhook**: Notifies the merchant of execution success/failure for each billing cycle

## Intent signals
subscription, recurring billing, recurring payments, SaaS billing, auto-debit, mandate, billing plan, monthly charge, annual plan, free trial, charging customers regularly
