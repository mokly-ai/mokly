//! Composition of Serve publication, background classification, and HTTP stores.

use std::sync::Arc;

use mokly_cli::cancellation::Cancellation;
use mokly_cli::grammar::Common;
use mokly_cli::output::Style;
use mokly_cli::redaction::Redactor;
use mokly_compare::comparison_reuse;
use mokly_compare::extraction_snapshots::ProcessSnapshots;
use mokly_server::application::Application;
use mokly_server::assets::{PackageAssets, ViewerAssets};
use mokly_server::background::{Background, UsagePass};
use mokly_server::background_capacity::BackgroundCapacity;
use mokly_server::changes_background::ChangesPass;
use mokly_server::clock::MonotonicClock;
use mokly_server::comparison_capture::SnapshotCapture;
use mokly_server::comparison_store::MemoryComparisons;
use mokly_server::diagnostics::Diagnostics;
use mokly_server::entropy::Entropy;
use mokly_server::error::{Result, ServerError};
use mokly_server::preview::MemoryPreviews;
use mokly_server::publication::SharedPublication;
use mokly_server::snapshot::{Projector, Snapshot};
use mokly_server::work::Workers;

use crate::serve_changes::ServeChanges;
use crate::serve_eager_native::NativeEagerFactory;
use crate::serve_git::GitWork;
use crate::serve_pool::PoolScheduling;
use crate::serve_progress::Progress;
use crate::serve_reporter::GitRefresh;
use crate::serve_services::ServeServices;
use crate::serve_state::{NativeServeState, ServeStateFactory};
use crate::serve_warnings::WarningScopes;
use crate::terminal::Terminal;
use crate::viewer_assets;

pub(super) struct StateInputs<'a> {
    pub(super) services: &'a ServeServices,
    pub(super) common: &'a Common,
    pub(super) style: &'a Style,
    pub(super) entropy: Arc<dyn Entropy>,
    pub(super) git: Arc<dyn GitWork>,
    pub(super) warnings: Arc<dyn WarningScopes>,
    pub(super) progress: Arc<dyn Progress>,
    pub(super) reporter: Arc<dyn GitRefresh>,
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) terminal: Arc<dyn Terminal>,
    pub(super) redactor: Arc<Redactor>,
}

pub(super) fn states(input: StateInputs<'_>) -> Result<Arc<dyn ServeStateFactory>> {
    let assets: &dyn ViewerAssets = &PackageAssets {
        tree: input.services.tree.clone(),
    };
    let dist = viewer_assets::dist().ok_or(ServerError::InvalidAssets)?;
    let changes = Arc::new(ServeChanges {
        eager: Some(input.services.eager.clone()),
        diagnostics: input.services.diagnostics.clone(),
        routing: Some(input.services.diagnostics.clone()),
        reuse: Arc::new(comparison_reuse::MemoryComparisons::new(32 * 1024 * 1024)),
        kept_base: Arc::default(),
        sidecars: input.services.sidecars.clone(),
        progress: input.progress,
        refreshes: input.reporter,
        cache_announced: input.services.cache_announced.clone(),
        extraction_snapshots: Arc::new(ProcessSnapshots::default()),
        warnings: input.warnings,
        runtime: input.services.runtime.clone(),
        git: input.git,
        cancellation: input.cancellation,
        terminal: input.terminal,
        style: input.style.clone(),
        redactor: input.redactor,
        base: input.common.base.clone(),
        install_scripts: input.common.base_install_scripts_override(),
    });
    input.services.eager.configure(Arc::new(NativeEagerFactory {
        source_starts: input.services.source_starts.clone(),
        runtime: changes.runtime.clone(),
        sidecars: changes.sidecars.clone(),
        slot: Arc::downgrade(&changes.kept_base),
        git: changes.git.clone(),
        command: changes.cancellation.clone(),
        snapshots: changes.extraction_snapshots.clone(),
        diagnostics: input.services.diagnostics.clone(),
        activity: input.services.activity(),
        base: changes.base.clone(),
        install_scripts: changes.install_scripts,
    }));
    Ok(Arc::new(NativeServeState {
        changes,
        tree: input.services.tree.clone(),
        projector: Arc::new(Projector {
            deployment_id: input.entropy.secret(),
            render_token: input.entropy.secret(),
        }),
        assets: assets.load(&dist)?,
        base: input.common.base.clone(),
    }))
}

pub(super) struct Delivery {
    pub(super) publications: Arc<SharedPublication>,
    pub(super) background: Arc<dyn Background>,
    pub(super) app: Arc<Application>,
}

pub(super) fn create(
    snapshot: Arc<Snapshot>,
    workers: u32,
    entropy: Arc<dyn Entropy>,
    diagnostics: Arc<dyn Diagnostics>,
    watching: bool,
    sidecars: Arc<dyn PoolScheduling>,
    services: &ServeServices,
) -> Delivery {
    let publications = Arc::new(SharedPublication::new(snapshot));
    let activity = Some(services.activity());
    services.bind_publications(publications.clone());
    let capacity: Arc<dyn BackgroundCapacity> = Arc::new(UsageCapacity {
        workers,
        sidecars: sidecars.clone(),
    });
    let work = Arc::new(
        Workers::new(workers, diagnostics.clone())
            .with_foreground(sidecars)
            .with_activity(activity.clone()),
    );
    let comparisons = Arc::new(
        MemoryComparisons::new(
            Arc::new(MonotonicClock::default()),
            entropy.clone(),
            Arc::new(SnapshotCapture),
            publications.clone(),
            diagnostics.clone(),
        )
        .with_activity(activity.clone()),
    );
    let background: Arc<dyn Background> = Arc::new(UsagePass {
        capacity,
        changes: Some(Arc::new(ChangesPass {
            publications: publications.clone(),
            comparisons: comparisons.clone(),
            diagnostics: diagnostics.clone(),
            activity,
            watching,
        })),
        publications: publications.clone(),
        work: work.clone(),
        diagnostics: diagnostics.clone(),
    });
    let mut app = Application::new(
        publications.clone(),
        Arc::new(MemoryPreviews::new(
            Arc::new(MonotonicClock::default()),
            entropy.secret(),
        )),
        work,
        diagnostics,
    );
    app.comparisons = Some(comparisons);
    Delivery {
        publications,
        background,
        app: Arc::new(app),
    }
}

struct UsageCapacity {
    workers: u32,
    sidecars: Arc<dyn PoolScheduling>,
}

impl BackgroundCapacity for UsageCapacity {
    fn capacity(&self) -> usize {
        background_batch(self.workers, self.sidecars.limit())
    }
}

/// Each background stage uses the smaller worker and sidecar admission bound.
/// A started view retains its place when capacity falls.
fn background_batch(workers: u32, sidecars: usize) -> usize {
    (workers as usize).min(sidecars)
}

#[cfg(test)]
#[path = "_tests_/serve_delivery_tests.rs"]
mod serve_delivery_tests;
