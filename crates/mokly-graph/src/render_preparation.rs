//! Encode full-algorithm records and select current exporter and common-closure modes.

use std::collections::{BTreeMap, BTreeSet, btree_map::Entry};
use std::iter;

use mokly_catalogue::config_types::DEFAULT_STORYBOOK_FOLDER;
use mokly_catalogue::render_sources::{JavaScriptGeneration, RenderMethod};
use mokly_model::material::digest;
use serde_json::to_vec;

use crate::render_closure::{Records, chain, handle_module};
use crate::render_inputs::{RenderInputs, preview_candidates};

/// The extra closure required by one exporting module.
#[derive(Clone, Copy)]
pub(crate) enum Common<'a> {
    /// Use the catalogue renderer closure.
    Renderer,
    /// Use the story's selected preview closure, if present.
    Preview(Option<&'a str>),
}

enum Preview {
    Absent,
    Named(String),
    Unnamed,
}

pub(crate) struct Prepared<'a> {
    pub(crate) records: Records<'a>,
    pub(crate) shared: String,
    exporters: BTreeSet<&'a str>,
    stories: BTreeMap<&'a str, &'a str>,
    previews: BTreeMap<&'a str, Preview>,
    unnamed_renderer: bool,
    pub(crate) renderer: Option<&'a str>,
}

impl<'a> Prepared<'a> {
    pub(crate) fn new(inputs: &RenderInputs<'a>) -> serde_json::Result<Self> {
        let generation = inputs.generation;
        let graph = &generation.modules;
        let stories: BTreeMap<_, _> = inputs
            .entries
            .values()
            .filter(|source| source.method == RenderMethod::Story)
            .filter_map(|source| handle_module(graph, &source.handle))
            .map(|module| {
                let folder = inputs
                    .storybook_folders
                    .get(module)
                    .map_or(DEFAULT_STORYBOOK_FOLDER, String::as_str);
                (module, folder)
            })
            .collect();
        let folders: BTreeSet<_> = inputs
            .storybook_folders
            .values()
            .map(String::as_str)
            .chain(stories.values().copied())
            .collect();
        let mut candidates = BTreeSet::new();
        let previews = folders
            .into_iter()
            .map(|folder| {
                let paths: Vec<_> = preview_candidates(folder).collect();
                let preview = paths
                    .iter()
                    .find_map(|path| {
                        if graph.contains_key(path) {
                            Some(Preview::Named(path.clone()))
                        } else if generation.resolution_digests.contains_key(path) {
                            Some(Preview::Unnamed)
                        } else {
                            None
                        }
                    })
                    .unwrap_or(Preview::Absent);
                candidates.extend(paths);
                (folder, preview)
            })
            .collect();
        let mut records = records(generation)?;
        let chained: BTreeSet<&String> = records.chains.values().flatten().collect();
        let shared: Vec<_> = generation
            .resolution_digests
            .iter()
            .filter(|(name, _)| {
                !chained.contains(name)
                    && !runtime_manifest(generation, name)
                    && !candidates.contains(*name)
            })
            .collect();
        let unattributed: Vec<_> = inputs
            .bindings
            .iter()
            .filter(|(handle, _)| generation.unattributed.contains(*handle))
            .map(|(handle, binding)| (handle, &binding.path, &binding.title))
            .collect();
        let shared = digest(&to_vec(&(&generation.environment, shared, unattributed))?);
        let unnamed_renderer = inputs
            .renderer
            .is_some_and(|renderer| !graph.contains_key(renderer));
        let mut exporters = BTreeSet::new();
        for (handle, binding) in inputs.bindings {
            let Some(exporter) = handle_module(graph, handle) else {
                continue;
            };
            exporters.insert(exporter);
            let declarer = inputs
                .declarations
                .get(handle)
                .map(String::as_str)
                .filter(|module| *module != exporter && graph.contains_key(*module));
            let encoded = to_vec(&(handle, &binding.path, &binding.title))?;
            for module in iter::once(exporter).chain(declarer) {
                records
                    .bindings
                    .entry(module)
                    .or_default()
                    .push(encoded.clone());
            }
        }
        Ok(Self {
            records,
            shared,
            exporters,
            stories,
            previews,
            unnamed_renderer,
            renderer: inputs.renderer,
        })
    }

    /// Each named preview closure is calculated once, even for several stories.
    pub(crate) fn named_previews(&self) -> impl Iterator<Item = &str> {
        self.previews.values().filter_map(|preview| match preview {
            Preview::Named(path) => Some(path.as_str()),
            _ => None,
        })
    }

    /// Current eligible exporters, selected directly into a caller's job vector.
    pub(crate) fn exporters(&self) -> impl Iterator<Item = (&'a str, Common<'_>)> + '_ {
        self.exporters.iter().copied().filter_map(|module| {
            let common = match self
                .stories
                .get(module)
                .map(|folder| &self.previews[folder])
            {
                Some(Preview::Absent) => Common::Preview(None),
                Some(Preview::Named(path)) => Common::Preview(Some(path)),
                Some(Preview::Unnamed) => return None,
                None if !self.unnamed_renderer => Common::Renderer,
                None => return None,
            };
            Some((module, common))
        })
    }
}

/// A non-React runtime manifest enters a key only through a consumed module chain.
fn runtime_manifest(generation: &JavaScriptGeneration, name: &str) -> bool {
    name.strip_suffix("/package.json").is_some_and(|directory| {
        generation
            .runtime_packages
            .iter()
            .filter(|package| package.as_str() != "react")
            .any(|package| {
                directory
                    .strip_suffix(package.as_str())
                    .is_some_and(dependency_root)
            })
    })
}

/// A dependency root is `node_modules` or one selected `.mokly-roots/{index}` root.
fn dependency_root(prefix: &str) -> bool {
    prefix.ends_with("node_modules/")
        || prefix
            .strip_suffix('/')
            .and_then(|prefix| prefix.rsplit_once("node_modules/.mokly-roots/"))
            .is_some_and(|(_, index)| !index.is_empty() && !index.contains('/'))
}

/// Encode every module and resolution record once, including explicit missing imports.
fn records(generation: &JavaScriptGeneration) -> serde_json::Result<Records<'_>> {
    let mut modules = BTreeMap::new();
    for (path, imports) in &generation.modules {
        let content = if path.ends_with(".module.css") {
            generation.class_map_digests.get(path)
        } else if path.ends_with(".css") {
            None
        } else {
            generation.module_digests.get(path).and_then(Option::as_ref)
        };
        let fields = (path, imports, content);
        let encoded = if let Some(styles) = generation.preview_stylesheet_digests.get(path) {
            to_vec(&(fields, styles))?
        } else {
            to_vec(&fields)?
        };
        let record = digest(&encoded);
        modules.insert(path.as_str(), to_vec(&(path, Some(record)))?);
    }
    for path in generation.modules.values().flatten() {
        if let Entry::Vacant(entry) = modules.entry(path.as_str()) {
            entry.insert(to_vec(&(path, Option::<&str>::None))?);
        }
    }
    let resolution = generation
        .resolution_digests
        .iter()
        .map(|(name, value)| Ok((name.as_str(), to_vec(&(name, value))?)))
        .collect::<serde_json::Result<_>>()?;
    let chains = generation
        .modules
        .keys()
        .map(|path| (path.as_str(), chain(path)))
        .collect();
    Ok(Records {
        modules,
        resolution,
        chains,
        bindings: BTreeMap::new(),
    })
}
