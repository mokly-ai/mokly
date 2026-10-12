//! Snapshot identity preparation before any box can warm up.

use std::path::PathBuf;

use crate::remote::cleanup::contracts::BoxCleanup;
use crate::remote::error::{Error, Result};
use crate::remote::git_identity::BaseLookup;
use crate::remote::identity::{RunId, RunIdentity};
use crate::remote::runner::DefaultRemoteRunner;
use crate::remote::snapshot::guard::SnapshotOwner;

/// One complete preparation identity and its owned synchronization source.
pub(super) struct PreparedRun {
    /// Checkout identity, pushed base, ahead count and source fingerprint.
    pub(super) identity: RunIdentity,
    /// Detached worktree used for probes and all suite commands.
    pub(super) snapshot: PathBuf,
}

impl DefaultRemoteRunner {
    /// Build and compare the snapshot before identity evidence and warmup.
    pub(super) fn prepare(
        &self,
        boxes: &mut Vec<String>,
        cleanup: &dyn BoxCleanup,
        owner: &dyn SnapshotOwner,
    ) -> Result<PreparedRun> {
        let dependencies = &self.dependencies;
        let head = dependencies.git.head()?;
        let base = match dependencies.git.base(&head)? {
            BaseLookup::Found(base) => base,
            BaseLookup::NoBase => return Err(Error::NoBase),
        };
        let run = RunId::new(&dependencies.clock.stamp(), dependencies.environment.pid())?;
        let snapshot = owner.create(&run, &base.sha)?;
        if dependencies.interrupt.requested() {
            return Err(Error::Interrupted { cleanup: 0 });
        }
        let fingerprint = self.fingerprint(&dependencies.workspace)?;
        let captured = self.fingerprint(&snapshot)?;
        if captured != fingerprint {
            return Err(Error::SnapshotFingerprint {
                expected: fingerprint,
                actual: captured,
            });
        }
        let identity = RunIdentity::new(run, head, base, &fingerprint)?;
        dependencies.logs.prepare(identity.run().as_str())?;
        let reference = match dependencies.environment.get("MOKLY_TESTBOX_REF") {
            Some(reference) => reference,
            None => "main".to_owned(),
        };
        dependencies.reporter.executor(&format!(
            "information: run={} ref={reference} HEAD={} base={} ahead={}",
            identity.run(),
            identity.head(),
            identity.base().sha,
            identity.base().ahead
        ));
        dependencies.logs.write_identity(&identity)?;
        self.warmup(&reference, boxes, cleanup)?;
        self.probe(
            boxes,
            identity.fingerprint(),
            identity.base().sha.as_str(),
            &snapshot,
            cleanup,
        )?;
        dependencies
            .reporter
            .executor("information: all 11 probes passed");
        Ok(PreparedRun { identity, snapshot })
    }
}
