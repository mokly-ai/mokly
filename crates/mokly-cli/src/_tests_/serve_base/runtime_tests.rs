//! Kept base services ignore replaced classifications and captures until command stop.

use std::path::Path;
use std::sync::Arc;

use mokly_cli::cancellation::Cancellation;
use mokly_cli::cancelled_work::CancellableTree;
use mokly_compare::base_render::BaseProvider;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_git::error;
use mokly_server::changes::{ChangeCancellation, ChangeSource, ChangeToken};
use mokly_sidecar::error::Error;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::ServePool;
use crate::serve_pool::serve_pool_support::capacity;
use crate::warning_support::config;

use super::runtime_support::{call, git, source};
use super::support::{Fixture, base, head, inputs, runtime, selected};

#[test]
fn keep_detaches_git_source_pool_and_workers_until_command_stop() {
    let fixture = Fixture::new(
        Arc::default(),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        runtime(),
    );
    let (_git, runner) = git(&fixture);
    let tree = CancellableTree {
        inner: Arc::new(Unimock::new(
            SourceTreeMock::read
                .each_call(matching!(_))
                .answers(&|_, _| Ok(b"document".to_vec())),
        )),
        cancellation: fixture.lifetime.clone(),
    };
    let pool = Arc::new(ServePool::new(
        Arc::new(Unimock::new(
            PoolMock::request
                .each_call(matching!(_))
                .answers(&|_, _| Ok(MethodResult::Empty)),
        )),
        capacity(1),
    ));
    let source = source(&fixture, pool);
    let runtime = source.classification_runtime(fixture.lifetime.clone());
    let config = config();
    let selected = selected("a");
    let head = head(false);
    let kept = fixture
        .provider
        .keep(
            &BaseRetentionRequest {
                selected: &selected,
                working_config: &config,
                head: head.as_ref(),
                install_scripts: false,
            },
            base(Some(inputs(false))),
        )
        .unwrap();
    assert!(kept.is_some());
    fixture.origin.cancel();
    let capture = Arc::new(ChangeToken::default());
    let _scope = source.capture_scope(capture.clone()).unwrap();
    capture.cancel();
    let document = tree.read(Path::new("/repo/index.html"));
    assert!(
        matches!(&document, Ok(bytes) if bytes == b"document"),
        "kept source read must succeed: {document:?}"
    );
    assert!(runner.checkpoint().is_ok());
    assert!(matches!(
        runtime.pool.request(call()),
        Ok(MethodResult::Empty)
    ));
    assert!(!runtime.workers.cancelled());
    fixture.command.interrupt();
    assert!(matches!(
        tree.read(Path::new("/repo/index.html")),
        Err(SourceError::Cancelled { .. })
    ));
    assert!(matches!(runner.checkpoint(), Err(error::Error::Cancelled)));
    assert!(matches!(
        runtime.pool.request(call()),
        Err(Error::Cancelled)
    ));
    assert!(runtime.workers.cancelled());
}
