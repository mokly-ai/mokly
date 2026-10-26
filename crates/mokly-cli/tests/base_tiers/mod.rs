//! Base dependency tier tests with real package managers and a cold cache.
//!
//! Each case runs locally and with the hosted CI defaults `CI=true` and
//! `GITHUB_ACTIONS=true`, except the secret and timing cases, which use the
//! inherited environment.

mod classic_tests;
mod cold;
mod fallback_tests;
mod install_tests;
mod manager_fixture;
mod managers;
mod probe;
mod registry;
mod registry_fixture;
mod registry_tests;
mod secrets_tests;
mod support;
mod tiers_tests;
mod timing_tests;
