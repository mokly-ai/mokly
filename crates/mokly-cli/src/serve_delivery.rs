//! Composition of Serve publication, background classification, and HTTP stores.

use std::sync::Arc;

use mokly_cli::cancellation::Cancellation;
use mokly_cli::grammar::Common;
use mokly_cli::output::Style;
use mokly_cli::redaction::Redactor;
use mokly_server::application::Application;
use mokly_server::assets::{PackageAssets, ViewerAssets};
use mokly_server::background::{Background, UsagePass};
use mokly_server::changes_background::ChangesPass;
use mokly_server::clock::MonotonicClock;
use mokly_server::comparison_capture::SnapshotCapture;
use mokly_server::comparison_store::MemoryComparisons;
use mokly_server::diagnostics::Diagnostics;
use mokly_server::entropy::Entropy;
use mokly_server::error::{Result, ServerError};
use mokly_server::foreground::Foreground;
use mokly_server::preview::MemoryPreviews;
use mokly_server::publication::SharedPublication;
use mokly_server::snapshot::{Projector, Snapshot};
use mokly_server::work::Workers;

use crate::serve_changes::ServeChanges;
use crate::serve_git::GitWork;
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
    Ok(Arc::new(NativeServeState {
        changes: Arc::new(ServeChanges {
            sidecars: input.services.sidecars.clone(),
            progress: input.progress,
            refreshes: input.reporter,
            cache_announced: Arc::new(false.into()),
            warnings: input.warnings,
            runtime: input.services.runtime.clone(),
            git: input.git,
            cancellation: input.cancellation,
            terminal: input.terminal,
            style: input.style.clone(),
            redactor: input.redactor,
            base: input.common.base.clone(),
        }),
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
    priority: Arc<dyn Foreground>,
) -> Delivery {
    let publications = Arc::new(SharedPublication::new(snapshot));
    let work = Arc::new(Workers::new(workers, diagnostics.clone()).with_foreground(priority));
    let comparisons = Arc::new(MemoryComparisons::new(
        Arc::new(MonotonicClock::default()),
        entropy.clone(),
        Arc::new(SnapshotCapture),
        publications.clone(),
        diagnostics.clone(),
    ));
    let background: Arc<dyn Background> = Arc::new(UsagePass {
        changes: Some(Arc::new(ChangesPass {
            publications: publications.clone(),
            comparisons: comparisons.clone(),
            diagnostics: diagnostics.clone(),
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
