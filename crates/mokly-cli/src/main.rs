//! Mokly binary composition root.

mod base_dependencies;
mod changes_base;
mod changes_runtime;
mod changes_static;
mod command_diagnostics;
mod entry;
mod entry_build;
mod entry_publish;
mod entry_serve;
mod interrupts;
mod one_shot;
mod publication_runtime;
mod render_runtime;
mod serve_candidates;
mod serve_capture_cancel;
mod serve_changes;
mod serve_changes_base;
mod serve_changes_native;
mod serve_controls;
mod serve_debounce;
mod serve_delivery;
mod serve_git;
mod serve_lifecycle;
mod serve_pool;
mod serve_preparation;
mod serve_progress;
mod serve_rebuild;
mod serve_rebuild_action;
mod serve_reporter;
mod serve_services;
mod serve_shutdown;
mod serve_signals;
mod serve_state;
mod serve_timing;
mod serve_trace;
mod serve_trace_cache;
mod serve_trace_stages;
mod serve_warnings;
mod serve_watch;
mod serve_watch_events;
mod static_runtime;
mod static_setup;
mod terminal;
mod viewer_assets;

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
