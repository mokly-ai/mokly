//! Reserve explicitly referenced Markdown assets before CSS input classification.

use std::collections::{BTreeMap, BTreeSet};

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::catalogue::EntryContent;
use mokly_model::routes;
use mokly_source_interface::tree::{FileKind, SourceTree};
use pulldown_cmark::{Event, Parser, Tag};

use crate::error::{Result, invalid};
use crate::urls::decode_path;

pub(crate) struct MarkdownAssets {
    pub(crate) files: BTreeSet<String>,
    pub(crate) documents: BTreeMap<String, BTreeSet<String>>,
}

pub(crate) fn collect(
    config: &ResolvedConfig,
    catalogue: &PreparedCatalogue,
    tree: &dyn SourceTree,
) -> Result<MarkdownAssets> {
    let mut assets = MarkdownAssets {
        files: BTreeSet::new(),
        documents: BTreeMap::new(),
    };
    for entry in &catalogue.model.entries {
        if !matches!(entry.content, EntryContent::Document { .. }) {
            continue;
        }
        let Some(body) = catalogue.documents.get(&entry.metadata.path) else {
            continue;
        };
        for event in Parser::new(body) {
            let Event::Start(Tag::Link { dest_url, .. } | Tag::Image { dest_url, .. }) = event
            else {
                continue;
            };
            if dest_url.contains(':') || dest_url.starts_with('#') {
                continue;
            }
            let raw = dest_url.split(['?', '#']).next().unwrap_or(&dest_url);
            let extension = raw.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
            if !["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "pdf"]
                .contains(&extension.as_str())
            {
                continue;
            }
            let decoded = match decode_path(raw) {
                Ok(path) => path,
                Err(_) => continue,
            };
            let Some(path) = routes::resolve(&entry.metadata.source.path, &decoded) else {
                continue;
            };
            let root = &config.roots[entry.metadata.root_index];
            let absolute = config.repo_root.join(&path);
            let Some(suffix) = absolute.strip_prefix(&root.directory).ok() else {
                return Err(invalid(
                    &entry.metadata.source.path,
                    format!(
                        "{}: resource {dest_url} is outside the root",
                        entry.metadata.source.path
                    ),
                ));
            };
            let mut cursor = root.directory.clone();
            let mut node = None;
            for segment in suffix.components() {
                cursor.push(segment);
                let current = match tree.project(&cursor) {
                    Ok(Some(node)) => node,
                    _ => break,
                };
                if current.lexical_kind == FileKind::Symlink
                    || !current.identity.starts_with(&root.identity)
                {
                    return Err(invalid(
                        &entry.metadata.source.path,
                        format!(
                            "{}: resource {dest_url} must be a regular file without symlink aliases",
                            entry.metadata.source.path
                        ),
                    ));
                }
                node = Some(current);
            }
            if let Some(node) =
                node.filter(|node| node.kind == FileKind::File && cursor == absolute)
            {
                let path = relative(&node.identity, &config.repo_root);
                assets.files.insert(path.clone());
                assets
                    .documents
                    .entry(entry.metadata.path.clone())
                    .or_default()
                    .insert(path);
            }
        }
    }
    Ok(assets)
}
