//! A watch plan derives only from its plan inputs, so a candidate whose inputs equal the
//! adopted inputs reuses the adopted plan and its targets.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_cli::serve::PreparedServe;
use mokly_css::dependencies::DirectoryDependency;
use mokly_server::error::Result;
use mokly_watch::observer::Observer;
use mokly_watch::plan::Plan;

use crate::serve_watch::{CandidateWatch, watch_result};

/// Module resolution files, and resolution directories with the file names they hold.
type Resolution = (BTreeSet<String>, BTreeMap<String, BTreeSet<String>>);

/// Every value that the watch plan of a prepared generation reads.
pub(super) struct PlanInputs {
    config: ResolvedConfig,
    sources: Vec<String>,
    directories: Vec<DirectoryDependency>,
    resources: BTreeSet<String>,
    resolution: Option<Resolution>,
}

impl PlanInputs {
    /// Copy the plan inputs of `prepared`, with one read of each generation value.
    pub(super) fn of(prepared: &PreparedServe) -> Self {
        let catalogue = prepared.generation.catalogue();
        Self {
            config: prepared.config.clone(),
            sources: catalogue.model.sources.clone(),
            directories: prepared.generation.stylesheet_directories().to_vec(),
            resources: prepared.generation.watch_files(),
            resolution: catalogue.javascript.generation.as_ref().map(|generation| {
                (
                    generation.resolution_files.clone(),
                    generation.resolution_directories.clone(),
                )
            }),
        }
    }

    /// Whether `prepared` has these plan inputs. The resource files compare last, because
    /// their read copies a set.
    fn matches(&self, prepared: &PreparedServe) -> bool {
        let catalogue = prepared.generation.catalogue();
        let resolution = catalogue.javascript.generation.as_ref().map(|generation| {
            (
                &generation.resolution_files,
                &generation.resolution_directories,
            )
        });
        self.config == prepared.config
            && self.directories == prepared.generation.stylesheet_directories()
            && self.sources == catalogue.model.sources
            && self
                .resolution
                .as_ref()
                .map(|(files, directories)| (files, directories))
                == resolution
            && self.resources == prepared.generation.watch_files()
    }
}

/// A watch plan with the inputs that it derives from and its targets.
pub(super) struct PlanRecord {
    inputs: PlanInputs,
    /// The plan of the inputs.
    pub(super) plan: Plan,
    targets: BTreeSet<PathBuf>,
}

impl PlanRecord {
    /// Build the plan of `inputs` and its targets.
    pub(super) fn new(inputs: PlanInputs) -> Result<Self> {
        let mut plan = watch_result(Plan::new(
            &inputs.config,
            &inputs.sources,
            &inputs.directories,
            &inputs.resources,
        ))?;
        if let Some((files, directories)) = &inputs.resolution {
            plan.resolution(files, directories);
        }
        let targets = plan.targets();
        Ok(Self {
            inputs,
            plan,
            targets,
        })
    }

    /// Whether `prepared` has the inputs of this record, so its plan equals this plan.
    pub(super) fn matches(&self, prepared: &PreparedServe) -> bool {
        self.inputs.matches(prepared)
    }

    /// The watch candidate of this plan with `observer`.
    pub(super) fn candidate(
        self: Arc<Self>,
        observer: Arc<dyn Observer>,
        recheck: bool,
    ) -> CandidateWatch {
        CandidateWatch {
            plan: self.plan.clone(),
            observer,
            recheck,
            record: Some(self),
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
