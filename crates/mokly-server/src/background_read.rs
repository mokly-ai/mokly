//! Metadata-only background misses return to admission without a route lock.

use std::fmt;
use std::sync::{Arc, Mutex};

use mokly_catalogue::diagnostic::Warning;
use mokly_graph::background::{self, Completion};
use mokly_graph::cache::Artifact;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGeneration;
use mokly_model::usage::CatalogueUsage;

use crate::backend::GraphDocuments;
use crate::error::{Result, ServerError};

/// One completed worker read or its single-use deferred miss.
#[derive(Debug)]
pub enum BackgroundRead {
    /// Usage and warnings were completed on the lookup worker.
    Complete(Vec<Warning>),
    /// Only metadata and the route's usage owner cross into admission.
    Miss(Box<dyn BackgroundMiss>),
}

/// A worker-resumed attempt whose ordinary cache/store lookup already ended.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BackgroundMissMock))]
pub trait BackgroundMiss: Send + Sync {
    /// Whether this miss supports the existing prepared-root handoff.
    fn root_eligible(&self) -> bool;
    /// Recheck settled usage, then finish without repeating the lookup.
    fn complete(self: Box<Self>, completion: Option<Arc<dyn Completion>>) -> Result<Vec<Warning>>;
}

impl fmt::Debug for dyn BackgroundMiss + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("BackgroundMiss")
    }
}

struct Miss {
    usage: Arc<Mutex<Option<CatalogueUsage>>>,
    inner: Attempt,
}

enum Attempt {
    Resolved(Box<dyn background::BackgroundMiss>),
    Ordinary {
        generation: Arc<dyn RenderGeneration>,
        route: String,
    },
}

impl BackgroundMiss for Miss {
    fn root_eligible(&self) -> bool {
        match &self.inner {
            Attempt::Resolved(inner) => inner.root_eligible(),
            Attempt::Ordinary { .. } => false,
        }
    }

    fn complete(self: Box<Self>, completion: Option<Arc<dyn Completion>>) -> Result<Vec<Warning>> {
        let mut usage = self.usage.lock().unwrap_or_else(|error| error.into_inner());
        if usage.is_some() {
            return Ok(Vec::new());
        }
        let result = match self.inner {
            Attempt::Resolved(inner) => inner.complete(completion),
            Attempt::Ordinary { generation, route } => generation.render(&route),
        };
        settle(&mut usage, result)
    }
}

impl GraphDocuments {
    pub(crate) fn read_background(&self, route: &str) -> Result<BackgroundRead> {
        let Some(lock) = self.locks.get(route) else {
            return Ok(BackgroundRead::Complete(Vec::new()));
        };
        let mut usage = lock.lock().unwrap_or_else(|error| error.into_inner());
        if usage.is_some() {
            return Ok(BackgroundRead::Complete(Vec::new()));
        }
        match self.generation.read_background(route) {
            Ok(Some(background::BackgroundRead::Complete(artifact))) => {
                settle(&mut usage, Ok(artifact)).map(BackgroundRead::Complete)
            }
            Ok(Some(background::BackgroundRead::Miss(inner))) => {
                Ok(BackgroundRead::Miss(Box::new(Miss {
                    usage: lock.clone(),
                    inner: Attempt::Resolved(inner),
                })))
            }
            Ok(None) => Ok(BackgroundRead::Miss(Box::new(Miss {
                usage: lock.clone(),
                inner: Attempt::Ordinary {
                    generation: self.generation.clone(),
                    route: route.into(),
                },
            }))),
            Err(source) => {
                usage.get_or_insert(CatalogueUsage::Unavailable);
                Err(ServerError::Render { source })
            }
        }
    }
}

fn settle(
    usage: &mut Option<CatalogueUsage>,
    result: std::result::Result<Arc<Artifact>, GraphError>,
) -> Result<Vec<Warning>> {
    match result {
        Ok(artifact) => {
            *usage = Some(
                artifact
                    .document
                    .as_ref()
                    .map_or(CatalogueUsage::Unavailable, |document| {
                        document.usage.clone()
                    }),
            );
            Ok(artifact
                .document
                .as_ref()
                .map_or_else(Vec::new, |document| document.warnings.clone()))
        }
        Err(source) => {
            usage.get_or_insert(CatalogueUsage::Unavailable);
            Err(ServerError::Render { source })
        }
    }
}

#[cfg(test)]
#[path = "_tests_/deferred_usage_tests.rs"]
mod deferred_usage_tests;
