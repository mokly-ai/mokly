//! A moved tip only invalidates Changes when its resolved merge base moves, and the
//! classification of an attempt uses the merge base of its own reference read.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::comparison_reuse::MemoryComparisons;
use mokly_compare::comparison_steps::Step;
use mokly_compare::error::Error;
use mokly_compare::extraction_snapshots::ProcessSnapshots;
use mokly_git::command::{Output, ProcessMode, Runner, RunnerMock};
use mokly_git::error;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGenerationMock;
use mokly_render::runtime::Runtime;
use mokly_server::changes::{ChangeSource, ChangeToken};
use mokly_server::error::ServerError;
use mokly_sidecar::pool::SidecarPool;
use unimock::{MockFn, Unimock, matching};

use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes::{ServeChanges, Source};
use crate::serve_git::{GitWork, GitWorkMock};
use crate::serve_pool::{PoolScheduling, PoolSchedulingMock};
use crate::serve_progress::{Progress, ProgressMock};
use crate::warning_support::{config, scopes};

const HEAD: &str = "1111111111111111111111111111111111111111";
const TIP: &str = "2222222222222222222222222222222222222222";
const MERGE_BASE: &str = "3333333333333333333333333333333333333333";

#[test]
fn moved_and_restored_tips_keep_the_resolved_merge_base_identity() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let observed = calls.clone();
    let outputs = Mutex::new(
        [
            "head-1", "tip", "base-1", "head-2", "tip", "base-1", "head-2", "tip", "head-2",
            "new-tip", "base-2", "head-2", "tip", "base-1", "head-1", "tip", "base-1",
        ]
        .into_iter(),
    );
    let runner: Arc<dyn Runner> = Arc::new(Unimock::new(
        RunnerMock::run
            .each_call(matching!((request) if request.process_mode == ProcessMode::PlainGroup))
            .answers_arc(Arc::new(move |_, request| {
                observed.lock().unwrap().push(request.args.clone());
                Ok(Output {
                    stdout: outputs.lock().unwrap().next().unwrap().as_bytes().into(),
                    stderr: Vec::new(),
                })
            }))
            .n_times(17),
    ));
    let git = Unimock::new(
        GitWorkMock::runner
            .each_call(matching!(_))
            .returns(runner)
            .n_times(6),
    );
    let terminal = Unimock::new(());
    let source = source(
        config(),
        Arc::new(git),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        &terminal,
    );
    for expected in ["base-1", "base-1", "base-1", "base-2", "base-1", "base-1"] {
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
            vec!["tip", "head-1"],
            vec!["tip", "head-2"],
            vec!["new-tip", "head-2"],
            vec!["tip", "head-2"],
            vec!["tip", "head-1"]
        ]
    );
}

