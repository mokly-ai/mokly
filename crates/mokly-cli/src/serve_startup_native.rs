//! The first head decides only whether an independent historical task is useful.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::{Inventory, SourceKind};
use mokly_compare::base_render::selected_base;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::base_startup::BasePreparation;
use mokly_compare::cache_types::Reporter;
use mokly_compare::comparison::Engine;
use mokly_compare::error::Result;
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_server::changes::ChangeCancellation;
use mokly_server::startup_preparation::StartupPreparation;
use mokly_server::usage_completion::UsageCompletion;

use crate::serve_base_key::BaseKey;
use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes::Source;
use crate::serve_changes_base::PreparationNotice;
use crate::serve_startup_base::StartupReady;

/// Transforms and included JavaScript sources make cold-start overlap useful.
pub(super) fn needs_sidecar(config: &ResolvedConfig, inventory: &Inventory) -> bool {
    config.input.renderer.is_some()
        || config.input.postcss.is_some()
        || inventory.files.iter().any(|file| {
            !file.excluded && matches!(file.kind, SourceKind::Module | SourceKind::Stories)
        })
}

struct HeldCache(Arc<Mutex<Option<PathBuf>>>);
impl PreparationNotice for HeldCache {
    fn restarting(&self) {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
    }
}
impl Reporter for HeldCache {
    fn opened(&self, directory: &Path) {
        *self.0.lock().unwrap_or_else(|error| error.into_inner()) = Some(directory.into());
    }
}

struct StartupTask {
    source: Source,
    cancel: Arc<dyn ChangeCancellation>,
    usage: Arc<dyn UsageCompletion>,
}

impl Source {
    /// Register one base-only task without touching the ordinary Changes lifecycle.
    pub(super) fn startup_native(
        &self,
        cancel: Arc<dyn ChangeCancellation>,
        usage: Arc<dyn UsageCompletion>,
    ) -> Option<Arc<dyn StartupPreparation>> {
        if cancel.cancelled()
            || !needs_sidecar(&self.config, &self.head.catalogue().inventory)
            || !self
                .services
                .startup
                .begin(self.head.clone(), cancel.clone())
        {
            return None;
        }
        Some(Arc::new(StartupTask {
            source: Source {
                services: self.services.clone(),
                config: self.config.clone(),
                head: self.head.clone(),
                warnings: self.warnings.clone(),
                pending: Arc::default(),
                operation: Arc::new(CaptureCancellation::default()),
                references: Mutex::new(None),
                staging: Mutex::new(None),
            },
            cancel,
            usage,
        }))
    }
}

impl StartupPreparation for StartupTask {
    fn prepare(&self) -> bool {
        let cache = Arc::new(Mutex::new(None));
        let attempt = self.source.base_changes(
            self.cancel.clone(),
            None,
            Some(self.usage.clone()),
            self.source.pending.clone(),
            Arc::new(HeldCache(cache.clone())),
            Arc::new(Engine {
                moves: Arc::new(Detector),
                css: Arc::new(MemoryParsedCss::new(64 * 1024 * 1024)),
            }),
        );
        let result = (|| -> Result<_> {
            let selected = attempt.changes.lookup.pin(
                &self.source.config.repo_root,
                selected_base(&self.source.config, self.source.services.base.as_deref()),
            )?;
            let request = BaseRetentionRequest {
                selected: &selected,
                working_config: &self.source.config,
                head: self.source.head.as_ref(),
                install_scripts: self
                    .source
                    .services
                    .install_scripts
                    .or_else(|| {
                        self.source
                            .config
                            .input
                            .review
                            .as_ref()
                            .and_then(|review| review.base_install_scripts)
                    })
                    .unwrap_or(false),
            };
            self.source
                .services
                .startup
                .selected(BaseKey::new(&request)?);
            let preparation: &dyn BasePreparation = &attempt.changes;
            preparation.prepare_base(&request)
        })();
        let success = result.is_ok();
        let warnings = std::mem::take(
            &mut *self
                .source
                .pending
                .lock()
                .unwrap_or_else(|error| error.into_inner()),
        );
        let cache = cache
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        self.source.services.startup.complete(StartupReady {
            result,
            warnings,
            cache,
            lifetime: Some(attempt.lifetime.clone()),
        });
        success
    }
    fn finished(&self) {
        self.source.services.startup.finished();
    }
}

#[cfg(test)]
#[path = "_tests_/serve_startup_predicate_tests.rs"]
mod serve_startup_predicate_tests;
