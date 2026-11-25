//! Serve shares one JavaScript pool and cache across preparation and live views.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::Builder;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_cli::build::BuildError;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::cancelled_work::CancellableTree;
use mokly_cli::grammar::Common;
use mokly_cli::output::Style;
use mokly_cli::redaction::Redactor;
use mokly_cli::serve::{CatalogueServe, PreparedServe, ServePreparation};
use mokly_cli::serve_settings::ServeSettings;
use mokly_compare::render_writer::DocumentWriter;
use mokly_graph::cache::RenderCache;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::write_activity::WriteActivity;
use mokly_render::runtime::Runtime;
use mokly_server::publication::Publications;
use mokly_sidecar::methods::BundleCapture;
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::workers::Diagnostics;
use mokly_source_interface::tree::SourceTree;

use crate::bundle_runtime::Reporting;
use crate::cache_directory::ServeDirectory;
use crate::render_runtime::Services;
use crate::render_store_runtime;
use crate::serve_eager::{EagerAttempts, EagerStarts};
use crate::serve_eager_diagnostics::{DiagnosticRouting, RootDiagnostics};
use crate::serve_eager_directory::RootDirectory;
use crate::serve_eager_source_gate::{SourceStarts, StartupSources};
use crate::serve_pool::{PoolScheduling, ServePool};
use crate::terminal::Terminal;
use mokly_cli::options;

pub(super) struct ServeServices {
    pub(super) source_starts: Arc<dyn SourceStarts>,
    pub(super) eager: Arc<dyn EagerStarts>,
    pub(super) diagnostics: Arc<dyn DiagnosticRouting>,
    documents: Arc<DocumentWriter>,
    pub(super) sidecars: Arc<dyn PoolScheduling>,
    pub(super) runtime: Arc<Runtime>,
    pub(super) config: mokly_catalogue::config_types::ResolvedConfig,
    pub(super) tree: Arc<dyn SourceTree>,
    pub(super) preparation: Arc<dyn ServePreparation>,
    pub(super) pool: Arc<dyn SidecarPool>,
    pub(super) cache_announced: Arc<AtomicBool>,
    head_published: Arc<AtomicBool>,
}

/// Command output needed to share a directory notice with later base attempts.
pub(super) struct ServeOutput {
    pub(super) terminal: Arc<dyn Terminal>,
    pub(super) style: Style,
    pub(super) redactor: Arc<Redactor>,
}

impl ServeServices {
    pub(super) fn activity(&self) -> Arc<dyn WriteActivity> {
        self.documents.activity()
    }

    pub(super) fn bind_publications(&self, publications: Arc<dyn Publications>) {
        render_store_runtime::bind(&self.documents, publications);
    }
    /// Only an installed initial head and successful Serve readiness end startup capture.
    pub(super) fn head_published(&self) {
        self.head_published.store(true, Ordering::Release);
        self.source_starts.ready();
    }

