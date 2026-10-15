//! Native graph composition root; consumer JavaScript is a separate adapter.

use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_css::compiler::Compiler;
use mokly_css::error::CssError;
use mokly_css::resolution::Resolution;
use mokly_css::resolver::SourceResolver;
use mokly_css::types::{CssProcessor, IdentityProcessor, ProcessedCss};
use mokly_graph::cache::MemoryCache;
use mokly_graph::error::{GraphError, Result};
use mokly_graph::graph::Graph;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{GraphFactory, RenderGraph};
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::DeferredFragments;
use mokly_source_interface::tree::SourceTree;

/// Resolved-config native graph factory, injected into the build service.
pub(super) struct NativeGraphs {
    pub(super) tree: Arc<dyn SourceTree>,
}

impl GraphFactory for NativeGraphs {
    fn create(&self, config: &ResolvedConfig) -> Result<Arc<dyn RenderGraph>> {
        let tree: Arc<dyn SourceTree> = Arc::new(SourceSnapshot::new(self.tree.clone()));
        let processor: Arc<dyn CssProcessor> = if let Some(module) = &config.input.postcss {
            Arc::new(DeferredPostcss {
                module: module.clone(),
            })
        } else {
            Arc::new(IdentityProcessor)
        };
        let workers =
            ThreadWorkers::new(std::thread::available_parallelism().map_or(1, usize::from))?;
        if let Some(module) = &config.input.postcss {
            return Err(GraphError::Css {
                source: CssError::PostcssUnavailable {
                    module: module.clone(),
                },
            });
        }
        Ok(Arc::new(Graph {
            inputs: Default::default(),
            tree: tree.clone(),
            composer: Arc::new(HtmlComposer {
                fragments: Arc::new(DeferredFragments),
            }),
            stylesheets: Arc::new(Compiler {
                tree: tree.clone(),
                repo_root: config.repo_root.clone(),
                resolver: Arc::new(SourceResolver {
                    settings: resolution(config),
                    tree: tree.clone(),
                    repo_root: config.repo_root.clone(),
                }),
                processor,
            }),
            cache: Arc::new(MemoryCache::new(256 * 1024 * 1024)),
            workers: Arc::new(workers),
            version: env!("CARGO_PKG_VERSION").into(),
        }))
    }
}

struct DeferredPostcss {
    module: String,
}
impl CssProcessor for DeferredPostcss {
    fn process(&self, _path: &str, _source: &str) -> mokly_css::error::Result<ProcessedCss> {
        Err(CssError::PostcssUnavailable {
            module: self.module.clone(),
        })
    }
}

fn resolution(config: &ResolvedConfig) -> Resolution {
    let directory = config.file.parent().unwrap_or(&config.repo_root);
    let config_directory = mokly_catalogue::config::relative(directory, &config.repo_root);
    let input = config.input.module_resolution.clone().unwrap_or_default();
    Resolution {
        config_directory,
        aliases: input.aliases.unwrap_or_default(),
        conditions: input.conditions.unwrap_or_default(),
        main_fields: input.main_fields.unwrap_or_default(),
        package_roots: input
            .package_roots
            .unwrap_or_default()
            .iter()
            .map(|root| mokly_catalogue::config::relative(&directory.join(root), &config.repo_root))
            .collect(),
        extensions: input.resolve_extensions.unwrap_or_default(),
    }
}
