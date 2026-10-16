//! Stylesheet roots follow ordered module edges and renderer exclusion.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_css::compiler::Compiler;
use mokly_css::resolution::Resolution;
use mokly_css::resolver::{ImportResolver, SourceResolver};
use mokly_css::types::{CssProcessor, IdentityProcessor, StylesheetBundler, StylesheetRoot};
use mokly_source_interface::tree::SourceTree;

use crate::postcss::PostCss;
use crate::runtime::Runtime;
use crate::side::{SideInputs, dependency_roots};
use crate::sources::SideTree;

pub(crate) fn compiler(
    runtime: &Runtime,
    config: &ResolvedConfig,
    side: &SideInputs,
) -> Arc<dyn StylesheetBundler> {
    let tree: Arc<dyn SourceTree> = Arc::new(SideTree {
        _base: runtime.base.clone(),
        usage: runtime.dependency_usage.clone(),
        aliases: side.dependency_aliases.clone(),
        sources: runtime.tree.clone(),
        dependencies: runtime.dependency_tree.clone(),
        root: config.repo_root.clone(),
        dependency_roots: dependency_roots(side),
        repository_roots: side.repository_roots.clone(),
    });
    let resolution = &side.module_resolution;
    let resolver: Arc<dyn ImportResolver> = Arc::new(SourceResolver {
        tree: tree.clone(),
        repo_root: config.repo_root.clone(),
        settings: Resolution {
            config_directory: side.configuration_directory.clone(),
            dependency_aliases: side.dependency_aliases.clone(),
            aliases: resolution.aliases.clone(),
            conditions: resolution.conditions.clone(),
            main_fields: resolution.main_fields.clone(),
            dependency_roots: (0..dependency_roots(side).len())
                .map(mokly_compare::ancestor_roots::logical)
                .collect(),
            extensions: resolution.resolve_extensions.clone(),
        },
    });

    let processor = match &config.input.postcss {
        Some(module) => Arc::new(PostCss {
            usage: runtime.dependency_usage.clone(),
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
    Arc::new(Compiler {
        tree: tree.clone(),
        repo_root: config.repo_root.clone(),
        resolver,
        processor,
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
