//! Native command composition over an isolated design Git fixture.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config::{ConfigLoader, Loader, relative};
use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_cli::build::{BuildChanges, BuildService, CatalogueBuild};
use mokly_cli::cancellation::BuildCancellation;
use mokly_cli::grammar::{Build, Common};
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_cli::static_build::{Phase, Phases};
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_types::{Comparison, ComparisonRequest, ComparisonResult};
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_model::material::catalogue_key;
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::workers::Diagnostics;
use unimock::Unimock;

use crate::{changes_runtime, render_runtime};

pub struct Session {
    service: Box<dyn BuildService>,
    pool: Arc<dyn SidecarPool>,
    options: Build,
    identity: String,
    comparison: Box<dyn Comparison>,
    baseline: Mutex<Option<(ComparisonRequest, Arc<dyn RenderGeneration>)>>,
    config: Arc<dyn ConfigLoader>,
    catalogue: Arc<dyn CatalogueBuilder>,
    graphs: Arc<dyn GraphFactory>,
}

impl Session {
    pub fn new(root: &Path) -> Self {
        let common = Common {
            config: Some("examples/basic/mokly.config.json".into()),
            base: Some("fixture-base".into()),
            ..Common::default()
        };
        let tree = Arc::new(WorkingTree);
        let loader = Arc::new(Loader { tree: tree.clone() });
        let config = loader.load(root, common.config.as_deref()).unwrap();
        let cancellation = Arc::new(BuildCancellation::new(Arc::new(Unimock::new(()))));
        let redactor = Arc::new(Redactor::default());
        let services = render_runtime::Services::new(
            tree.clone(),
            root,
            &config.repo_root,
            &common,
            Arc::new(ProbeDiagnostics),
            cancellation.clone(),
        )
        .unwrap();
        let catalogue: Arc<dyn CatalogueBuilder> = Arc::new(Builder {
            tree: tree.clone(),
            discovery: Arc::new(Discoverer { tree }),
            definitions: services.runtime.clone(),
        });
        let graphs: Arc<dyn GraphFactory> = services.runtime.clone();
        let service = CatalogueBuild {
            inputs: None,
            changes: changes_runtime::service(
                services.runtime.clone(),
                cancellation.clone(),
                changes_runtime::pin(
                    &config,
                    &Build {
                        common: common.clone(),
                        out: None,
                        strict: true,
                        no_changes: false,
                    },
                    cancellation.clone(),
                )
                .unwrap(),
                Style {
                    mode: Mode::Plain,
                    color: false,
                    ascii: true,
                    columns: 120,
                },
                redactor,
                Arc::new(ProbeDiagnostics),
            ),
            cancellation,
            config: loader.clone(),
            catalogue: catalogue.clone(),
            graphs: graphs.clone(),
        };
        Self {
            service: Box::new(service),
            pool: services.pool,
            identity: catalogue_key(&relative(&config.file, &config.repo_root)).unwrap(),
            comparison: Box::new(Engine {
                moves: Arc::new(Detector),
                css: Arc::new(MemoryParsedCss::new(64 * 1024 * 1024)),
            }),
            baseline: Mutex::new(None),
            config: loader,
            catalogue,
            graphs,
            options: Build {
                common,
                out: None,
                strict: true,
                no_changes: false,
            },
        }
    }
    pub fn compare(&self, root: &Path) -> Arc<ComparisonResult> {
        let baseline = self.baseline.lock().unwrap().clone();
        if let Some((request, before)) = baseline {
            let config = self
                .config
                .load(root, self.options.common.config.as_deref())
                .unwrap();
            let prepared = self.catalogue.prepare(&config, None).unwrap();
            assert!(prepared.deferred_modules.is_empty());
            assert!(prepared.warnings.is_empty());
            let graph = self.graphs.create(&config).unwrap();
            let after = graph.prepare(config, prepared, None).unwrap();
            let result = self.comparison.compare(&request, before, after).unwrap();
            assert!(result.after.render_all().unwrap().warnings.is_empty());
            return Arc::new(result);
        }
        let summary = self.service.run(root, &self.options).unwrap();
        assert!(summary.warnings.is_empty(), "{:?}", summary.warnings);
        let BuildChanges::Ready(result) = summary.changes else {
            panic!("{:?}", summary.changes)
        };
        *self.baseline.lock().unwrap() = Some((
            ComparisonRequest {
                base_ref: result.snapshot.base_ref.clone(),
                base_commit: result.review.base_commit.clone(),
                catalogue_identity: self.identity.clone(),
            },
            result.before.clone(),
        ));
        result
    }
}
impl Drop for Session {
    fn drop(&mut self) {
        self.pool.shutdown().unwrap();
    }
}

struct ProbeDiagnostics;
impl Diagnostics for ProbeDiagnostics {
    fn emit(&self, message: &str) {
        eprintln!("{message}");
    }
}

impl Phases for ProbeDiagnostics {
    fn note(&self, message: &str) {
        print!("{message}");
    }
    fn start(&self, phase: Phase) {
        assert!(matches!(phase, Phase::Comparing(_)));
    }
    fn diagnostic(&self, message: &str) {
        eprintln!("{message}");
    }
    fn warnings(&self, warnings: &[Warning]) {
        assert!(warnings.is_empty());
    }
    fn changes(&self, _: &BuildChanges) {}
}
