//! A moved tip only invalidates Changes when its resolved merge base moves.

use std::sync::{Arc, Mutex};

use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_git::command::{Output, Runner, RunnerMock};
use mokly_render::runtime::Runtime;
use mokly_server::changes::{ChangeSource, ChangeToken};
use unimock::{MockFn, Unimock, matching};

use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes::{ServeChanges, Source};
use crate::serve_git::GitWorkMock;
use crate::warning_support::{config, scopes};

#[test]
fn moved_head_with_equal_merge_base_keeps_the_classification_identity() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let observed = calls.clone();
    let outputs = Mutex::new(
        [
            "head-1", "tip", "base-1", "head-2", "tip", "base-1", "head-2", "tip", "head-2",
            "new-tip", "base-2",
        ]
        .into_iter(),
    );
    let runner: Arc<dyn Runner> = Arc::new(Unimock::new(
        RunnerMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request| {
                observed.lock().unwrap().push(request.args.clone());
                Ok(Output {
                    stdout: outputs.lock().unwrap().next().unwrap().as_bytes().into(),
                    stderr: Vec::new(),
                })
            }))
            .n_times(11),
    ));
    let terminal = Unimock::new(());
    let source = Source {
        references: Mutex::new(None),
        operation: Arc::new(CaptureCancellation::default()),
        pending: Arc::new(Mutex::new(Vec::new())),
        config: config(),
        head: Arc::new(Unimock::new(())),
        warnings: scopes(&terminal).begin(),
        services: ServeChanges {
            sidecars: Arc::new(Unimock::new(())),
            progress: Arc::new(Unimock::new(())),
            cache_announced: Arc::new(false.into()),
            refreshes: Arc::new(Unimock::new(())),
            warnings: Arc::new(Unimock::new(())),
            runtime: Arc::new(Runtime::new(
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                "test".into(),
                None,
            )),
            git: Arc::new(Unimock::new(
                GitWorkMock::runner
                    .each_call(matching!(_))
                    .returns(runner)
                    .n_times(4),
            )),
            cancellation: Arc::new(ServeCancellation::default()),
            terminal: Arc::new(Unimock::new(())),
            style: Style {
                mode: Mode::Plain,
                color: false,
                ascii: true,
                columns: 120,
            },
            redactor: Arc::new(Redactor::default()),
            base: None,
        },
    };
    for expected in ["base-1", "base-1", "base-1", "base-2"] {
        assert_eq!(
            source.references(Arc::new(ChangeToken::default())).unwrap(),
            expected
        );
    }
    let calls = calls.lock().unwrap();
    let bases: Vec<_> = calls
        .iter()
        .filter(|args| args[1] == "merge-base")
        .map(|args| args[2..].to_vec())
        .collect();
    assert_eq!(
        bases,
        vec![
            vec!["head-1", "tip"],
            vec!["head-2", "tip"],
            vec!["head-2", "new-tip"]
        ]
    );
}
