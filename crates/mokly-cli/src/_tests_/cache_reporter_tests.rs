//! Cache lines escape data controls and preserve the structural line feed.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_catalogue::diagnostic::Warning;
use mokly_cli::build::BuildChanges;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_cli::static_build::{Phase, Phases};
use mokly_compare::cache_types::Reporter;
use mokly_compare::comparison_steps::Step;
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

#[test]
fn bundle_and_base_readers_share_one_command_directory_announcement() {
    let lines = Arc::new(Mutex::new(vec![]));
    let captured = lines.clone();
    let reporter = super::reporter(
        Arc::new(Notes(Unimock::new(
            NoteMock::note
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, text| {
                    captured.lock().unwrap().push(text.to_owned());
                })),
        ))),
        Style {
            mode: Mode::Plain,
            color: false,
            ascii: false,
            columns: 80,
        },
        Arc::new(Redactor::default()),
    );
    let bundles = reporter.clone();
    let bases = reporter.clone();
    bundles.opened(Path::new("/cache/project"));
    bases.opened(Path::new("/cache/project"));
    assert_eq!(*lines.lock().unwrap(), ["Mokly cache: /cache/project\n"]);
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
    fn step(&self, _: Step) {
        panic!("unexpected step");
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
