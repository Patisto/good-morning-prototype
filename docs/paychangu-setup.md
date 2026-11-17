# PayChangu setup

Create a PayChangu merchant account with Mobile Money Direct Charge enabled
for Malawi, obtain the secret key and webhook secret, and configure a public
HTTPS webhook URL:

```dotenv
PAYCHANGU_ENV=test
PAYCHANGU_BASE_URL=https://api.paychangu.com
PAYCHANGU_SECRET_KEY=server-only-key
PAYCHANGU_WEBHOOK_SECRET=dashboard-webhook-secret
PAYMENT_CURRENCY=MWK
```

Use test credentials and test mode before production. Configure the dashboard
webhook as `https://api.example.com/api/webhooks/paychangu`. Never put either
secret in frontend environment variables or source control. The integration
can be disabled by leaving the PayChangu secrets unset; cash and manually
recorded merchant payments continue to work.

Direct Charge requires the merchant account to support the selected operator.
The backend uses the documented Airtel Money and TNM Mpamba operator reference
IDs and the charge initialization and verification endpoints.
