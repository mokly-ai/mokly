//! Markdown source links join the private inventory without privatizing public files.

use std::collections::BTreeSet;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_catalogue::protection::is_reserved_source;
use mokly_model::routes;
use mokly_source_interface::tree::{FileKind, SourceTree};
use pulldown_cmark::{Event, Parser, Tag};

use crate::urls::decode_path;

pub(crate) fn collect(
    config: &ResolvedConfig,
    catalogue: &PreparedCatalogue,
    tree: &dyn SourceTree,
) -> BTreeSet<String> {
    let existing: BTreeSet<_> = catalogue.model.sources.iter().map(String::as_str).collect();
    let mut sources = BTreeSet::new();
    for entry in &catalogue.model.entries {
        let Some(body) = catalogue.documents.get(&entry.metadata.path) else {
            continue;
        };
        for event in Parser::new(body) {
            let Event::Start(Tag::Link { dest_url, .. } | Tag::Image { dest_url, .. }) = event
            else {
                continue;
            };
            let raw = dest_url.split(['?', '#']).next().unwrap_or(&dest_url);
            let Ok(decoded) = decode_path(raw) else {
                continue;
            };
            let Some(path) = routes::resolve(&entry.metadata.source.path, &decoded) else {
                continue;
            };
            let Ok(Some(node)) = tree.project(&config.repo_root.join(&path)) else {
                continue;
            };
            if node.kind != FileKind::File || !node.identity.starts_with(&config.repo_root) {
                continue;
            }
            let identity = relative(&node.identity, &config.repo_root);
            if existing.contains(path.as_str())
                || existing.contains(identity.as_str())
                || is_reserved_source(&path)
                || is_reserved_source(&identity)
            {
                sources.extend([path, identity]);
            }
        }
    }
    sources
}
