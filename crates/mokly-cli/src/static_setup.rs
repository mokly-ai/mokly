//! Resolve package/runtime services after output reservation.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_cli::build::BuildError;
use mokly_cli::grammar::Build;
use mokly_cli::static_build::Phases;
use mokly_compare::base_selection::PinnedBase;
use mokly_model::output::artifact::File;
use mokly_server::assets::{PackageAssets, ViewerAssets};
use mokly_source_interface::tree::SourceTree;
use mokly_static::modules;

use crate::render_runtime::Services;
use crate::static_runtime::Context;
use crate::{changes_runtime, viewer_assets};

pub(super) struct Setup {
    pub(super) services: Services,
    pub(super) viewer: Vec<File>,
    pub(super) pinned: Option<Arc<PinnedBase>>,
}

pub(super) fn setup(
    cwd: &Path,
    options: &Build,
    context: &Context,
    config: &ResolvedConfig,
    tree: Arc<dyn SourceTree>,
) -> Result<Setup, BuildError> {
    let pinned = changes_runtime::pin(config, options, context.cancellation.clone())?;
    let assets: &dyn ViewerAssets = &PackageAssets {
        tree: Arc::new(WorkingTree),
    };
    let dist = viewer_assets::dist().ok_or(BuildError::Viewer)?;
    let viewer: Vec<File> = match assets.load(&dist) {
        Ok(files) => files
            .into_iter()
            .map(|(path, file)| File {
                path,
                bytes: file.bytes,
            })
            .collect(),
        Err(_) => return Err(BuildError::Viewer),
    };
    if let Err(source) = modules::validate(&viewer) {
        return Err(BuildError::Static { source });
    }
    let services = match Services::new(
        tree.clone(),
        cwd,
        &config.repo_root,
        &options.common,
        Arc::new(RenderDiagnostics(context.phases.clone())),
        context.cancellation.clone(),
        context.cache.clone(),
    ) {
        Ok(services) => services,
        Err(source) => {
            return Err(BuildError::Rendering {
                source: Box::new(source),
                warnings: Vec::new(),
            });
        }
    };
    Ok(Setup {
        services,
        viewer,
        pinned,
    })
}

struct RenderDiagnostics(Arc<dyn Phases>);
impl mokly_sidecar::workers::Diagnostics for RenderDiagnostics {
    fn emit(&self, message: &str) {
        self.0.diagnostic(message);
    }
}
