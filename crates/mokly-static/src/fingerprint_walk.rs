//! Metadata-only root walks exclude unrelated repository files and output paths.

use std::collections::BTreeSet;
use std::path::PathBuf;

use mokly_catalogue::protection::SourcePolicy;
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::Result;
use crate::fingerprint::source;
use crate::input_selection::Selection;

pub(crate) fn capture(tree: &dyn SourceTree, selection: &Selection) -> Result<BTreeSet<PathBuf>> {
    let mut selected = BTreeSet::new();
    let mut pending: Vec<_> = selection
        .config
        .roots
        .iter()
        .enumerate()
        .map(|(index, root)| (index, root.directory.clone(), root.identity.clone()))
        .collect();
    while let Some((index, logical, physical)) = pending.pop() {
        if selection
            .excluded
            .iter()
            .any(|output| physical.starts_with(output) || logical.starts_with(output))
        {
            continue;
        }
        let children = match tree.children(&physical) {
            Err(error) if error.is_vanished() => continue,
            result => source(result)?,
        };
        for child in children {
            let path = logical.join(&child.name);
            match child.kind {
                FileKind::Directory
                    if SourcePolicy::searches_directory(&child.name)
                        && child.name != ".mokly-export-reservations" =>
                {
                    pending.push((index, path, physical.join(child.name)));
                }
                FileKind::File if selection.selected(index, &path) => {
                    selected.insert(path);
                }
                _ => {}
            }
        }
    }
    Ok(selected)
}
