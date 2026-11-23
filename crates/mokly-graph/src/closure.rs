//! One referenced-asset walk for build, Serve, and either comparison side.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_catalogue::diagnostic::Warning;
use mokly_html::tree::Node;
use mokly_model::evidence::ResourceEvidence;
use mokly_source_interface::tree::SourceTree;

use crate::asset_delivery::AssetRead;
use crate::closure_walk;
use crate::error::Result;
use crate::head_validation::{Unrecorded, ValidationRecorder};
use crate::policy::PublicPolicy;
use crate::reference_index::ReferenceIndex;
use crate::resource_reach::ResourceReach;

/// Generation-owned resources are read from plans and cache, never by disk route.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = GeneratedResourcesMock))]
pub trait GeneratedResources: Send + Sync {
    /// Obtain pending stylesheet or asset bytes; documents are not followed.
    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>>;
    /// Open a digest-only generated asset; other resource types return None.
    fn open_asset(&self, _route: &str) -> Result<Option<Box<dyn AssetRead>>> {
        Ok(None)
    }
    /// Test pending opaque membership without reading its payload.
    fn contains_resource(&self, route: &str) -> Result<bool> {
        Ok(self.resource(route)?.is_some())
    }
    /// Test whether a route is a declared catalogue document.
    fn is_document(&self, route: &str) -> bool;
}

/// Sorted authored closure with traversal and ownership evidence.
#[derive(Clone, Debug, Default)]
pub struct Closure {
    /// Base resources excluded after checkout conversion, and stylesheet seeds.
    pub warnings: Vec<Warning>,
    /// Repository-relative authored files, never generated route names.
    pub files: BTreeSet<String>,
    /// Per-file reference lists reused by watch.
    pub edges: BTreeMap<String, Vec<String>>,
    /// Every resource reached by an entry or component owner.
    pub evidence: Vec<ResourceEvidence>,
    /// Exact instance and referring edge for comparison-only implementation proof.
    pub references: Vec<ResourceReach>,
}

/// Injected closure traversal boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ClosureBuilderMock))]
pub trait ClosureBuilder: Send + Sync {
    /// Replay one lexical observer call before proving that target's reads.
    /// An attachment failure stops the proof before its target reads.
    fn observe(&self, _route: &str, _path: &str) -> Result<()> {
        Ok(())
    }
    /// Follow one composed document and its renderer-declared seeds.
    fn collect(&self, route: &str, tree: &[Node], seeds: &[String]) -> Result<Closure>;
    /// Record every input at its read boundary, or decline retention.
    fn collect_recorded(
        &self,
        route: &str,
        tree: &[Node],
        seeds: &[String],
        recorder: &dyn ValidationRecorder,
    ) -> Result<Closure> {
        recorder.unknown();
        self.collect(route, tree, seeds)
    }
}

/// Reuses one generation's public policy for every target.
pub struct Walker {
    /// Optional lexical dependency recorder, invoked before public validation.
    pub observer: Option<Arc<dyn ClosureObserver>>,
    /// Authored bytes from a working or Git tree.
    pub tree: Arc<dyn SourceTree>,
    /// Cached eligibility decisions for this generation.
    pub policy: Arc<dyn PublicPolicy>,
    /// Pending generated resources and document routes.
    pub generated: Arc<dyn GeneratedResources>,
    /// One reference-edge cache for this generation.
    pub index: Arc<dyn ReferenceIndex>,
}

impl ClosureBuilder for Walker {
    fn observe(&self, route: &str, path: &str) -> Result<()> {
        if let Some(observer) = &self.observer {
            observer.observe(route, path)?;
        }
        Ok(())
    }
    fn collect(&self, route: &str, tree: &[Node], seeds: &[String]) -> Result<Closure> {
        self.collect_recorded(route, tree, seeds, &Unrecorded)
    }

    fn collect_recorded(
        &self,
        route: &str,
        tree: &[Node],
        seeds: &[String],
        recorder: &dyn ValidationRecorder,
    ) -> Result<Closure> {
        closure_walk::collect(self, route, tree, seeds, recorder)
    }
}

/// A document-scoped record of lexical resources reached during closure validation.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ClosureObserverMock))]
pub trait ClosureObserver: Send + Sync {
    /// Complete lexical attachment before a prefetch can read resource bytes.
    fn before_read(&self, path: &str) -> Result<()>;
    /// Record before validation so missing and dangling targets can be repaired.
    fn observe(&self, route: &str, path: &str) -> Result<()>;
}

#[cfg(test)]
#[path = "_tests_/validation_walk_tests.rs"]
mod validation_walk_tests;