    pub(super) fn new(
        cwd: &Path,
        common: &Common,
        diagnostics: Arc<dyn Diagnostics>,
        cancellation: Arc<dyn Cancellation>,
        cache: Arc<dyn RenderCache>,
        output: ServeOutput,
    ) -> Result<Self, BuildError> {
        let diagnostics: Arc<dyn DiagnosticRouting> = Arc::new(RootDiagnostics::new(diagnostics));
        let cache_announced = Arc::new(AtomicBool::new(false));
        let reporting = Reporting {
            directory: Arc::new(RootDirectory {
                routing: diagnostics.clone(),
                inner: Arc::new(ServeDirectory {
                    announced: cache_announced.clone(),
                    terminal: output.terminal,
                    style: output.style.clone(),
                    redactor: output.redactor,
                }),
            }),
            mode: output.style.mode,
        };
        let tree: Arc<dyn SourceTree> = Arc::new(CancellableTree {
            inner: Arc::new(WorkingTree),
            cancellation: cancellation.clone(),
        });
        let loader = Arc::new(Loader { tree: tree.clone() });
        let mut config = match loader.load(cwd, common.config.as_deref()) {
            Ok(config) => config,
            Err(source) => return Err(BuildError::Catalogue { source }),
        };
        options::apply_base_install_scripts(&mut config, common.base_install_scripts_override());
        let documents = render_store_runtime::store(
            &config.repo_root,
            cancellation.clone(),
            cache.clone(),
            reporting.directory.clone(),
            diagnostics.clone(),
            reporting.mode,
        );
        let services = match Services::new(
            tree.clone(),
            cwd,
            &config.repo_root,
            common,
            diagnostics.clone(),
            cancellation,
            cache,
            reporting,
        ) {
            Ok(services) => services,
            Err(source) => {
                return Err(BuildError::Rendering {
                    source: Box::new(source),
                    warnings: Vec::new(),
                });
            }
        };
        let source_starts: Arc<dyn SourceStarts> = Arc::new(StartupSources::default());
        let sidecars: Arc<dyn PoolScheduling> = Arc::new(
            ServePool::new(services.pool.clone(), services.pool)
                .with_diagnostics(diagnostics.clone())
                .with_activity(documents.activity()),
        );
        let pool = sidecars.pool(None);
        let mut runtime = (*services.runtime)
            .clone()
            .with_serve_edit_plans()
            .with_document_store(documents.clone())
            .with_stylesheet_watching();
        runtime.pool = pool.clone();
        let runtime = Arc::new(runtime);
        let head_published = Arc::new(AtomicBool::new(false));
        let eager: Arc<dyn EagerStarts> = Arc::new(EagerAttempts::default());
        let preparation = Arc::new(AttemptPreparation {
            eager: Some(eager.clone()),
            tree: tree.clone(),
            runtime: runtime.clone(),
            settings: ServeSettings::new(&config),
            head_published: head_published.clone(),
        });
        Ok(Self {
            source_starts,
            eager,
            diagnostics,
            documents,
            sidecars,
            runtime,
            config,
            tree,
            preparation,
            pool,
            cache_announced,
            head_published,
        })
    }
}

impl Drop for ServeServices {
    fn drop(&mut self) {
        self.documents.shutdown();
    }
}

struct AttemptPreparation {
    eager: Option<Arc<dyn EagerStarts>>,
    settings: ServeSettings,
    tree: Arc<dyn SourceTree>,
    runtime: Arc<Runtime>,
    head_published: Arc<AtomicBool>,
}

#[cfg(test)]
#[path = "_tests_/eager_startup_tests.rs"]
mod eager_startup_tests;
impl ServePreparation for AttemptPreparation {
    fn adopted(&self, prepared: &PreparedServe) {
        if let Some(eager) = &self.eager {
            eager.adopted(prepared);
        }
    }

    fn discard(&self) {
        if let Some(eager) = &self.eager {
            eager.discard();
        }
    }

    fn prepare(&self, cwd: &Path, options: &Common) -> Result<PreparedServe, BuildError> {
        let tree: Arc<dyn SourceTree> = Arc::new(SourceSnapshot::new(self.tree.clone()));
        let loader = Loader { tree: tree.clone() };
        let mut config = match loader.load(cwd, options.config.as_deref()) {
            Ok(config) => config,
            Err(source) => {
                self.discard();
                return Err(BuildError::Catalogue { source });
            }
        };
        options::apply_base_install_scripts(&mut config, options.base_install_scripts_override());
        if let Err(error) = self.settings.validate(&config) {
            self.discard();
            return Err(error);
        }
        let mut runtime = self.runtime.with_tree(tree.clone());
        runtime.bundle_capture = if self.head_published.load(Ordering::Acquire) {
            BundleCapture::ServeEdit
        } else {
            BundleCapture::Full
        };
        if let Err(source) = runtime.expand_storybook_roots(&mut config) {
            self.discard();
            return Err(BuildError::Catalogue { source });
        }
        if let Some(eager) = &self.eager {
            eager.start(&config);
        }
        let runtime = Arc::new(runtime);
        let preparation: &dyn ServePreparation = &CatalogueServe {
            config: Arc::new(PreparedConfig(config)),
            catalogue: Arc::new(Builder {
                tree: tree.clone(),
                discovery: Arc::new(Discoverer { tree }),
                definitions: runtime.clone(),
            }),
            graphs: runtime,
        };
        let result = preparation.prepare(cwd, options);
        if result.is_err() {
            self.discard();
        }
        result
    }
}

struct PreparedConfig(mokly_catalogue::config_types::ResolvedConfig);
impl ConfigLoader for PreparedConfig {
    fn load(
        &self,
        _cwd: &Path,
        _config: Option<&str>,
    ) -> mokly_catalogue::error::Result<mokly_catalogue::config_types::ResolvedConfig> {
        Ok(self.0.clone())
    }
}
