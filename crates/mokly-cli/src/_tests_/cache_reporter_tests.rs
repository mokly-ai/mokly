//! Cache lines escape data controls and preserve the structural line feed.

use std::path::Path;
use std::sync::Arc;

use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::cache_types::Reporter;
use unimock::{MockFn, Unimock, matching};

use crate::terminal::TerminalMock;

use super::CacheReporter;

#[test]
fn plain_cache_announcement_is_redacted_and_ends_with_a_real_line_feed() {
    let reporter: &dyn Reporter = &CacheReporter {
        terminal: Arc::new(Unimock::new(
            TerminalMock::stdout
                .next_call(matching!("Mokly cache: /cache/[redacted]\\u001b[31m\n"))
                .returns(()),
        )),
        style: Style {
            mode: Mode::Plain,
            color: false,
            ascii: false,
            columns: 20,
        },
        redactor: Arc::new(Redactor::collect(&[], Some("token"))),
    };
    reporter.opened(Path::new("/cache/token\u{1b}[31m"));
}
