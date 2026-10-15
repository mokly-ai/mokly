//! Mokly binary composition root.

mod entry;
mod entry_publish;
mod entry_serve;
mod interrupts;
mod render_runtime;
mod serve_candidates;
mod serve_controls;
mod serve_rebuild;
mod serve_reporter;
mod serve_services;
mod serve_shutdown;
mod serve_signals;
mod serve_state;
mod serve_timing;
mod serve_trace;
mod terminal;

fn main() -> std::process::ExitCode {
    entry::main()
}
