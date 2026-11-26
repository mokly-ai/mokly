//! A failed attachment stops the whole tree before the spawner reaps the
//! manager.

use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use mokly_compare::commands::{Command, Spawner};
use mokly_compare::error::{Error, InternalError};
use mokly_compare::process::SystemSpawner;
use mokly_git::control::SystemClock;
use mokly_platform::error;
use mokly_platform::processes::{
    AttachFailure, ProcessGroups, ProcessGroupsMock, SystemProcessGroups,
};
use unimock::{MockFn, Unimock, matching};

#[test]
fn a_failed_attachment_stops_the_unattached_tree() {
    let temporary = tempfile::tempdir().unwrap();
    let groups = Unimock::new((
        ProcessGroupsMock::configure
            .next_call(matching!(_))
            .answers(&|_, command| SystemProcessGroups.configure(command)),
        ProcessGroupsMock::attach
            .next_call(matching!(_))
            .answers(&|_, child| {
                Err(AttachFailure::new(
                    child,
                    error::Error::Locked {
                        path: "attach-probe".into(),
                    },
                ))
            }),
        ProcessGroupsMock::kill_unattached
            .next_call(matching!(_))
            .answers(&|_, child| SystemProcessGroups.kill_unattached(child)),
    ));
    let spawner = SystemSpawner {
        groups: Arc::new(groups),
        clock: Arc::new(SystemClock::default()),
    };
    let result = spawner.spawn(&Command {
        program: "node".into(),
        args: vec!["-e".into(), "setInterval(() => {}, 60000)".into()],
        scripts: true,
        directory: temporary.path().to_owned(),
        timeout: Duration::from_secs(120),
        byte_limit: None,
        size_root: None,
        cache: None,
        node: None,
    });
    let error = result.err().unwrap();
    assert!(
        matches!(&error, Error::Internal(InternalError::Platform { source: error::Error::Locked { path } })
            if path == Path::new("attach-probe")),
        "{error:?}"
    );
}
