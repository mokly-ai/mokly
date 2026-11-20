//! GitHub integration test composition and reusable scenario steps.

mod auth_tests;
mod deliveries;
mod desktop_origin_tests;
mod fixtures;
mod harness;
mod harness_settings;
mod installation_tests;
mod installation_workflow;
mod lifecycle_tests;
mod ordering_tests;
mod queue_tests;
mod replica;
mod repository_created_tests;
mod repository_tests;
mod seed;
mod smoke_tests;
mod unlinked_project_tests;
mod workflow;
mod workspace_read_tests;

mod check_delivery_tests;
mod check_support;

mod build_api;
mod build_exchange;
mod build_provider;
mod build_smoke_tests;

mod build_upload;
