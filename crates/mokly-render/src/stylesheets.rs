//! Stylesheet roots follow ordered module edges and renderer exclusion.

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_css::resolution::Resolution;
use mokly_css::types::StylesheetRoot;
use mokly_sidecar::methods::source_packages::SourcePackage;

use crate::leases::ContextLease;
use crate::postcss::PostCss;
use crate::postcss_turns::Turns;
use crate::runtime::Runtime;
use crate::side::{SideInputs, dependency_roots};
use crate::sources;
use crate::stylesheet_cache::CachedStylesheets;
use crate::stylesheet_compiler::{CapturingCompiler, StylesheetPreparation};

/// Stylesheet services and context ownership for one attempt.
pub(crate) struct StylesheetAttempt {
    /// Compilation and its retained preparation probe.
    pub(crate) compiler: Arc<dyn StylesheetPreparation>,
    /// Optional PostCSS context shared with the compiler.
    pub(crate) context: Option<Arc<ContextLease>>,
}

impl StylesheetAttempt {
    /// Retire a used context after successful Serve head preparation when every root remains.
    pub(crate) fn retire_used(&self) {
        if let Some(context) = &self.context
            && context.used_live()
            && self.compiler.kept_every_record()
        {
            context.retire();
        }
    }
}

fn resolution(side: &SideInputs) -> Resolution {
    let module_resolution = &side.module_resolution;
    Resolution {
        config_directory: side.configuration_directory.clone(),
        dependency_aliases: side.dependency_aliases.clone(),
        aliases: module_resolution.aliases.clone(),
        conditions: module_resolution.conditions.clone(),
        main_fields: module_resolution.main_fields.clone(),
        dependency_roots: (0..dependency_roots(side).len())
            .map(mokly_compare::ancestor_roots::logical)
            .collect(),
        extensions: module_resolution.resolve_extensions.clone(),
        source_packages: module_resolution
            .source_packages
            .iter()
            .map(|packages| {
                packages
                    .iter()
                    .map(|(name, entry)| {
                        let folders = match entry {
                            SourcePackage::Disabled => None,
                            SourcePackage::Folders(folders) => Some(folders.clone()),
                        };
                        (name.clone(), folders)
                    })
                    .collect()
            })
            .collect(),
    }
}

pub(crate) fn attempt(
    runtime: &Runtime,
    config: &ResolvedConfig,
    side: &SideInputs,
) -> StylesheetAttempt {
    let tree = sources::reader(runtime, config, side);
    let resolution = resolution(side);
    let settings = format!(
        "{:?}:{:?}:{:?}:{:?}:{resolution:?}:{:?}:{:?}",
        config.input,
        config.modules,
        config.postcss().map(|_| &side.source_root),
        side.module_resolution,
        dependency_roots(side),
        side.repository_roots
    );
    let postcss = config.postcss().map(|module| {
        let released = {
            let mut cache = runtime
                .css
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            cache.purge();
            cache.releases.clone()
        };
        let lease = Arc::new(ContextLease::new(
            side.context.clone(),
            settings.clone(),
            runtime.pool.clone(),
            released,
        ));
        runtime.track_head_context(&lease);
        Arc::new(PostCss {
            usage: runtime.dependency_usage.clone(),
            lease,
            pool: runtime.pool.clone(),
            tree: tree.clone(),
            inventory_tree: runtime.inventory_tree.clone(),
            root: config.repo_root.clone(),
            side: side.clone(),
            module,
            cache: runtime.css.clone(),
            turns: Turns::default(),
            module_digests: Default::default(),
        })
    });
    let context = postcss.as_ref().map(|postcss| postcss.lease.clone());
    let compiler = Arc::new(
        CachedStylesheets::new(
            Arc::new(CapturingCompiler {
                tree: tree.clone(),
                root: config.repo_root.clone(),
                resolution,
                postcss,
                watch_sources: runtime
                    .watch_stylesheets
                    .then(|| runtime.inventory_tree.clone()),
                side: side.clone(),
                deferred_sources: Some(tree.clone()),
            }),
            tree,
            config.repo_root.clone(),
            settings,
            runtime.styles.clone(),
        )
        .with_head(runtime.head_styles.clone().unwrap_or_default()),
    );
    StylesheetAttempt { compiler, context }
}

#[tracing::instrument(name = "graph.prepare.stylesheet-roots", skip_all)]
pub(crate) fn roots(
    modules: &BTreeMap<String, Vec<String>>,
    renderer: Option<&str>,
    entries: &[String],
    loaders: &BTreeMap<String, String>,
) -> Vec<StylesheetRoot> {
    let ancestors = stylesheet_ancestors(modules);
    let mut renderer_files = Vec::new();
    if let Some(renderer) = renderer {
        visit(
            renderer,
            modules,
            &ancestors,
            &mut BTreeSet::new(),
            &mut renderer_files,
        );
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
    let mut seen_roots = BTreeSet::new();
    for entry in entries {
        if !seen_roots.insert(entry) {
            continue;
        }
        let mut files = Vec::new();
        visit(entry, modules, &ancestors, &mut BTreeSet::new(), &mut files);
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

fn stylesheet_ancestors(modules: &BTreeMap<String, Vec<String>>) -> BTreeSet<&str> {
    let mut parents: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
    let mut pending = VecDeque::new();
    for (path, imports) in modules {
        if path.ends_with(".css") {
            pending.push_back(path.as_str());
        }
        for imported in imports {
            parents.entry(imported).or_default().push(path);
            if imported.ends_with(".css") {
                pending.push_back(imported.as_str());
            }
        }
    }
    let mut ancestors = BTreeSet::new();
    while let Some(path) = pending.pop_front() {
        if ancestors.insert(path) {
            pending.extend(parents.get(path).into_iter().flatten().copied());
        }
    }
    ancestors
}

fn visit(
    path: &str,
    modules: &BTreeMap<String, Vec<String>>,
    ancestors: &BTreeSet<&str>,
    seen: &mut BTreeSet<String>,
    files: &mut Vec<String>,
) {
    let mut pending = vec![path];
    while let Some(path) = pending.pop() {
        if !path.ends_with(".css") && !ancestors.contains(path) {
            continue;
        }
        if !seen.insert(path.into()) {
            continue;
        }
        if path.ends_with(".css") {
            files.push(path.into());
        } else {
            pending.extend(
                modules
                    .get(path)
                    .into_iter()
                    .flatten()
                    .rev()
                    .map(String::as_str),
            );
        }
    }
}

pub(crate) fn ignored(path: &str, loaders: &BTreeMap<String, String>) -> bool {
    loaders.get(".css").is_some_and(|loader| loader == "empty")
        || path.ends_with(".module.css")
            && loaders
                .get(".module.css")
                .is_some_and(|loader| loader == "empty")
}

#[cfg(test)]
#[path = "_tests_/stylesheet_walk_tests.rs"]
mod stylesheet_walk_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_resolution_tests.rs"]
mod stylesheet_resolution_tests;
