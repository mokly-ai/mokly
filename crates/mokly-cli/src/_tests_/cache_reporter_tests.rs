//! Cache lines escape data controls and preserve the structural line feed.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::diagnostic::Warning;
use mokly_cli::build::BuildChanges;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_cli::static_build::{Phase, Phases};
use mokly_compare::cache_types::Reporter;
use unimock::{MockFn, Unimock, matching};

use super::CacheReporter;

#[test]
fn plain_cache_announcement_is_redacted_and_ends_with_a_real_line_feed() {
    let reporter: &dyn Reporter = &CacheReporter {
        phases: Arc::new(Notes(Unimock::new(
            NoteMock::note
                .next_call(matching!("Mokly cache: /cache/[redacted]\\u001b[31m\n"))
                .returns(()),
        ))),
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

#[unimock::unimock(api = NoteMock)]
trait Note {
    fn note(&self, message: &str);
}
struct Notes(Unimock);
impl Phases for Notes {
    fn note(&self, message: &str) {
        Note::note(&self.0, message);
    }
    fn start(&self, _: Phase) {
        panic!("unexpected phase");
    }
    fn diagnostic(&self, _: &str) {
        panic!("unexpected diagnostic");
    }
    fn warnings(&self, _: &[Warning]) {
        panic!("unexpected warnings");
    }
    fn changes(&self, _: &BuildChanges) {
        panic!("unexpected Changes");
    }
}
