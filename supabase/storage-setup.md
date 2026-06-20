# Supabase Storage Setup

The migration creates two public buckets:

- `business-logos`: logo uploads, 2 MB limit, PNG/JPEG/WebP.
- `payment-receipts`: receipt uploads, 5 MB limit, PNG/JPEG/WebP.

The MVP stores public object URLs in the database so receipts can be reviewed without a paid storage proxy. To make receipts private later, change `payment-receipts` to a private bucket, store object paths instead of public URLs, and add a signed-url route for authenticated business owners.
