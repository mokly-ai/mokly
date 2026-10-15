//! Generation-wide resource planning reads each reachable public input once.

use std::collections::{BTreeMap, BTreeSet, VecDeque};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::ModelEntry;
use mokly_model::{material::digest, namespace, routes};
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::Result;
use crate::urls::local_target;
use crate::workers::{RenderWorkers, check_cancelled};
use crate::{planning, resource_edges, resource_keys};

#[derive(Default)]
pub(crate) struct Resources {
    facts: BTreeMap<String, (String, Vec<String>)>,
}

impl Resources {
    pub(crate) fn prepare(
        config: &ResolvedConfig,
        catalogue: &PreparedCatalogue,
        tree: &dyn SourceTree,
        workers: &dyn RenderWorkers,
    ) -> Result<Self> {
        let mut queue = VecDeque::new();
        for entry in &catalogue.model.entries {
            check_cancelled(workers)?;
            let components = planning::components(&entry.metadata.path, catalogue);
            queue.extend(resource_keys::seeds(
                catalogue,
                entry,
                &routes::document(&entry.metadata.path, ColorScheme::Light),
                &components,
            ));
        }
        let mut result = Self::default();
        let mut seen = BTreeSet::new();
        while !queue.is_empty() {
            check_cancelled(workers)?;
            let paths: BTreeSet<_> = queue
                .drain(..)
                .filter_map(|(source, url)| target(&source, &url))
                .filter(|path| seen.insert(path.clone()))
                .collect();
            if paths.is_empty() {
                break;
            }
            let absolute: Vec<_> = paths
                .iter()
                .map(|path| config.repo_root.join(path))
                .collect();
            let _ = tree.prefetch(&absolute);
            for (path, absolute) in paths.into_iter().zip(absolute) {
                check_cancelled(workers)?;
                if !matches!(tree.project(&absolute), Ok(Some(node)) if node.kind == FileKind::File && node.identity.starts_with(&config.repo_root))
                {
                    continue;
                }
                let (hash, edges) = if path.ends_with(".css")
                    || path.ends_with(".html")
                    || path.ends_with(".htm")
                {
                    let Ok(bytes) = tree.read_public(&absolute) else {
                        continue;
                    };
                    (
                        digest(&bytes),
                        resource_edges::urls(&path, &bytes).unwrap_or_default(),
                    )
                } else {
                    let Ok(hash) = tree.public_digest(&absolute) else {
                        continue;
                    };
                    (hash, Vec::new())
                };
                queue.extend(
                    edges
                        .iter()
                        .map(|url| (format!("static/{path}"), url.clone())),
                );
                result.facts.insert(path, (hash, edges));
            }
        }
        Ok(result)
    }

    pub(crate) fn inputs(
        &self,
        catalogue: &PreparedCatalogue,
        entry: &ModelEntry,
        route: &str,
        components: &BTreeSet<String>,
    ) -> BTreeMap<String, String> {
        let mut queue = resource_keys::seeds(catalogue, entry, route, components);
        let mut seen = BTreeSet::new();
        let mut inputs = BTreeMap::new();
        while let Some((source, url)) = queue.pop_front() {
            let Some(path) = target(&source, &url) else {
                continue;
            };
            if !seen.insert(path.clone()) {
                continue;
            }
            if let Some((digest, edges)) = self.facts.get(&path) {
                inputs.insert(path.clone(), digest.clone());
                queue.extend(
                    edges
                        .iter()
                        .map(|url| (format!("static/{path}"), url.clone())),
                );
            }
        }
        inputs
    }
}

fn target(source: &str, url: &str) -> Option<String> {
    let target = local_target(source, url).ok()??;
    if target.starts_with(&namespace::generated("")) {
        return None;
    }
    target.strip_prefix("static/").map(String::from)
}
