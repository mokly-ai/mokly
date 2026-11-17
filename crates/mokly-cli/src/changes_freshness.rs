//! Preparation records exact dependency choices before the kept-base boundary.

use std::path::PathBuf;
use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_compare::base_freshness::DependencySelection;
use mokly_compare::base_render::BaseRequest;
use mokly_compare::dependency_paths;
use mokly_compare::dependency_types::{Fallback, Tier};
use mokly_compare::error::Result;
use mokly_compare::inputs::{InputReader, SourceInputs};
use mokly_compare::working_inputs::{SystemWorkingInputs, WorkingInputs};
use mokly_git::tree::Limits;
use mokly_render::side::BaseSide;

/// Selected side and the exact working inputs passed to its tier selection.
pub struct PreparedDependencies {
    pub(super) side: Arc<BaseSide>,
    pub(super) selection: Option<DependencySelection>,
}

/// Working dependency use and whether its exact selection must be retained.
#[derive(Debug)]
pub struct SelectionRequest<'a> {
    pub(super) directories: &'a [String],
    pub(super) unmapped: &'a [String],
    pub(super) record: bool,
}

/// HTML comparison keeps its exact governing paths, including absent candidates.
pub(super) fn html_dependencies(
    request: &BaseRequest<'_>,
    config: &ResolvedConfig,
    used: &[String],
    record: bool,
) -> Result<(Option<Warning>, Option<DependencySelection>)> {
    let paths = dependency_paths::governing(used)?;
    let reader: &dyn InputReader = &SourceInputs;
    let base = reader.read_paths(request.sources.sources.as_ref(), &paths, Limits::default())?;
    let working: &dyn WorkingInputs = &SystemWorkingInputs;
    let head = working.read_paths(
        request.repository.as_ref(),
        &base,
        &paths,
        Limits::default(),
    )?;
    let warning = (base != head).then(|| Warning {
        code: "base-dependencies",
        subject: WarningSubject::Configuration(relative(&config.file, &config.repo_root)),
        message: "Base dependencies differ. HTML comparison uses working-tree dependencies.".into(),
    });
    Ok((
        warning,
        record.then(|| DependencySelection {
            inputs: head,
            paths: Some(paths),
            directories: used.to_vec(),
            unmapped: Vec::new(),
        }),
    ))
}

pub(super) fn reusable(side: Option<&Arc<BaseSide>>) -> bool {
    !side
        .and_then(|side| side.dependencies.warning.as_ref())
        .is_some_and(|warning| {
            matches!(
                warning.reason,
                Fallback::Failed | Fallback::Timeout | Fallback::Cache | Fallback::Size
            )
        })
}

pub(super) fn working_roots(
    side: Option<&Arc<BaseSide>>,
    config: &ResolvedConfig,
    directories: impl Iterator<Item = String>,
) -> Option<Vec<PathBuf>> {
    if side.is_some_and(|side| side.dependencies.tier == Tier::Installed) {
        return None;
    }
    Some(
        directories
            .map(|directory| config.repo_root.join(directory))
            .collect(),
    )
}
