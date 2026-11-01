//! Separate unavailable historical resources from fatal repository failures.

use std::path::Path;
use std::sync::Arc;

use mokly_git::error;
use mokly_git::identity::RepoPath;
use mokly_source_interface::error::SourceError;

use crate::error::Error;
use crate::git_asset_stream::OPAQUE_LIMIT;
use crate::git_tree::{GitTree, adapter};
use crate::source_failures::SourceFailures;

impl GitTree {
    pub(crate) fn failed(
        &self,
        operation: &'static str,
        path: &Path,
        source: Error,
    ) -> SourceError {
        if let Error::Git {
            source:
                mokly_git::error::Error::Conversion {
                    path: relative,
                    source,
                },
        } = &source
        {
            let message = format!("base resource {relative} is unavailable: {source}");
            if !matches!(source.as_ref(), error::Error::ByteLimit { limit } if *limit != OPAQUE_LIMIT)
                && let Ok(relative) = RepoPath::parse(relative)
            {
                self.unavailable
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .insert(relative, message.clone());
            }
            return SourceError::Unavailable {
                path: path.into(),
                message,
            };
        }
        let source = Arc::new(source);
        let mut failure = self
            .failure
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if failure.as_deref().is_none_or(|previous| {
            matches!(previous, Error::Limit { .. })
                && !matches!(source.as_ref(), Error::Limit { .. })
        }) {
            *failure = Some(source.clone());
        }
        adapter(operation, path, source)
    }
}

impl SourceFailures for GitTree {
    fn warnings(&self) -> Vec<mokly_catalogue::diagnostic::Warning> {
        self.sources
            .warnings()
            .into_iter()
            .map(|(path, message)| mokly_catalogue::diagnostic::Warning {
                code: "base-conversion",
                subject: mokly_catalogue::diagnostic::WarningSubject::Route(format!(
                    "static/{path}"
                )),
                message,
            })
            .collect()
    }
    fn failure(&self) -> Option<Arc<Error>> {
        self.failure
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }
}

#[cfg(test)]
#[path = "_tests_/git_asset_failure_tests.rs"]
mod git_asset_failure_tests;
