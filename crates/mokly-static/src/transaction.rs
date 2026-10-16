//! Staging, exclusive installation, rollback, and retained recovery failures.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_model::output::artifact::Artifact;
use mokly_platform::rename::Rename;

use crate::error::{Error, InternalError, Result};
use crate::filesystem::{Entry, Files, Identity};
use crate::location::{self, Boundary};
use crate::{artifact, ownership, reservation};

/// Command cancellation; the commit rename and cleanup never consult it.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CancellationMock))]
pub trait Cancellation: Send + Sync {
    /// Drain delivered notifications before answering where the host requires it.
    fn requested(&self) -> bool;
}

/// Operation-owned transaction. The caller must settle it on every outcome.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = TransactionMock))]
pub trait Transaction: Send + Sync {
    /// Pinned physical output, independent of later symlink retargeting.
    fn output(&self) -> &Path;
    /// Exact operation-owned reservation for actionable cleanup diagnostics.
    fn recovery_path(&self) -> &Path;
    /// Validate added source protections before rendering or installation.
    fn protect(&mut self, inputs: Vec<PathBuf>) -> Result<()>;
    /// Write immutable bytes, validate, then install after the caller drains rendering.
    fn stage(&self, artifact: &Artifact, cancellation: &dyn Cancellation) -> Result<()>;
    /// Commit the prepared stage; all recovery is settled before returning.
    fn install(&self, cancellation: &dyn Cancellation) -> Result<()>;
    /// Abandon a pre-installation operation and clean its stage exactly once.
    fn abandon(&self) -> Result<()>;
}

/// Output admission boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = TransactionsMock))]
pub trait Transactions: Send + Sync {
    /// Validate ownership and reserve a safe destination before consumer code runs.
    fn open(&self, output: &Path, boundary: Boundary) -> Result<Box<dyn Transaction>>;
}

/// Transaction factory with independently mockable filesystem and rename primitives.
pub struct OutputTransactions {
    /// Non-following filesystem boundary.
    pub files: Arc<dyn Files>,
    /// OS-enforced exclusive rename.
    pub rename: Arc<dyn Rename>,
}

struct OutputTransaction {
    files: Arc<dyn Files>,
    rename: Arc<dyn Rename>,
    requested: PathBuf,
    output: PathBuf,
    reservation: PathBuf,
    identity: Option<Identity>,
    boundary: Boundary,
}

impl Transactions for OutputTransactions {
    fn open(&self, requested: &Path, mut boundary: Boundary) -> Result<Box<dyn Transaction>> {
        if boundary.lexical_allowed.is_none() && !requested.starts_with(&boundary.allowed) {
            let real_root = self.files.project(&boundary.allowed)?;
            for ancestor in requested.ancestors().skip(1) {
                if self.files.project(ancestor)? == real_root {
                    boundary.lexical_allowed = Some(ancestor.into());
                }
            }
        }
        let output = location::validate(self.files.as_ref(), requested, &boundary)?;
        let owned = ownership::validate(self.files.as_ref(), &output)?;
        let identity = owned.map(|owned| owned.identity);
        let reservation = reservation::acquire(self.files.as_ref(), &output)?;
        let transaction = OutputTransaction {
            files: self.files.clone(),
            rename: self.rename.clone(),
            requested: requested.into(),
            output,
            reservation,
            identity,
            boundary,
        };
        if let Err(error) = transaction.recheck() {
            return transaction.failure(error);
        }
        Ok(Box::new(transaction))
    }
}

