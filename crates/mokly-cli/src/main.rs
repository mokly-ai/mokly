//! Mokly binary composition root.

mod changes_runtime;
mod entry;
mod entry_publish;
mod render_runtime;

fn main() -> std::process::ExitCode {
    entry::main()
}
