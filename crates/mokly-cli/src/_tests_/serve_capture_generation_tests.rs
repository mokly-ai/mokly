//! Replaced classification tokens reach the prepared base generation's workers.

use std::sync::{Arc, Mutex};
use std::thread;

use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_cli::cancelled_work::CancellableWorkers;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::base_render::{BaseProvider, BaseRequest, HistoricalSources};
use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_git::identity::ObjectId;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGenerationMock;
use mokly_graph::workers::{RenderWorkers, StylesheetWorker, ThreadWorkers};
use mokly_model::runtime_diagnostic::RuntimeCode;
use mokly_render::runtime::Runtime;
use mokly_server::changes::{ChangeCancellation, ChangeToken};
use mokly_sidecar::pool::SidecarPool;
use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::changes_base::NativeBase;
use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes::{ServeChanges, Source};
use crate::serve_changes_base::CombinedCancel;
use crate::serve_pool::PoolSchedulingMock;
use crate::warning_support::{catalogue, config, scopes};

fn source(
    head: Arc<Runtime>,
    pool: Arc<dyn SidecarPool>,
    operation: Arc<CaptureCancellation>,
    command: Arc<ServeCancellation>,
    terminal: &Unimock,
) -> Source {
    Source {
        references: Mutex::new(None),
        operation,
        pending: Arc::new(Mutex::new(Vec::new())),
        config: config(),
        head: Arc::new(Unimock::new(())),
        warnings: scopes(terminal).begin(),
        services: ServeChanges {
            sidecars: Arc::new(Unimock::new(
                PoolSchedulingMock::pool
                    .next_call(matching!(Some(_)))
                    .returns(pool),
            )),
            progress: Arc::new(Unimock::new(())),
            refreshes: Arc::new(Unimock::new(())),
            cache_announced: Arc::new(false.into()),
            extraction_snapshots: Arc::new(
                mokly_compare::extraction_snapshots::ProcessSnapshots::default(),
            ),
            warnings: Arc::new(Unimock::new(())),
            runtime: head,
            git: Arc::new(Unimock::new(())),
            cancellation: command,
            terminal: Arc::new(Unimock::new(())),
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

fn head(
    pool: Arc<dyn SidecarPool>,
    workers: Arc<dyn RenderWorkers>,
    dependencies: Arc<dyn SourceTree>,
) -> Arc<Runtime> {
    Arc::new(Runtime::new(
        Arc::new(Unimock::new(())),
        dependencies,
        pool,
        Arc::new(Unimock::new(())),
        workers,
        "test".into(),
        None,
    ))
}

#[test]
fn replaced_run_cancels_a_prepared_base_generation_without_cancelling_the_command() {
    let command = Arc::new(ServeCancellation::default());
    let run = Arc::new(ChangeToken::default());
    let operation = Arc::new(CaptureCancellation::default());
    let cancellation = Arc::new(CombinedCancel {
        operation: operation.clone(),
        command: command.clone(),
        generation: run.clone(),
    });
    let pool: Arc<dyn SidecarPool> = Arc::new(Unimock::new(()));
    let head = head(
        pool.clone(),
        Arc::new(CancellableWorkers {
            inner: Arc::new(Unimock::new(())),
            cancellation: command.clone(),
        }),
        Arc::new(Unimock::new(
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, _| Ok(None)),
        )),
    );
    let terminal = Unimock::new(());
    let source = source(head.clone(), pool, operation, command.clone(), &terminal);
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, _| Ok(None)),
        SourceTreeMock::prefetch
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
    )));
    let provider = NativeBase {
        runtime: source.classification_runtime(cancellation.clone()),
        cancellation,
        dependencies: Arc::new(Unimock::new(())),
    };
    let generation = provider
        .prepare(&BaseRequest {
            head: &Unimock::new(
                RenderGenerationMock::catalogue
                    .next_call(matching!())
                    .returns(catalogue(vec![])),
            ),
            working_config: &source.config,
            repository: Arc::new(Unimock::new(())),
            commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
            install_scripts: false,
            sources: HistoricalSources {
                tree,
                sources: Arc::new(Unimock::new(())),
                failures: Arc::new(Unimock::new(())),
            },
        })
        .unwrap();
    assert!(generation.generation.check_cancelled().is_ok());
    run.cancel();
    assert!(matches!(
        generation.generation.check_cancelled(),
        Err(GraphError::Runtime { source }) if source.code == RuntimeCode::Cancelled
    ));
    assert!(!command.requested());
    assert!(!head.workers.cancelled());
}

/// Records the thread of each stylesheet job.
#[derive(Default)]
struct Threads(Mutex<Vec<thread::ThreadId>>);

impl StylesheetWorker for Threads {
    fn stylesheet(&self, root: &StylesheetRoot) -> mokly_graph::error::Result<Bundle> {
        self.0.lock().unwrap().push(thread::current().id());
        Ok(Bundle {
            read_evidence: Default::default(),
            route: format!("styles/{}", root.path),
            css: String::new(),
            assets: Default::default(),
            css_modules: Default::default(),
            inputs: Default::default(),
            imported_by: Default::default(),
            repository_aliases: Default::default(),
            dependency_digests: Default::default(),
            plugin_inputs: Default::default(),
            directories: Vec::new(),
        })
    }
}

fn root(path: &str) -> StylesheetRoot {
    StylesheetRoot {
        path: path.into(),
        stylesheets: vec![path.into()],
        excluded: Default::default(),
        local_css: true,
    }
}

#[test]
fn background_base_workers_bundle_stylesheet_roots_on_the_classification_thread() {
    let command = Arc::new(ServeCancellation::default());
    let operation = Arc::new(CaptureCancellation::default());
    let cancellation = Arc::new(CombinedCancel {
        operation: operation.clone(),
        command: command.clone(),
        generation: Arc::new(ChangeToken::default()),
    });
    let pool: Arc<dyn SidecarPool> = Arc::new(Unimock::new(()));
    let head = head(
        pool.clone(),
        Arc::new(CancellableWorkers {
            inner: Arc::new(ThreadWorkers::new(4).unwrap()),
            cancellation: command.clone(),
        }),
        Arc::new(Unimock::new(())),
    );
    let terminal = Unimock::new(());
    let source = source(head, pool, operation, command, &terminal);
    let jobs = Threads::default();
    let bundles = source
        .classification_runtime(cancellation)
        .workers
        .stylesheets(&[root("a.css"), root("b.css")], &jobs)
        .unwrap();
    assert_eq!(bundles.len(), 2);
    let current = thread::current().id();
    assert!(
        jobs.0
            .lock()
            .unwrap()
            .iter()
            .all(|thread| *thread == current)
    );
}
