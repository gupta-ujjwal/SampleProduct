---
id: payout
category: PAYOUTS
platforms: []
---

## What it is
API to transfer funds to customers or vendors via bank account (IMPS/NEFT/RTGS), UPI ID, cards, or wallets. Used for refunds, vendor payments, cashbacks, commission payouts, and any scenario where the merchant is the sender of money.

## When to recommend
- User wants to send money to users or vendors
- User needs payouts, disbursements, or vendor settlements
- User needs to transfer to bank accounts, UPI IDs, or wallets
- User needs beneficiary validation before transferring

## Key concepts
- **Beneficiary**: The recipient of funds; must be created/validated before a payout
- **Order Create**: Initiates a payout transfer; returns a reference for tracking
- **Beneficiary Validation**: Penny-drop or penniless validation to verify bank accounts
- **Payout Links**: Optional — send a link to the recipient to self-enter their bank details

## Intent signals
payout, disburse, transfer money, send money, vendor payment, cashback, refund, commission payout, NEFT, IMPS, UPI transfer, bank transfer, fund transfer
