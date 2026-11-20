//! A watch plan derives only from its plan inputs, so a candidate whose inputs equal the
//! adopted inputs reuses the adopted plan and its targets.

use std::borrow::Cow;
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
type Resolution<'a> = (
    Cow<'a, BTreeSet<String>>,
    Cow<'a, BTreeMap<String, BTreeSet<String>>>,
);

/// Every value that the watch plan of a prepared generation reads. A candidate borrows
/// them from its preparation, and a record keeps its own copy.
#[derive(PartialEq)]
pub(super) struct PlanInputs<'a> {
    config: Cow<'a, ResolvedConfig>,
    sources: Cow<'a, [String]>,
    directories: Cow<'a, [DirectoryDependency]>,
    resources: BTreeSet<String>,
    resolution: Option<Resolution<'a>>,
    stylesheet_resolution: BTreeSet<String>,
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
        } = self;
        PlanInputs {
            config: Cow::Owned(config.into_owned()),
            sources: Cow::Owned(sources.into_owned()),
            directories: Cow::Owned(directories.into_owned()),
            resources,
            stylesheet_resolution,
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
        plan.resolution(&inputs.stylesheet_resolution, &BTreeMap::new());
        let targets = plan.targets();
        Ok(Self {
            inputs: inputs.into_owned(),
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
