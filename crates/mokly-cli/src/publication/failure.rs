//! Typed handoff for errors owned by static output and catalogue preparation.

use std::error;

use mokly_catalogue::error::CatalogueError;
use mokly_static::error::Error;

use crate::build::BuildError;
use crate::changes_diagnostics;
use crate::codes::Code;

/// Stable categories preserved through publication.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Category {
    /// Catalogue validation or rendering failed.
    BuildInvalid,
    /// Invalid configuration.
    ConfigInvalid,
    /// Configuration discovery found no configuration.
    ConfigMissing,
    /// Output transaction or recovery failed.
    ExportInvalid,
    /// Git history or revision resolution failed.
    GitFailed,
    /// Comparison preparation failed.
    ReviewInvalid,
    /// The matching viewer package is absent.
    ServerFailed,
}

/// A static builder preserves its typed failure, including cleanup causes.
pub trait BuildFailure: error::Error + Send + Sync {
    /// A native build error retains its structured terminal diagnostics.
    fn native(&self) -> Option<&BuildError> {
        None
    }
    /// Originating build category.
    fn category(&self) -> Category;
    /// Safe error details, redacted again by the command reporter.
    fn detail(&self) -> String;
}
impl BuildFailure for BuildError {
    fn native(&self) -> Option<&BuildError> {
        Some(self)
    }
    fn category(&self) -> Category {
        match self {
            BuildError::Comparison { source, .. } => {
                match changes_diagnostics::failure_code(source) {
                    Code::GitFailed => Category::GitFailed,
                    Code::BuildInvalid => Category::BuildInvalid,
                    _ => Category::ReviewInvalid,
                }
            }
            BuildError::Interrupted { .. } => Category::BuildInvalid,
            BuildError::Shutdown { primary, .. } => primary.category(),
            BuildError::Cleanup { .. } => Category::ExportInvalid,
            BuildError::Static {
                source:
                    Error::Cancelled
                    | Error::Empty
                    | Error::Inspector {
                        reason: mokly_static::inspector_error::InspectorFailure::Reserved { .. },
                        ..
                    },
            }
            | BuildError::Cancelled => Category::BuildInvalid,
            BuildError::Static {
                source:
                    Error::ModuleSyntax { .. }
                    | Error::ModuleReference { .. }
                    | Error::ModuleEncoding { .. },
            } => Category::ServerFailed,
            BuildError::Static { .. } => Category::ExportInvalid,
            BuildError::Git { .. } => Category::GitFailed,
            BuildError::Catalogue {
                source: CatalogueError::Config(_),
            } => Category::ConfigInvalid,
            BuildError::Catalogue {
                source: CatalogueError::ConfigMissing { .. },
            } => Category::ConfigMissing,
            BuildError::Viewer => Category::ServerFailed,
            _ => Category::BuildInvalid,
        }
    }
    fn detail(&self) -> String {
        self.to_string()
    }
}
