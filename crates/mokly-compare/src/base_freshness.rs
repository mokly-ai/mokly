//! Preparation evidence and cheap checks for one provider-owned historical base.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_git::identity::RepoPath;
use mokly_git::source_key::CheckoutIdentity;
use mokly_git::tree::Limits;
use mokly_graph::types::RenderGeneration;

use crate::base_selection::PinnedBase;
use crate::base_vite_env::ViteEnvInputs;
use crate::error::{Error, GitResult, Result};
use crate::inputs::Inputs;
use crate::working_inputs::WorkingInputs;

/// Exact working inputs supplied to historical dependency selection.
#[derive(Clone, Debug, Default)]
pub struct DependencySelection {
    /// Clean-normalized manifests, lockfiles, and manager configuration.
    pub inputs: Inputs,
    /// Some stores HTML governing paths and uses the head catalogue's directories.
    /// None inventories all candidates and uses the head runtime's dependency usage.
    pub paths: Option<Vec<RepoPath>>,
    /// Head dependency directories supplied to selection.
    pub directories: Vec<String>,
    /// Head importer directories that selection could not map.
    pub unmapped: Vec<String>,
}

/// Evidence sampled while the base prepares, never replaced at keep.
#[derive(Clone, Debug)]
pub struct PreparationInputs {
    /// Checkout sample taken before the first historical read.
    pub checkout: CheckoutIdentity,
    /// Working dependency selection, checked for every tier.
    pub selection: DependencySelection,
    /// Installation records and package entry lists for each used working root.
    pub installations: BTreeMap<PathBuf, String>,
    /// Installed modules of a base that reads the working install.
    pub installed_modules: BTreeMap<String, Option<String>>,
    /// Working dotenv files used by a Vite base.
    pub vite_env: Option<ViteEnvInputs>,
}

/// Current classification inputs supplied without preparing the base again.
pub struct FreshnessRequest<'a> {
    /// Repository and immutable base commit.
    pub selected: &'a PinnedBase,
    /// Current head bundle whose shared installed modules must agree.
    pub head: &'a dyn RenderGeneration,
    /// Current observed dependency directories supplied to selection.
    pub directories: &'a [String],
    /// Current unsupported importer directories supplied to selection.
    pub unmapped: &'a [String],
}

/// Bounded install evidence boundary. None means that no proof is available.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = InstallInputsMock))]
pub trait InstallInputs: Send + Sync {
    /// Digest manager records and direct package entries, including scoped packages.
    fn read(&self, root: &Path) -> Result<Option<String>>;
}

/// Record preparation evidence and compare it with the next classification.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = FreshnessMock))]
pub trait Freshness: Send + Sync {
    /// None roots denotes a tier-two install. Some roots denotes the working install.
    fn record(
        &self,
        checkout: CheckoutIdentity,
        selection: DependencySelection,
        working_roots: Option<&[PathBuf]>,
        base: &PreparedCatalogue,
    ) -> Result<Option<PreparationInputs>>;
    /// Check the original preparation evidence without mutating it.
    fn current(&self, inputs: &PreparationInputs, request: &FreshnessRequest<'_>) -> Result<bool>;
}

/// Freshness coordinator. Its only IO passes through injected boundaries.
pub struct FreshnessChecks {
    /// Working manifest and lockfile reader, with Git clean normalization.
    pub working: Arc<dyn WorkingInputs>,
    /// Bounded install record and package entry reader.
    pub installs: Arc<dyn InstallInputs>,
}

impl Freshness for FreshnessChecks {
    fn record(
        &self,
        checkout: CheckoutIdentity,
        selection: DependencySelection,
        working_roots: Option<&[PathBuf]>,
        base: &PreparedCatalogue,
    ) -> Result<Option<PreparationInputs>> {
        if checkout.filtered {
            return Ok(None);
        }
        let mut installations = BTreeMap::new();
        for root in working_roots.into_iter().flatten() {
            let proof = match self.installs.read(root) {
                Ok(proof) => proof,
                Err(Error::Cancelled) => return Err(Error::Cancelled),
                Err(error) => {
                    tracing::debug!(%error, "base install evidence is unavailable");
                    return Ok(None);
                }
            };
            let Some(proof) = proof else {
                return Ok(None);
            };
            installations.insert(root.clone(), proof);
        }
        let installed_modules = if working_roots.is_some() {
            base.javascript
                .generation
                .iter()
                .flat_map(|generation| &generation.module_digests)
                .filter(|(path, _)| path.split('/').any(|part| part == "node_modules"))
                .map(|(path, digest)| (path.clone(), digest.clone()))
                .collect()
        } else {
            BTreeMap::new()
        };
        Ok(Some(PreparationInputs {
            checkout,
            selection,
            installations,
            installed_modules,
            vite_env: None,
        }))
    }

    fn current(&self, inputs: &PreparationInputs, request: &FreshnessRequest<'_>) -> Result<bool> {
        if inputs.checkout.filtered
            || inputs.selection.directories != request.directories
            || inputs.selection.unmapped != request.unmapped
        {
            return Ok(false);
        }
        let repository = request.selected.repository.as_ref();
        if let Some(inputs) = &inputs.vite_env
            && !inputs.current(repository, &WorkingTree)?
        {
            return Ok(false);
        }
        let checkout = repository
            .checkout_identity(&request.selected.commit)
            .base()?;
        if checkout.filtered || checkout != inputs.checkout {
            return Ok(false);
        }
        let selection = &inputs.selection;
        let current = match &selection.paths {
            Some(paths) => {
                self.working
                    .read_paths(repository, &selection.inputs, paths, Limits::default())?
            }
            None => self
                .working
                .read(repository, &selection.inputs, Limits::default())?,
        };
        if current != selection.inputs {
            return Ok(false);
        }
        for (root, previous) in &inputs.installations {
            if self.installs.read(root)?.as_ref() != Some(previous) {
                return Ok(false);
            }
        }
        if inputs.installed_modules.is_empty() {
            return Ok(true);
        }
        let head = &request.head.catalogue().javascript.generation;
        Ok(inputs.installed_modules.iter().all(|(path, base)| {
            head.as_ref()
                .and_then(|generation| generation.module_digests.get(path))
                .is_none_or(|head| base.is_some() && base == head)
        }))
    }
}

#[cfg(test)]
#[path = "_tests_/base_freshness/mod.rs"]
mod base_freshness_tests;
