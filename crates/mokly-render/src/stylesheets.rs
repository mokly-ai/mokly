//! Stylesheet roots follow ordered module edges and renderer exclusion.

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_css::resolution::Resolution;
use mokly_css::types::StylesheetRoot;
use mokly_css::vite;

use crate::leases::ContextLease;
use crate::postcss::PostCss;
use crate::postcss_turns::Turns;
use crate::runtime::Runtime;
use crate::side::{SideInputs, dependency_roots};
use crate::sources;
use crate::stylesheet_cache::CachedStylesheets;
use crate::stylesheet_compiler::{
    CapturingCompiler, RootCompiler, StylesheetPreparation, ViteRootCompiler,
};
use crate::vite_stylesheets::ViteStylesheets;

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

pub(crate) fn attempt(
    runtime: &Runtime,
    config: &ResolvedConfig,
    side: &SideInputs,
) -> StylesheetAttempt {
    let tree = sources::reader(runtime, config, side);
    let module_resolution = &side.module_resolution;
    let resolution = Resolution {
        config_directory: side.configuration_directory.clone(),
        dependency_aliases: side.dependency_aliases.clone(),
        aliases: module_resolution.aliases.clone(),
        conditions: module_resolution.conditions.clone(),
        main_fields: module_resolution.main_fields.clone(),
        dependency_roots: (0..dependency_roots(side).len())
            .map(mokly_compare::ancestor_roots::logical)
            .collect(),
        extensions: module_resolution.resolve_extensions.clone(),
    };
    let mut settings = format!(
        "{:?}:{:?}:{:?}:{:?}:{resolution:?}:{:?}:{:?}",
        config.input,
        config.modules,
        config.postcss().map(|_| &side.source_root),
        side.module_resolution,
        dependency_roots(side),
        side.repository_roots
    );
    if config.vite() {
        settings.push_str(":vite:");
        settings.push_str(&side.source_root.to_string_lossy());
    }
    let postcss = config.postcss().filter(|_| !config.vite()).map(|module| {
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
    let base = CapturingCompiler {
        tree: tree.clone(),
        root: config.repo_root.clone(),
        resolution,
        postcss,
        watch_sources: runtime
            .watch_stylesheets
            .then(|| runtime.inventory_tree.clone()),
        side: side.clone(),
        deferred_sources: Some(tree.clone()),
    };
    let compiler: Arc<dyn RootCompiler> = if config.vite() {
        Arc::new(ViteRootCompiler {
            base,
            transform: Arc::new(ViteStylesheets::new(runtime, config, side)),
        })
    } else {
        Arc::new(base)
    };
    let compiler = Arc::new(
        CachedStylesheets::new(
            compiler,
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
    scan_roots(modules, renderer, entries, loaders, false)
}

pub(crate) fn scan_roots(
    modules: &BTreeMap<String, Vec<String>>,
    renderer: Option<&str>,
    entries: &[String],
    loaders: &BTreeMap<String, String>,
    adapter: bool,
) -> Vec<StylesheetRoot> {
    let stylesheet: fn(&str) -> bool = if adapter {
        vite::stylesheet
    } else {
        |path| path.ends_with(".css")
    };
    let ancestors = stylesheet_ancestors_for(modules, stylesheet);
    let files_for = |module: &str| {
        let mut files = Vec::new();
        let mut seen = BTreeSet::new();
        visit_for(
            module, modules, &ancestors, &mut seen, &mut files, stylesheet,
        );
        files
    };
    let mut renderer_files = Vec::new();
    if let Some(renderer) = renderer {
        renderer_files = files_for(renderer);
    }
    let excluded: BTreeSet<_> = renderer_files.iter().cloned().collect();
    renderer_files.retain(|path| !ignored_for(path, loaders, adapter));
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
        let mut files = files_for(entry);
        files.retain(|file| !excluded.contains(file) && !ignored_for(file, loaders, adapter));
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

#[cfg(test)]
fn stylesheet_ancestors(modules: &BTreeMap<String, Vec<String>>) -> BTreeSet<&str> {
    stylesheet_ancestors_for(modules, |path| path.ends_with(".css"))
}

fn stylesheet_ancestors_for(
    modules: &BTreeMap<String, Vec<String>>,
    is_stylesheet: fn(&str) -> bool,
) -> BTreeSet<&str> {
    let mut parents: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
    let mut pending = VecDeque::new();
    for (path, imports) in modules {
        if is_stylesheet(path) {
            pending.push_back(path.as_str());
        }
        for imported in imports {
            parents.entry(imported).or_default().push(path);
            if is_stylesheet(imported) {
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

#[cfg(test)]
fn visit(
    path: &str,
    modules: &BTreeMap<String, Vec<String>>,
    ancestors: &BTreeSet<&str>,
    seen: &mut BTreeSet<String>,
    files: &mut Vec<String>,
) {
    visit_for(path, modules, ancestors, seen, files, |path| {
        path.ends_with(".css")
    });
}

fn visit_for(
    path: &str,
    modules: &BTreeMap<String, Vec<String>>,
    ancestors: &BTreeSet<&str>,
    seen: &mut BTreeSet<String>,
    files: &mut Vec<String>,
    is_stylesheet: fn(&str) -> bool,
) {
    let mut pending = vec![path];
    while let Some(path) = pending.pop() {
        if !is_stylesheet(path) && !ancestors.contains(path) {
            continue;
        }
        if !seen.insert(path.into()) {
            continue;
        }
        if is_stylesheet(path) {
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

pub(crate) fn ignored_for(path: &str, loaders: &BTreeMap<String, String>, adapter: bool) -> bool {
    loaders.get(".css").is_some_and(|loader| loader == "empty")
        || (if adapter {
            vite::css_module(path)
        } else {
            path.ends_with(".module.css")
        }) && loaders
            .get(".module.css")
            .is_some_and(|loader| loader == "empty")
}

#[cfg(test)]
#[path = "_tests_/stylesheet_walk_tests.rs"]
mod stylesheet_walk_tests;
