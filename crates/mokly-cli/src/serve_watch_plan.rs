//! A watch plan derives only from its plan inputs, so a candidate whose inputs equal the
//! adopted inputs, or those inputs with the resources that the observer attached after the
//! adoption, reuses that plan and its targets.

use std::borrow::Cow;
use std::collections::{BTreeMap, BTreeSet};
use std::iter;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_cli::serve::PreparedServe;
use mokly_compare::locations::{Locations, SystemLocations};
use mokly_css::dependencies::DirectoryDependency;
use mokly_server::error::Result;
use mokly_watch::observer::Observer;
use mokly_watch::plan::Plan;

use crate::serve_watch::{CandidateWatch, watch_result};

/// Module resolution files, and resolution directories with the file names they hold.
type Resolution<'a> = (
    Cow<'a, BTreeSet<String>>,
    Cow<'a, BTreeMap<String, BTreeSet<String>>>,
);

/// Every value that the watch plan of a prepared generation reads. A candidate borrows
/// them from its preparation, and a record keeps its own copy.
#[derive(Clone, PartialEq)]
pub(super) struct PlanInputs<'a> {
    config: Cow<'a, ResolvedConfig>,
    sources: Cow<'a, [String]>,
    directories: Cow<'a, [DirectoryDependency]>,
    resources: BTreeSet<String>,
    resolution: Option<Resolution<'a>>,
    stylesheet_resolution: BTreeSet<String>,
    stylesheet_resolution_roots: BTreeMap<String, PathBuf>,
    cache_root: Option<PathBuf>,
    cache_namespace: Option<PathBuf>,
}

impl<'a> PlanInputs<'a> {
    /// Borrow the plan inputs of `prepared`, with one read of each generation value.
    pub(super) fn of(prepared: &'a PreparedServe) -> Self {
        let catalogue = prepared.generation.catalogue();
        Self {
            config: Cow::Borrowed(&prepared.config),
            sources: Cow::Borrowed(&catalogue.model.sources),
            directories: Cow::Borrowed(prepared.generation.stylesheet_directories()),
            resources: prepared.generation.watch_files(),
            stylesheet_resolution: prepared.generation.stylesheet_resolution_files(),
            stylesheet_resolution_roots: prepared.generation.stylesheet_resolution_roots(),
            cache_root: SystemLocations.cache_root().ok().flatten(),
            cache_namespace: SystemLocations.repository(&prepared.config.repo_root).ok(),
            resolution: catalogue.javascript.generation.as_ref().map(|generation| {
                (
                    Cow::Borrowed(&generation.resolution_files),
                    Cow::Borrowed(&generation.resolution_directories),
                )
            }),
        }
    }

    /// Copy each borrowed input, so that a record can keep the inputs.
    fn into_owned(self) -> PlanInputs<'static> {
        let Self {
            config,
            sources,
            directories,
            resources,
            resolution,
            stylesheet_resolution,
            stylesheet_resolution_roots,
            cache_root,
            cache_namespace,
        } = self;
        PlanInputs {
            config: Cow::Owned(config.into_owned()),
            sources: Cow::Owned(sources.into_owned()),
            directories: Cow::Owned(directories.into_owned()),
            resources,
            stylesheet_resolution,
            stylesheet_resolution_roots,
            cache_root,
            cache_namespace,
            resolution: resolution.map(|(files, directories)| {
                (
                    Cow::Owned(files.into_owned()),
                    Cow::Owned(directories.into_owned()),
                )
            }),
        }
    }
}

/// A watch plan with the inputs that it derives from and its targets.
pub(super) struct PlanRecord {
    inputs: PlanInputs<'static>,
    /// The plan of the inputs.
    pub(super) plan: Plan,
    targets: BTreeSet<PathBuf>,
}

impl PlanRecord {
    /// Build the plan of `inputs` and its targets, and keep a copy of the inputs.
    pub(super) fn new(inputs: PlanInputs<'_>) -> Result<Self> {
        let mut plan = watch_result(Plan::new(
            &inputs.config,
            &inputs.sources,
            &inputs.directories,
            &inputs.resources,
        ))?;
        if let Some((files, directories)) = &inputs.resolution {
            plan.resolution(files, directories);
        }
        plan.stylesheet_resolution(
            &inputs.stylesheet_resolution,
            &inputs.stylesheet_resolution_roots,
            inputs.cache_root.as_deref(),
            inputs.cache_namespace.as_deref(),
        );
        let targets = plan.targets();
        Ok(Self {
            inputs: inputs.into_owned(),
            plan,
            targets,
        })
    }

    /// A copy of this record whose inputs also hold `resources`, with the plan and the
    /// targets of those inputs, or `None` when the inputs already hold each of them.
    pub(super) fn with_resources(&self, resources: &BTreeSet<String>) -> Option<Self> {
        let added: BTreeSet<String> = resources
            .difference(&self.inputs.resources)
            .cloned()
            .collect();
        if added.is_empty() {
            return None;
        }
        let mut inputs = self.inputs.clone();
        inputs.resources.extend(added.iter().cloned());
        let mut plan = self.plan.clone();
        plan.resources(&added);
        let targets = plan.targets();
        Some(Self {
            inputs,
            plan,
            targets,
        })
    }

    /// Whether `inputs` equal the inputs of this record, so their plan equals this plan.
    pub(super) fn matches(&self, inputs: &PlanInputs<'_>) -> bool {
        self.inputs == *inputs
    }

    /// The watch candidate of this plan with `observer`.
    pub(super) fn candidate(
        self: Arc<Self>,
        observer: Arc<dyn Observer>,
        recheck: bool,
    ) -> CandidateWatch {
        CandidateWatch {
            observer,
            recheck,
            record: self,
        }
    }

    /// Targets of the plan other than roots whose directory `active` does not watch.
    pub(super) fn unobserved(&self, active: &dyn Observer) -> Vec<PathBuf> {
        self.targets
            .iter()
            .filter(|path| !self.plan.roots.contains(*path))
            .filter(|path| path.parent().is_none_or(|parent| !active.observes(parent)))
            .cloned()
            .collect()
    }
}

/// The record of the adopted candidate, and its copy that also holds the resources that the
/// observer attached after the adoption. Each change replaces the whole value, so a drain
/// tells by pointer whether the records that it read are still the current ones.
pub(super) struct PlanRecords {
    adopted: Arc<PlanRecord>,
    observed: Option<Arc<PlanRecord>>,
}

impl PlanRecords {
    /// The records at the adoption of the candidate with `record`.
    pub(super) fn adopted(record: Arc<PlanRecord>) -> Arc<Self> {
        Arc::new(Self {
            adopted: record,
            observed: None,
        })
    }

    /// The record whose inputs equal `inputs`.
    pub(super) fn find(&self, inputs: &PlanInputs<'_>) -> Option<Arc<PlanRecord>> {
        iter::once(&self.adopted)
            .chain(&self.observed)
            .find(|record| record.matches(inputs))
            .cloned()
    }

    /// These records with a copy of the newest record whose inputs also hold `resources`,
    /// or `None` when the newest record already holds each of them.
    pub(super) fn with_resources(&self, resources: &BTreeSet<String>) -> Option<Arc<Self>> {
        let newest = self.observed.as_ref().unwrap_or(&self.adopted);
        let observed = newest.with_resources(resources)?;
        Some(Arc::new(Self {
            adopted: self.adopted.clone(),
            observed: Some(Arc::new(observed)),
        }))
    }
}

#[cfg(test)]
#[path = "_tests_/serve_watch_plan_tests.rs"]
mod serve_watch_plan_tests;
