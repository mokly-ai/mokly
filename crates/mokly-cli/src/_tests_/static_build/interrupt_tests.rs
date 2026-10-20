//! A forced interruption waits for installation and cleanup to finish.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_model::output::artifact::Artifact;
use mokly_sidecar::workers::ClockMock;
use mokly_static::error::Result;
use mokly_static::transaction::{self, Transaction};
use unimock::{MockFn, Unimock, matching};

use crate::cancellation::{BuildCancellation, Cancellation};
use crate::static_build::{Request, StaticBuild};

use super::mocks::mocks_with_cancellation;
use super::support::{Case, config, options};

struct Interrupting {
    inner: Unimock,
    cancellation: Arc<dyn Cancellation>,
    cleanup: bool,
}

impl Interrupting {
    fn interrupt_twice(&self) {
        assert!(!self.cancellation.interrupt());
        assert!(
            !self.cancellation.interrupt(),
            "forced exit must wait for output settlement"
        );
    }
}

impl Transaction for Interrupting {
    fn output(&self) -> &Path {
        self.inner.output()
    }
    fn recovery_path(&self) -> &Path {
        self.inner.recovery_path()
    }
    fn protect(&mut self, paths: Vec<PathBuf>) -> Result<()> {
        self.inner.protect(paths)
    }
    fn stage(
        &self,
        artifact: &Artifact,
        cancellation: &dyn transaction::Cancellation,
    ) -> Result<()> {
        self.inner.stage(artifact, cancellation)
    }
    fn install(&self, cancellation: &dyn transaction::Cancellation) -> Result<()> {
        self.interrupt_twice();
        self.inner.install(cancellation)
    }
    fn abandon(&self) -> Result<()> {
        assert!(self.cleanup);
        self.interrupt_twice();
        self.inner.abandon()
    }
}

fn run(cleanup: bool) {
    let cancellation: Arc<dyn Cancellation> =
        Arc::new(BuildCancellation::new(Arc::new(Unimock::new((
            ClockMock::now_ms.next_call(matching!()).returns(0_u64),
            ClockMock::now_ms.next_call(matching!()).returns(1_000_u64),
            ClockMock::now_ms.next_call(matching!()).returns(2_000_u64),
        )))));
    let (builder, inner) = mocks_with_cancellation(
        Case {
            fail: if cleanup { "render" } else { "" },
            ..Default::default()
        },
        Arc::new(Mutex::new(Vec::new())),
        Some(cancellation.clone()),
    );
    let mut transaction = Interrupting {
        inner,
        cancellation: cancellation.clone(),
        cleanup,
    };
    let config = config();
    let options = options();
    let result = builder.build(
        Request {
            cwd: Path::new("/repo"),
            config: &config,
            options: &options,
            viewer: vec![],
            repository: Path::new("/repo"),
            publication: None,
            warnings_are_fatal: false,
        },
        &mut transaction,
    );
    assert_eq!(result.is_err(), cleanup);
    assert!(cancellation.requested());
    assert!(
        cancellation.interrupt(),
        "settlement must release forced exit"
    );
}

#[test]
fn installation_defers_forced_exit() {
    run(false);
}

#[test]
fn abandoned_output_cleanup_defers_forced_exit() {
    run(true);
}
