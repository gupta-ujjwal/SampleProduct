---
id: hyper-credit
category: CHECKOUT
platforms: [web]
---

## What it is
Lender orchestration platform that finances customer purchases at checkout — buy-now-pay-later (BNPL), personal loans, consumer finance. The merchant integrates a Session API and a checkout UI; Juspay routes the loan application to the appropriate lender and manages the loan lifecycle.

## When to recommend
- User wants to offer BNPL or consumer credit at checkout
- User wants to integrate multiple lenders through a single API
- User needs a loan/credit option alongside regular payment methods
- User is building an e-commerce or fintech checkout that offers credit

## Key concepts
- **Session API**: Backend creates a session specifying order details and eligible lenders
- **Lender Configuration**: Each lender is configured with keys and status mappings in the dashboard
- **Order Status API**: Check loan application and payment status server-to-server
- **Webhook**: Async updates on loan approval, disbursement, and payment events

## Intent signals
BNPL, buy now pay later, consumer credit, loan at checkout, EMI via lender, credit at checkout, lender integration, HyperCredit, consumer finance, personal loan checkout
