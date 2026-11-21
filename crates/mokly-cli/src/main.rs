//! Mokly binary composition root.

use mimalloc::MiMalloc;

mod base_dependencies;
mod base_dependency_selection;
mod base_dependency_sources;

mod base_render_admission;
mod bundle_runtime;
mod cache_directory;
mod changes_base;
mod changes_base_sources;
mod changes_freshness;
mod changes_runtime;
mod changes_source_admission;
mod changes_static;
mod changes_validation_admission;
mod command_diagnostics;
#[cfg(test)]
#[path = "_tests_/dependency_source_support.rs"]
mod dependency_source_support;
mod entry;
mod entry_build;
mod entry_publish;
mod entry_serve;
mod interrupts;
mod one_shot;
mod one_shot_summary;
mod publication_runtime;
mod render_runtime;
mod render_store_runtime;
mod serve_base;
mod serve_base_cancel;
mod serve_base_key;
mod serve_candidates;
mod serve_capture_cancel;
mod serve_capture_workers;
mod serve_changes;
mod serve_changes_base;
mod serve_changes_classification;
mod serve_changes_native;
mod serve_controls;
mod serve_debounce;
mod serve_delivery;
mod serve_eager;
mod serve_eager_admission;
mod serve_eager_adoption;
mod serve_eager_base;
mod serve_eager_cancel;
mod serve_eager_diagnostics;
mod serve_eager_directory;
mod serve_eager_events;
mod serve_eager_evidence;
mod serve_eager_lifetime;
mod serve_eager_lookup;
mod serve_eager_native;
mod serve_eager_reporting;
mod serve_eager_source_gate;
mod serve_eager_sources;
mod serve_eager_task;
mod serve_eager_validation;
mod serve_eager_work;
mod serve_eager_workers;
mod serve_gate;
mod serve_git;
#[cfg(unix)]
mod serve_keyboard_keys;
#[cfg(unix)]
mod serve_keyboard_unix;
mod serve_lifecycle;
mod serve_pool;
mod serve_preparation;
mod serve_progress;
mod serve_rebuild;
mod serve_rebuild_action;
mod serve_reporter;
mod serve_return;
mod serve_services;
mod serve_shutdown;
mod serve_signals;
mod serve_state;
mod serve_timing;
mod serve_trace;
mod serve_trace_cache;
mod serve_trace_fields;
mod serve_trace_stages;
mod serve_warnings;
mod serve_watch;
mod serve_watch_events;
mod serve_watch_files;
mod serve_watch_plan;
mod static_runtime;
mod static_setup;
mod terminal;
mod viewer_assets;

#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;

fn main() -> std::process::ExitCode {
    #[cfg(all(debug_assertions, unix))]
    if let Some(result) = test_faults::signal_lifecycle() {
        return result;
    }
    entry::main()
}

mod phase_format;
#[cfg(debug_assertions)]
mod test_faults;

#[cfg(test)]
#[path = "_tests_/warning_support.rs"]
mod warning_support;

#[cfg(test)]
#[path = "_tests_/eager_bundle_reporting_tests.rs"]
mod eager_bundle_reporting_tests;
#[cfg(test)]
#[path = "_tests_/eager_diagnostics_tests.rs"]
mod eager_diagnostics_tests;
#[cfg(test)]
#[path = "_tests_/eager_events_tests.rs"]
mod eager_events_tests;
#[cfg(test)]
#[path = "_tests_/eager_prefetch_tests.rs"]
mod eager_prefetch_tests;
