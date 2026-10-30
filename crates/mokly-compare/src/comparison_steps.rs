//! Comparison steps let a command show what Changes does while it runs.

use std::path::Path;
use std::sync::Arc;

use crate::cache_types::{Builder, Cache, Kind, Lease};
use crate::error::Result;

/// One visible step of a comparison. A step lasts until the next step starts or Changes ends.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Step {
    /// Read the base configuration and catalogue sources from Git.
    Reading,
    /// Write the files of the base commit to the source cache.
    Extracting,
    /// Install the third-party dependencies of the base commit.
    Installing,
    /// Render and capture the base catalogue.
    Rendering,
    /// Classify every entry of both catalogues.
    Comparing,
}

/// Terminal boundary of one comparison. It receives each step when the step starts.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = StepsMock))]
pub trait Steps: Send + Sync {
    /// Announce the step that starts now.
    fn step(&self, step: Step);
}

/// A cache that announces each build as a step: a source build extracts and a dependency
/// build installs. A complete entry announces nothing.
pub struct StepCache {
    /// The cache that owns the entries.
    pub inner: Arc<dyn Cache>,
    /// Receives the step of each build.
    pub steps: Arc<dyn Steps>,
}

impl Cache for StepCache {
    fn capacity(&self, kind: Kind) -> u64 {
        self.inner.capacity(kind)
    }

    fn get(&self, kind: Kind, key: &str, builder: &dyn Builder) -> Result<Lease> {
        self.inner.get(
            kind,
            key,
            &Announced {
                inner: builder,
                kind,
                steps: self.steps.as_ref(),
            },
        )
    }

    fn lease(&self, kind: Kind, key: &str) -> Result<Option<Lease>> {
        self.inner.lease(kind, key)
    }
}

struct Announced<'a> {
    inner: &'a dyn Builder,
    kind: Kind,
    steps: &'a dyn Steps,
}

impl Builder for Announced<'_> {
    fn reusable(&self) -> bool {
        self.inner.reusable()
    }

    fn build(&self, destination: &Path) -> Result<()> {
        self.steps.step(match self.kind {
            Kind::Sources => Step::Extracting,
            Kind::Dependencies => Step::Installing,
        });
        self.inner.build(destination)
    }
}

#[cfg(test)]
#[path = "_tests_/comparison_steps_tests.rs"]
mod comparison_steps_tests;
