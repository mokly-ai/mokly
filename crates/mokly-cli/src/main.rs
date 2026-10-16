//! Mokly binary composition root.

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
mod serve_controls;
mod serve_debounce;
mod serve_lifecycle;
mod serve_preparation;
mod serve_rebuild;
mod serve_reporter;
mod serve_services;
mod serve_shutdown;
mod serve_signals;
mod serve_state;
mod serve_timing;
mod serve_trace;
mod serve_watch;
mod serve_watch_events;
mod static_runtime;
mod static_setup;
mod terminal;
mod viewer_assets;

fn main() -> std::process::ExitCode {
    entry::main()
}
