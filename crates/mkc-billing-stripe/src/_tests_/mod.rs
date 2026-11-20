//! Stripe adapter tests with recorded HTTP and deterministic crypto vectors.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod catalogue_read_tests;
mod catalogue_write_tests;
mod client_tests;
mod fixtures;
mod form_tests;
mod lookup_price_tests;
mod pagination_tests;
mod rate_limit_tests;
mod response_tests;
mod security_tests;
mod subscription_tests;
mod transport_tests;
