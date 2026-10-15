//! Mokly binary composition root.

mod entry;
mod entry_publish;

fn main() -> std::process::ExitCode {
    entry::main()
}
