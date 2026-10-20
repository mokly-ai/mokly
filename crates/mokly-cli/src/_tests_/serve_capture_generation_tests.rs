//! Replaced classification tokens reach the prepared base generation's workers.

use std::sync::{Arc, Mutex};

use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_cli::cancelled_work::CancellableWorkers;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::base_render::{BaseProvider, BaseRequest, HistoricalSources};
use mokly_git::identity::ObjectId;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::runtime_diagnostic::RuntimeCode;
use mokly_render::runtime::Runtime;
use mokly_server::changes::{ChangeCancellation, ChangeToken};
use mokly_sidecar::pool::SidecarPool;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::changes_base::NativeBase;
use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes::{ServeChanges, Source};
use crate::serve_changes_base::CombinedCancel;
use crate::serve_pool::PoolSchedulingMock;
use crate::warning_support::{catalogue, config, scopes};

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
    let terminal = Unimock::new(());
    let head = Arc::new(Runtime::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, _| Ok(None)),
        )),
        pool.clone(),
        Arc::new(Unimock::new(())),
        Arc::new(CancellableWorkers {
            inner: Arc::new(Unimock::new(())),
            cancellation: command.clone(),
        }),
        "test".into(),
        None,
    ));
    let source = Source {
        references: Mutex::new(None),
        operation,
        pending: Arc::new(Mutex::new(Vec::new())),
        config: config(),
        head: Arc::new(Unimock::new(())),
        warnings: scopes(&terminal).begin(),
        services: ServeChanges {
            sidecars: Arc::new(Unimock::new(
                PoolSchedulingMock::pool
                    .next_call(matching!(Some(_)))
                    .returns(pool),
            )),
            progress: Arc::new(Unimock::new(())),
            refreshes: Arc::new(Unimock::new(())),
            cache_announced: Arc::new(false.into()),
            warnings: Arc::new(Unimock::new(())),
            runtime: head.clone(),
            git: Arc::new(Unimock::new(())),
            cancellation: command.clone(),
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
            sources: HistoricalSources {
                tree,
                sources: Arc::new(Unimock::new(())),
                failures: Arc::new(Unimock::new(())),
            },
        })
        .unwrap();
    assert!(generation.check_cancelled().is_ok());
    run.cancel();
    assert!(matches!(
        generation.check_cancelled(),
        Err(GraphError::Runtime { source }) if source.code == RuntimeCode::Cancelled
    ));
    assert!(!command.requested());
    assert!(!head.workers.cancelled());
}
