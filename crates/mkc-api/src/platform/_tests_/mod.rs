//! Policy tests use only unimock query and runtime boundaries.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod authorization_tests;
mod boundary_tests;
mod deletion_race_tests;
mod dispatch_tests;
mod entitlement_tests;
mod initial_plan_tests;
mod installation_projection_tests;
mod invitation_effect_tests;
mod project_access_tests;
mod project_creation_tests;
mod project_fixture;
mod projection_tests;
mod query_fixture;
mod slug_tests;
mod support;
mod transaction_tests;