impl OutputTransaction {
    fn recheck(&self) -> Result<()> {
        let output = location::validate(self.files.as_ref(), &self.requested, &self.boundary)?;
        if output != self.output {
            return Err(Error::Replaced {
                path: self.output.clone(),
            });
        }
        let identity =
            ownership::validate(self.files.as_ref(), &self.output)?.map(|owned| owned.identity);
        if identity != self.identity {
            return Err(Error::Replaced {
                path: self.output.clone(),
            });
        }
        Ok(())
    }
    fn move_exclusive(&self, source: &Path, destination: &Path) -> Result<()> {
        match self.rename.exclusive(source, destination) {
            Ok(()) => Ok(()),
            Err(source) => Err(InternalError::Rename { source }.into()),
        }
    }
    fn failure<T>(&self, primary: Error) -> Result<T> {
        match self.abandon() {
            Ok(()) => Err(primary),
            Err(cleanup) => Err(Error::Recovery {
                primary: Box::new(primary),
                cleanup: Box::new(cleanup),
                path: self.reservation.clone(),
            }),
        }
    }
    #[tracing::instrument(name = "output.rollback", skip_all, err)]
    fn restore(&self, primary: Error) -> Result<()> {
        let backup = self.reservation.join("backup");
        let result = (|| {
            if !matches!(self.files.entry(&backup)?, Some(Entry::Directory(_)))
                || self.files.entry(&self.output)?.is_some()
            {
                return Err(Error::Unexpected {
                    path: backup.clone(),
                });
            }
            self.move_exclusive(&backup, &self.output)
        })();
        match result {
            Ok(()) => self.failure(primary),
            Err(cleanup) => Err(Error::Recovery {
                primary: Box::new(primary),
                cleanup: Box::new(cleanup),
                path: backup,
            }),
        }
    }
}

impl Transaction for OutputTransaction {
    fn output(&self) -> &Path {
        &self.output
    }
    fn recovery_path(&self) -> &Path {
        &self.reservation
    }
    fn protect(&mut self, inputs: Vec<PathBuf>) -> Result<()> {
        self.boundary.inputs.extend(inputs);
        self.recheck()
    }
    #[tracing::instrument(name = "output.stage", skip_all, err)]
    fn stage(&self, artifact: &Artifact, cancellation: &dyn Cancellation) -> Result<()> {
        artifact::validate(artifact)?;
        tracing::debug!(files = artifact.files.len(), "staging static output");
        if artifact.directory != self.output {
            return Err(Error::Replaced {
                path: self.output.clone(),
            });
        }
        let stage = self.reservation.join("stage");
        self.files.mkdir(&stage)?;
        for file in &artifact.files {
            if cancellation.requested() {
                return Err(Error::Cancelled);
            }
            let path = stage.join(&file.path);
            if let Some(parent) = path.parent() {
                location::directories(self.files.as_ref(), parent)?;
            }
            self.files.write(&path, &file.bytes)?;
        }
        Ok(())
    }
    #[tracing::instrument(name = "output.install", skip_all, err)]
    fn install(&self, cancellation: &dyn Cancellation) -> Result<()> {
        if let Err(error) = self.recheck() {
            return self.failure(error);
        }
        if cancellation.requested() {
            return self.failure(Error::Cancelled);
        }
        let backup = self.reservation.join("backup");
        if self.identity.is_some() {
            let capture = tracing::info_span!("output.capture");
            if let Err(error) = capture.in_scope(|| self.move_exclusive(&self.output, &backup)) {
                return self.failure(error);
            }
            let captured = ownership::validate(self.files.as_ref(), &backup);
            match captured {
                Ok(Some(owned)) if Some(&owned.identity) == self.identity.as_ref() => {}
                Ok(_) => {
                    return self.restore(Error::Replaced {
                        path: backup.clone(),
                    });
                }
                Err(error) => return self.restore(error),
            }
            if cancellation.requested() {
                return self.restore(Error::Cancelled);
            }
        }
        if let Err(error) = self.move_exclusive(&self.reservation.join("stage"), &self.output) {
            return if self.identity.is_some() {
                self.restore(error)
            } else {
                self.failure(error)
            };
        }
        let cleanup = (|| {
            if self.identity.is_some() {
                let owned =
                    ownership::validate(self.files.as_ref(), &backup)?.ok_or_else(|| {
                        Error::Replaced {
                            path: backup.clone(),
                        }
                    })?;
                if Some(&owned.identity) != self.identity.as_ref() {
                    return Err(Error::Replaced {
                        path: backup.clone(),
                    });
                }
                ownership::dispose(self.files.as_ref(), &backup, owned)?;
            }
            self.abandon()
        })();
        match cleanup {
            Ok(()) => Ok(()),
            Err(source) => Err(Error::Installed {
                source: Box::new(source),
                path: self.reservation.clone(),
            }),
        }
    }
    #[tracing::instrument(name = "output.cleanup", skip_all, err)]
    fn abandon(&self) -> Result<()> {
        reservation::cleanup(self.files.as_ref(), &self.reservation)
    }
}

impl std::fmt::Debug for dyn Cancellation + '_ {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("Cancellation")
    }
}

impl std::fmt::Debug for dyn Transaction + '_ {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("Transaction")
    }
}
