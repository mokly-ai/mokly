//! Configuration and output reservation precede Git and all renderer services.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoader;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_static::location::{self, Boundary};
use mokly_static::transaction::{Transaction, Transactions};

use crate::build::BuildError;
use crate::cancellation::Cancellation;
use crate::grammar::Build;
use crate::pre_installation;

/// Validated configuration and its operation-owned reservation.
pub struct Admitted {
    /// Loaded once before reservation.
    pub config: ResolvedConfig,
    /// Every later failure settles this transaction.
    pub transaction: Box<dyn Transaction>,
}

/// One output admission boundary consumed through dyn at command composition.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = AdmissionMock))]
pub trait Admission: Send + Sync {
    /// Load, check cancellation, and reserve before returning control to Git or rendering.
    fn open(&self, cwd: &Path, options: &Build, publication: bool) -> Result<Admitted, BuildError>;
}

/// Host-independent admission coordinator with narrow injected boundaries.
pub struct OutputAdmission {
    /// Configuration loader, using the command's captured source view.
    pub config: Arc<dyn ConfigLoader>,
    /// Destination ownership and writer serialization.
    pub transactions: Arc<dyn Transactions>,
    /// Delivered signal notifications.
    pub cancellation: Arc<dyn Cancellation>,
    /// Installed package and binary directories, captured by the composition root.
    pub runtime_roots: Vec<PathBuf>,
}
impl Admission for OutputAdmission {
    fn open(&self, cwd: &Path, options: &Build, publication: bool) -> Result<Admitted, BuildError> {
        let loaded = match self.config.load(cwd, options.common.config.as_deref()) {
            Ok(config) => Ok(config),
            Err(source) => Err(BuildError::Catalogue { source }),
        };
        let config = pre_installation::settle(loaded, self.cancellation.as_ref())?;
        let directory = location::output(&config, options.out.as_deref());
        let allowed = if publication {
            directory.parent().unwrap_or(&config.repo_root)
        } else {
            &config.repo_root
        };
        let mut boundary = Boundary::catalogue(&config, allowed.into());
        boundary.roots.extend(self.runtime_roots.clone());
        let _protection = self
            .cancellation
            .protect_output()
            .ok_or(BuildError::Cancelled)?;
        let transaction = match self.transactions.open(&directory, boundary) {
            Ok(transaction) => transaction,
            Err(source) => return Err(BuildError::Static { source }),
        };
        Ok(Admitted {
            config,
            transaction,
        })
    }
}

#[cfg(test)]
#[path = "_tests_/static_admission_tests.rs"]
mod static_admission_tests;