#[test]
fn an_attempt_resolves_the_base_once_and_classifies_against_the_merge_base_of_its_reference_read() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let calls = Arc::new(Mutex::new(Vec::new()));
    let observed = calls.clone();
    let toplevel = root.clone();
    let runner: Arc<dyn Runner> = Arc::new(Unimock::new(
        RunnerMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request| {
                let args: Vec<String> = request
                    .args
                    .iter()
                    .map(|arg| arg.to_string_lossy().into_owned())
                    .collect();
                observed.lock().unwrap().push(args.clone());
                answer(&args, &toplevel)
            })),
    ));
    let pool: Arc<dyn SidecarPool> = Arc::new(Unimock::new(()));
    let sidecars = Unimock::new((
        PoolSchedulingMock::pool
            .some_call(matching!(Some(_)))
            .returns(pool),
        PoolSchedulingMock::limit
            .some_call(matching!())
            .returns(1_usize),
    ));
    let progress = Unimock::new(
        ProgressMock::step
            .some_call(matching!(_, Step::Reading))
            .returns(()),
    );
    let git = Unimock::new(GitWorkMock::runner.each_call(matching!(_)).returns(runner));
    let mut config = config();
    config.file = root.join("mokly.config.json");
    config.repo_root = root;
    let terminal = Unimock::new(());
    let mut source = source(
        config,
        Arc::new(git),
        Arc::new(progress),
        Arc::new(sidecars),
        &terminal,
    );
    source.head = Arc::new(Unimock::new(
        RenderGenerationMock::validate_head
            .some_call(matching!(_))
            .answers(&|_, _| {
                Err(GraphError::InputsChanged {
                    path: "head.html".into(),
                })
            }),
    ));
    let merge_base = source.references(Arc::new(ChangeToken::default())).unwrap();
    let failure = match source.classify(
        Arc::new(ChangeToken::default()),
        Arc::new(Unimock::new(())),
        &merge_base,
    ) {
        Err(ServerError::Comparison { source }) => *source,
        Err(error) => panic!("unexpected classification failure: {error}"),
        Ok(_) => panic!("the failed base read must fail the classification"),
    };
    let commit = match failure {
        Error::Base { commit, .. } => commit,
        error => panic!("unexpected comparison failure: {error}"),
    };
    assert_eq!(commit, MERGE_BASE);
    let resolutions: Vec<_> = calls
        .lock()
        .unwrap()
        .iter()
        .filter(|args| {
            args.iter()
                .any(|arg| arg == "--verify" || arg == "merge-base")
        })
        .cloned()
        .collect();
    assert_eq!(
        resolutions,
        [
            vec![
                "--no-optional-locks",
                "rev-parse",
                "--verify",
                "--end-of-options",
                "HEAD^{commit}"
            ],
            vec![
                "--no-optional-locks",
                "rev-parse",
                "--verify",
                "--end-of-options",
                "origin/main^{commit}"
            ],
            vec!["--no-optional-locks", "merge-base", TIP, HEAD],
        ]
    );
}

/// Answer the reference read and the repository open; every base read fails.
fn answer(args: &[String], root: &Path) -> error::Result<Output> {
    let stdout = match args.last().map(String::as_str) {
        Some("HEAD^{commit}") => format!("{HEAD}\n"),
        Some("origin/main^{commit}") => format!("{TIP}\n"),
        Some("--show-toplevel") => format!("{}\n", root.display()),
        _ if args.iter().any(|arg| arg == "merge-base") => format!("{MERGE_BASE}\n"),
        _ if args.iter().any(|arg| arg == "--get-regexp") => String::new(),
        _ => return Err(error::Error::MalformedOutput),
    };
    Ok(Output {
        stdout: stdout.into_bytes(),
        stderr: Vec::new(),
    })
}

/// A Serve change source whose Git, progress, and sidecar boundaries each test supplies.
fn source(
    config: ResolvedConfig,
    git: Arc<dyn GitWork>,
    progress: Arc<dyn Progress>,
    sidecars: Arc<dyn PoolScheduling>,
    terminal: &Unimock,
) -> Source {
    Source {
        preparation: None,
        references: Mutex::new(None),
        staging: Mutex::new(None),
        operation: Arc::new(CaptureCancellation::default()),
        pending: Arc::new(Mutex::new(Vec::new())),
        config,
        head: Arc::new(Unimock::new(())),
        warnings: scopes(terminal).begin(),
        services: ServeChanges {
            routing: None,
            eager: None,
            diagnostics: Arc::new(Unimock::new(())),
            reuse: Arc::new(MemoryComparisons::new(32 * 1024 * 1024)),
            kept_base: Arc::default(),
            sidecars,
            progress,
            cache_announced: Arc::new(false.into()),
            extraction_snapshots: Arc::new(ProcessSnapshots::default()),
            refreshes: Arc::new(Unimock::new(())),
            warnings: Arc::new(Unimock::new(())),
            runtime: Arc::new(Runtime::new(
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                "test".into(),
                None,
            )),
            git,
            cancellation: Arc::new(ServeCancellation::default()),
            terminal: Arc::new(terminal.clone()),
            style: Style {
                mode: Mode::Plain,
                color: false,
                ascii: true,
                columns: 120,
            },
            redactor: Arc::new(Redactor::default()),
            base: None,
            install_scripts: None,
        },
    }
}
