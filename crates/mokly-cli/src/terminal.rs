//! One injected terminal writer preserves line starts while raw input is active.

use std::io::{self, Write};
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg_attr(test, unimock::unimock(api = TerminalMock))]
pub(super) trait Terminal: Send + Sync {
    fn stdout(&self, text: &str);
    fn stderr(&self, text: &str);
    fn raw_mode(&self, enabled: bool);
}

#[derive(Default)]
pub(super) struct SystemTerminal {
    raw: AtomicBool,
}

impl Terminal for SystemTerminal {
    fn stdout(&self, text: &str) {
        let _ = io::stdout()
            .lock()
            .write_all(lines(text, self.raw.load(Ordering::SeqCst)).as_bytes());
    }
    fn stderr(&self, text: &str) {
        let _ = io::stderr()
            .lock()
            .write_all(lines(text, self.raw.load(Ordering::SeqCst)).as_bytes());
    }
    fn raw_mode(&self, enabled: bool) {
        self.raw.store(enabled, Ordering::SeqCst);
    }
}

fn lines(text: &str, raw: bool) -> String {
    if raw {
        text.replace("\r\n", "\n").replace('\n', "\r\n")
    } else {
        text.into()
    }
}

#[cfg(test)]
#[path = "_tests_/terminal_tests.rs"]
mod terminal_tests;
