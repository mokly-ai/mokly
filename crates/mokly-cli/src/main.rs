//! Mokly binary composition root.

mod entry;
mod entry_publish;
mod interrupts;
mod render_runtime;

fn main() -> std::process::ExitCode {
    entry::main()
}
