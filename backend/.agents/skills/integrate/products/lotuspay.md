---
id: lotuspay
category: CHECKOUT
platforms: [web]
---

## What it is
NACH Mandate (National Automated Clearing House) platform for recurring bank debits at scale. Merchants use the REST API or LotusPay.js to register mandates and then execute ACH debits against them on a schedule — with 99% success rate via sponsor bank integrations.

## When to recommend
- User needs NACH-based recurring debits (not UPI Autopay, not card mandates)
- User is in lending, insurance, or utility billing needing bank-account-level recurring payments
- User needs physical mandate, API eMandate, or eSign eMandate registration
- User needs high-volume recurring debit infrastructure

## Key concepts
- **Source**: A mandate registration request — can be API eMandate, physical, or eSign
- **Mandate**: An authorized standing instruction on the customer's bank account
- **ACH Debit**: Actual debit execution against a registered mandate
- **LotusPay.js**: Optional JavaScript library for embedding the mandate registration UI
- **Sponsor bank**: LotusPay routes mandates through partner sponsor banks to NPCI

## Intent signals
NACH, NACH mandate, recurring debit, bank debit, eMandate, physical mandate, eSign mandate, ACH debit, standing instruction, NPCI mandate, high-volume recurring, bank account recurring
