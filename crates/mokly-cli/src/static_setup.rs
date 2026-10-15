//! Resolve comparison history and package/runtime services after output reservation.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_cli::build::BuildError;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::grammar::Build;
use mokly_cli::static_build::{self, Phases};
use mokly_git::control;
use mokly_git::disk::SystemDisk;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::system::SystemRunner;
use mokly_model::output::artifact::File;
use mokly_platform::processes::SystemProcessGroups;
use mokly_server::assets::{PackageAssets, ViewerAssets};
use mokly_source_interface::tree::SourceTree;

use crate::render_runtime::Services;
use crate::static_runtime::Context;
use crate::viewer_assets;

pub(super) fn setup(
    cwd: &Path,
    options: &Build,
    context: &Context,
    config: &ResolvedConfig,
    tree: Arc<dyn SourceTree>,
) -> Result<(Services, Vec<File>), BuildError> {
    if !options.no_changes {
        let base = options
            .common
            .base
            .clone()
            .or_else(|| {
                config
                    .input
                    .review
                    .as_ref()
                    .and_then(|review| review.base.clone())
            })
            .unwrap_or_else(|| "origin/main".into());
        context
            .phases
            .start(static_build::Phase::Comparing(base.clone()));
        let repositories: &dyn Repositories = &GitRepositories {
            runner: Arc::new(SystemRunner {
                clock: Arc::new(control::SystemClock::default()),
                cancellation: Arc::new(Cancel(context.cancellation.clone())),
                groups: Arc::new(SystemProcessGroups),
            }),
            disk: Arc::new(SystemDisk),
        };
        if let Err(source) = tracing::info_span!("review.base-commit").in_scope(|| {
            repositories
                .open(&config.repo_root)
                .and_then(|repository| repository.merge_base(&base))
        }) {
            return Err(BuildError::Git { base, source });
        }
    }
    let assets: &dyn ViewerAssets = &PackageAssets {
        tree: Arc::new(WorkingTree),
    };
    let dist = viewer_assets::dist().ok_or(BuildError::Viewer)?;
    let viewer = match assets.load(&dist) {
        Ok(files) => files
            .into_iter()
            .map(|(path, file)| File {
                path,
                bytes: file.bytes,
            })
            .collect(),
        Err(_) => return Err(BuildError::Viewer),
    };
    let services = match Services::new(
        tree.clone(),
        cwd,
        &config.repo_root,
        &options.common,
        Arc::new(RenderDiagnostics(context.phases.clone())),
        context.cancellation.clone(),
    ) {
        Ok(services) => services,
        Err(source) => {
            return Err(BuildError::Rendering {
                source: Box::new(source),
                warnings: Vec::new(),
            });
        }
    };
    Ok((services, viewer))
}

struct Cancel(Arc<dyn Cancellation>);
impl control::Cancellation for Cancel {
    fn cancelled(&self) -> bool {
        self.0.requested()
    }
}

struct RenderDiagnostics(Arc<dyn Phases>);
impl mokly_sidecar::workers::Diagnostics for RenderDiagnostics {
    fn emit(&self, message: &str) {
        self.0.diagnostic(message);
    }
}
