//! Historical definitions and graph preparation share the working runtime's services.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::{Discoverer, Discovery, Inventory};
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_cli::cancellation::Cancellation;
use mokly_cli::version::VERSION;
use mokly_compare::base_freshness::Freshness;
use mokly_compare::base_render::{
    BasePreparationError, BasePreparationResult, BaseProvider, BaseRequest, PreparedBase,
};
use mokly_compare::base_sources::BaseSourcesRequest;
use mokly_compare::comparison_steps::Step;
use mokly_compare::dependency_types::Tier;
use mokly_compare::error::{Error, Result};
use mokly_git::identity::ObjectId;
use mokly_git::repository::Repository;
use mokly_git::source_key::CheckoutIdentity;
use mokly_graph::types::GraphFactory;
use mokly_render::runtime::Runtime;

use crate::base_dependencies::BaseDependencies;
use crate::base_render_admission::BaseRenderAdmission;
use crate::changes_base_sources::{NativePhases, NativeSources};
use crate::changes_freshness::{SelectionRequest, html_dependencies, reusable, working_roots};
use crate::changes_source_admission::SourceAdmission;
use crate::changes_validation_admission::{GraphPreparationAdmission, ValidationRequest};

/// Prepare the base generation through a second `Runtime` over the base tree. It reuses
/// the supplied pool, render cache, and capture scheduler. A base that needs a sidecar gets a
/// `BaseSide`, which keeps its source and dependency leases while the base graph lives.
pub(super) struct NativeBase {
    pub(super) validation: Option<Arc<dyn GraphPreparationAdmission>>,
    pub(super) admission: Arc<dyn BaseRenderAdmission>,
    pub(super) runtime: Arc<Runtime>,
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) dependencies: Arc<dyn BaseDependencies>,
    pub(super) freshness: Option<Arc<dyn Freshness>>,
}

impl BaseProvider for NativeBase {
    fn prepare(&self, request: &BaseRequest<'_>) -> BasePreparationResult {
        self.admit(self.validate(request)?)
    }
}

impl NativePhases for NativeBase {
    fn admit(&self, prepared: PreparedBase) -> BasePreparationResult {
        let mut admitted = self
            .admission
            .admit(prepared.generation, prepared.scripts_off)?;
        admitted.freshness = prepared.freshness;
        Ok(admitted)
    }

    fn validate(&self, request: &BaseRequest<'_>) -> BasePreparationResult {
        let checkout = match self.checkout(request.repository.as_ref(), &request.commit) {
            Ok(checkout) => checkout,
            Err(source) => return Err(BasePreparationError::new(false, source)),
        };
        let sources = match self.sources(&request.source_request(), checkout, None) {
            Ok(sources) => sources,
            Err(source) => return Err(BasePreparationError::new(false, source)),
        };
        self.validate_sources(request, sources)
    }
    fn checkout(
        &self,
        repository: &dyn Repository,
        commit: &ObjectId,
    ) -> Result<Option<CheckoutIdentity>> {
        self.checkout_sample(repository, commit)
    }

    fn sources(
        &self,
        request: &BaseSourcesRequest<'_>,
        checkout: Option<CheckoutIdentity>,
        admission: Option<Arc<dyn SourceAdmission>>,
    ) -> Result<NativeSources> {
        self.source_generation(request, checkout, admission.as_deref())
    }

    fn validate_sources(
        &self,
        request: &BaseRequest<'_>,
        sources: NativeSources,
    ) -> BasePreparationResult {
        let mut scripts_off = false;
        match self.prepare_generation(request, &mut scripts_off, sources) {
            Ok(prepared) => Ok(prepared),
            Err(source) => Err(BasePreparationError::new(scripts_off, source)),
        }
    }
}

