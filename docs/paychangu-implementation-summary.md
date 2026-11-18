# PayChangu implementation summary

## Changes

- Added direct-charge initialization and verification to the backend PayChangu
  client.
- Added authenticated grocery payment initiation and status endpoints.
- Added authenticated restaurant payment initiation and status endpoints.
- Added signed, idempotent webhook handling for grocery attempts.
- Added signed, idempotent webhook handling for restaurant attempts.
- Added additive grocery payment-attempt and event tables and the `PAYCHANGU`
  sale payment method.
- Added additive restaurant payment-attempt and event tables. Verified
  restaurant attempts post into the existing sales ledger.
- Added network, phone, pending, and success/failure states to the existing
  grocery checkout.

## Configuration

Set `PAYCHANGU_SECRET_KEY`, `PAYCHANGU_WEBHOOK_SECRET`, and
`PAYCHANGU_BASE_URL`/`PAYMENT_CURRENCY` as described in
[paychangu-setup.md](./paychangu-setup.md). No credentials are committed.

## Verification

The backend recalculates the cart, checks stock and amount, verifies the
charge amount/currency/reference, locks the attempt, and posts the sale once.
The existing rent PayChangu flow remains separate. Restaurant PayChangu uses
Direct Charge and supports Airtel Money and TNM Mpamba.

## Limitations

The merchant account must have Direct Charge enabled for Airtel Money and TNM
Mpamba. Live payment processing still requires merchant dashboard setup and
an authorized end-to-end transaction; automated tests must use mocks.
