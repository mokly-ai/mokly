//! GitHub workflow and composite action rules.

mod actionlint_tests;
mod dependency_audit_tests;
mod job_timeouts_tests;
mod npm_pin_tests;
mod policies_tests;
#[cfg(unix)]
mod publish_action_tests;
mod release_tags_tests;
mod release_tests;
mod remote_state_commands;
mod remote_state_tests;
#[cfg(unix)]
mod required_guard_tests;
mod runner_sizes_tests;
mod rust_pin_tests;
