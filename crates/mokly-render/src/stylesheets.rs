//! Stylesheet roots follow ordered module edges and renderer exclusion.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_css::compiler::Compiler;
use mokly_css::resolution::Resolution;
use mokly_css::resolver::{ImportResolver, SourceResolver};
use mokly_css::types::{CssProcessor, IdentityProcessor, StylesheetBundler, StylesheetRoot};

use crate::leases::ContextLease;
use crate::postcss::PostCss;
use crate::runtime::Runtime;
use crate::side::{SideInputs, dependency_roots};
use crate::sources;
use crate::stylesheet_cache::CachedStylesheets;

pub(crate) fn compiler(
    runtime: &Runtime,
    config: &ResolvedConfig,
    side: &SideInputs,
) -> Arc<dyn StylesheetBundler> {
    let tree = sources::reader(runtime, config, side);
    let resolution = &side.module_resolution;
    let resolver: Arc<dyn ImportResolver> = Arc::new(SourceResolver {
        tree: tree.clone(),
        repo_root: config.repo_root.clone(),
        settings: Resolution {
            config_directory: side.configuration_directory.clone(),
            aliases: resolution.aliases.clone(),
            conditions: resolution.conditions.clone(),
            main_fields: resolution.main_fields.clone(),
            dependency_roots: (1..dependency_roots(side).len())
                .map(|index| format!("node_modules/.mokly-roots/{index}"))
                .collect(),
            extensions: resolution.resolve_extensions.clone(),
        },
    });

    let processor = match &config.input.postcss {
        Some(module) => Arc::new(PostCss {
            lease: Arc::new(ContextLease {
                id: side.context.clone(),
                pool: runtime.pool.clone(),
                released: {
                    let mut cache = runtime
                        .css
                        .lock()
                        .unwrap_or_else(|error| error.into_inner());
                    cache.purge();
                    cache.releases.clone()
                },
                used: AtomicBool::new(false),
            }),
            pool: runtime.pool.clone(),
            tree: tree.clone(),
            inventory_tree: runtime.inventory_tree.clone(),
            resolver: resolver.clone(),
            root: config.repo_root.clone(),
            side: side.clone(),
            module: config
                .file
                .parent()
                .unwrap_or(&config.repo_root)
                .join(module),
            cache: runtime.css.clone(),
        }) as Arc<dyn CssProcessor>,
        None => Arc::new(IdentityProcessor),
    };
    let settings = format!(
        "{:?}:{:?}:{:?}",
        config.input, side.source_root, side.module_resolution
    );
    Arc::new(CachedStylesheets {
        inner: Arc::new(Compiler {
            tree: tree.clone(),
            repo_root: config.repo_root.clone(),
            resolver,
            processor,
        }),
        tree,
        root: config.repo_root.clone(),
        settings,
        shared: runtime.styles.clone(),
        local: Mutex::new(
            runtime
                .styles
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .empty_peer(),
        ),
    })
}

pub(crate) fn roots(
    modules: &BTreeMap<String, Vec<String>>,
    renderer: Option<&str>,
    entries: &[String],
    loaders: &BTreeMap<String, String>,
) -> Vec<StylesheetRoot> {
    let mut renderer_files = Vec::new();
    if let Some(renderer) = renderer {
        visit(renderer, modules, &mut BTreeSet::new(), &mut renderer_files);
    }
    let excluded: BTreeSet<_> = renderer_files.iter().cloned().collect();
    renderer_files.retain(|path| !ignored(path, loaders));
    let mut roots = Vec::new();
    if let Some(renderer) = renderer
        && !renderer_files.is_empty()
    {
        roots.push(StylesheetRoot {
            path: renderer.into(),
            stylesheets: renderer_files,
            excluded: BTreeSet::new(),
            local_css: false,
        });
    }
    for entry in entries {
        let mut files = Vec::new();
        visit(entry, modules, &mut BTreeSet::new(), &mut files);
        files.retain(|file| !excluded.contains(file) && !ignored(file, loaders));
        if !files.is_empty() {
            roots.push(StylesheetRoot {
                path: entry.clone(),
                stylesheets: files,
                excluded: excluded.clone(),
                local_css: false,
            });
        }
    }
    roots
}

fn visit(
    path: &str,
    modules: &BTreeMap<String, Vec<String>>,
    seen: &mut BTreeSet<String>,
    files: &mut Vec<String>,
) {
    if !seen.insert(path.into()) {
        return;
    }
    if path.ends_with(".css") {
        files.push(path.into());
        return;
    }
    for dependency in modules.get(path).into_iter().flatten() {
        visit(dependency, modules, seen, files);
    }
}

pub(crate) fn ignored(path: &str, loaders: &BTreeMap<String, String>) -> bool {
    loaders.get(".css").is_some_and(|loader| loader == "empty")
        || path.ends_with(".module.css")
            && loaders
                .get(".module.css")
                .is_some_and(|loader| loader == "empty")
}