impl NativeBase {
    fn prepare_generation(
        &self,
        request: &BaseRequest<'_>,
        scripts_off: &mut bool,
        sources: NativeSources,
    ) -> Result<PreparedBase> {
        if self.cancellation.requested() {
            return Err(Error::Cancelled);
        }
        let NativeSources {
            tree,
            mut config,
            inventory,
            checkout,
            dependencies,
        } = sources;
        let (base, selection, warning) = if let Some(dependencies) = dependencies {
            let prepared = self.dependencies.prepare(
                request,
                &config,
                &SelectionRequest {
                    directories: &self.runtime.dependency_usage.directories(),
                    unmapped: &self.runtime.dependency_usage.unmapped_directories(),
                    record: checkout.is_some(),
                },
                dependencies,
            )?;
            (Some(prepared.side), prepared.selection, None)
        } else {
            let (warning, selection) = html_dependencies(
                request,
                &config,
                &request
                    .head
                    .catalogue()
                    .dependency_directories
                    .iter()
                    .cloned()
                    .collect::<Vec<_>>(),
                checkout.is_some(),
            )?;
            (None, selection, warning)
        };
        *scripts_off = base.as_ref().is_some_and(|base| {
            base.dependencies.tier == Tier::Installed && !request.install_scripts
        });
        if let Some(base) = &base {
            request.sources.sources.attach(base.sources.clone())?;
        }
        if self.cancellation.requested() {
            return Err(Error::Cancelled);
        }
        if let Some(validation) = &self.validation {
            validation.enter(&ValidationRequest {
                config: &config,
                checkout: checkout.as_ref(),
                selection: selection.as_ref(),
                base: base.as_ref(),
            })?;
        }
        request.steps.step(Step::Rendering);
        let runtime = Arc::new(
            self.runtime
                .for_base(tree.clone(), VERSION.into(), base.clone()),
        );
        let discovery: Arc<dyn Discovery> = if let Some(inventory) = inventory {
            Arc::new(Discovered(inventory))
        } else {
            runtime
                .expand_storybook_roots(&mut config)
                .map_err(|source| Error::Catalogue { source })?;
            Arc::new(Discoverer { tree: tree.clone() })
        };
        let builder: &dyn CatalogueBuilder = &Builder {
            tree,
            discovery,
            definitions: runtime.clone(),
        };
        let mut catalogue = match builder.prepare(&config, None) {
            Ok(catalogue) => catalogue,
            Err(source) => return Err(Error::Catalogue { source }),
        };
        catalogue.warnings.extend(warning);
        if self.cancellation.requested() {
            return Err(Error::Cancelled);
        }
        let factory: &dyn GraphFactory = runtime.as_ref();
        let graph = match factory.create(&config) {
            Ok(graph) => graph,
            Err(source) => return Err(Error::Graph { source }),
        };
        let roots = if checkout.is_some() && reusable(base.as_ref()) {
            working_roots(
                base.as_ref(),
                &config,
                runtime.dependency_usage.directories().into_iter(),
            )
        } else {
            None
        };
        let generation = match graph.prepare(config, catalogue, None) {
            Ok(generation) => generation,
            Err(source) => return Err(Error::Graph { source }),
        };
        let mut prepared = PreparedBase {
            generation,
            prefetch: None,
            scripts_off: *scripts_off,
            freshness: None,
        };
        let generation = &prepared.generation;
        let roots = roots.map(|mut roots| {
            roots.extend(
                generation
                    .catalogue()
                    .dependency_directories
                    .iter()
                    .map(|directory| request.working_config.repo_root.join(directory)),
            );
            roots.sort();
            roots.dedup();
            roots
        });
        let freshness = match (&self.freshness, checkout, selection) {
            (Some(freshness), Some(checkout), Some(selection)) if reusable(base.as_ref()) => {
                match freshness.record(
                    checkout,
                    selection,
                    roots.as_deref(),
                    generation.catalogue(),
                ) {
                    Ok(inputs) => inputs,
                    Err(Error::Cancelled) => return Err(Error::Cancelled),
                    Err(error) => {
                        tracing::debug!(%error, "base freshness evidence is unavailable");
                        None
                    }
                }
            }
            _ => None,
        };
        prepared.freshness = freshness;
        Ok(prepared)
    }
}

struct Discovered(Inventory);
impl Discovery for Discovered {
    fn discover(
        &self,
        _config: &ResolvedConfig,
        _output: Option<&Path>,
    ) -> mokly_catalogue::error::Result<Inventory> {
        Ok(self.0.clone())
    }
}

#[cfg(test)]
#[path = "_tests_/changes_base_tests.rs"]
mod changes_base_tests;

#[cfg(test)]
#[path = "_tests_/changes_base_success_tests.rs"]
mod changes_base_success_tests;

#[cfg(test)]
#[path = "_tests_/changes_freshness_tests.rs"]
mod changes_freshness_tests;

#[cfg(test)]
#[path = "_tests_/changes_evidence_tests.rs"]
mod changes_evidence_tests;

#[cfg(test)]
#[path = "_tests_/base_source_support.rs"]
mod base_source_support;

#[cfg(test)]
#[path = "_tests_/eager_cold_sources_tests.rs"]
mod eager_cold_sources_tests;
