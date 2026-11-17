//! Stripe catalogue operator scenarios over the real binary and loopback provider.

#![expect(
    clippy::unwrap_used,
    reason = "CLI fixture setup and assertion inputs must fail immediately when invalid"
)]

mod stripe_catalogue;
mod stripe_catalogue_double;
