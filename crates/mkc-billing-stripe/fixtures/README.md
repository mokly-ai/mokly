# Stripe HTTP response fixtures

These checked-in records are sanitized examples modeled on Stripe's public API
reference for version `2026-08-26.dahlia`. They are not authenticated live
captures. Every customer, session, subscription, item, price, event, request ID,
email, URL, and timestamp is fictitious test data; no real API key, webhook
secret, account identifier, or provider object is present.

Each JSON record retains an HTTP status, lowercase response headers, and a JSON
body. `products-page.json` and `products-page-last.json` form one cursor-paged
listing whose last page includes an archived product. `product-created.json`
and `product-updated.json` cover product writes. The subscription record
deliberately carries two items and keeps `current_period_end` on each item,
matching the pinned API version. It also carries each embedded price's lookup
key and seat-kind metadata plus the expanded latest invoice used by payment
reconciliation. Failure records cover 400 validation, 403 permission denial,
404 absence, 429 with `Retry-After`, and 500 availability behavior. Their
sanitized envelopes include realistic Stripe error types and codes without
retaining actionable account or request data.

`prices-by-lookup-key.json` returns both catalogue prices with lookup keys,
nicknames, tax behavior, seat metadata, and the shared product expanded;
`prices-by-lookup-key-empty.json` records the valid empty result.
`product-prices-page.json` and `product-prices-page-last.json` form one
cursor-paged active-price listing and include a seat-kind price without a
lookup key. Every price includes its Unix creation time. `price-retrieved.json`
covers the exact single-price read; `price-created.json`, `price-updated.json`,
and `price-archived.json` cover each write outcome.

Tests replay these records through the provider-neutral `Http` trait and assert
methods, paths, bearer selection, idempotency keys, bracketed form fields, typed
decoding, retry policy, and error classification. Transport tests inspect the
prepared reqwest request to cover the pinned version and authorization headers
without making a network request.

When updating fixtures, preserve Stripe's field names, nullability, list
envelopes, item-level billing periods, and error envelope shape. Keep all data
sanitized and run the interface, adapter, and configuration test suites.

Sources: [customers](https://docs.stripe.com/api/customers),
[Checkout sessions](https://docs.stripe.com/api/checkout/sessions),
[Customer Portal sessions](https://docs.stripe.com/api/customer_portal/sessions),
[subscriptions](https://docs.stripe.com/api/subscriptions),
[subscription items](https://docs.stripe.com/api/subscription_items),
[products](https://docs.stripe.com/api/products), and
[prices](https://docs.stripe.com/api/prices).
