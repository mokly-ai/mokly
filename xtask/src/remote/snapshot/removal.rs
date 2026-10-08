//! Every owned cleanup step runs even after another boundary fails or panics.

use std::panic::{AssertUnwindSafe, catch_unwind};

use crate::remote::error::{Error, Result};
use crate::remote::snapshot::contracts::{Ownership, SnapshotHandle};
use crate::remote::snapshot::system::SystemSnapshot;

impl SystemSnapshot {
    /// Remove only acquired resources and retain the first typed cleanup cause.
    pub(super) fn remove_owned(&self, handle: &SnapshotHandle) -> Result<()> {
        if handle.ownership == Ownership::None {
            return Ok(());
        }
        let mut failure = None;
        if handle.ownership == Ownership::Linked {
            self.cleanup_step(&mut failure, || {
                self.git(
                    vec![
                        "worktree".into(),
                        "remove".into(),
                        "--force".into(),
                        "--force".into(),
                        handle.directory.to_string_lossy().into_owned(),
                    ],
                    &self.workspace,
                    None,
                )?;
                Ok(())
            });
        } else {
            self.cleanup_step(&mut failure, || {
                self.files.remove_directory(&handle.directory)
            });
        }
        self.cleanup_step(&mut failure, || {
            self.git(
                vec!["worktree".into(), "prune".into()],
                &self.workspace,
                None,
            )?;
            Ok(())
        });
        if matches!(handle.ownership, Ownership::Indexed | Ownership::Linked) {
            self.cleanup_step(&mut failure, || self.files.remove_index(&handle.index));
        }
        match failure {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }

    /// A panic at one dependency must not block the remaining cleanup operations.
    fn cleanup_step(&self, failure: &mut Option<Error>, operation: impl FnOnce() -> Result<()>) {
        let result = match catch_unwind(AssertUnwindSafe(operation)) {
            Ok(result) => result,
            Err(_) => Err(Error::Worker),
        };
        if let Err(error) = result {
            failure.get_or_insert(error);
        }
    }
}
