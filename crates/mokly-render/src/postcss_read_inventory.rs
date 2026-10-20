//! Select read witnesses without changing plugin privacy or catalogue membership.

use std::collections::BTreeSet;
use std::path::Path;

use mokly_catalogue::config::relative;
use mokly_sidecar::postcss_evidence::{Evidence, Read};
use mokly_source_interface::read_evidence::{ReadBaseline, ReadEvidence};
use mokly_source_interface::tree::SourceTree;

use crate::postcss_inventory::{Inventory, normalize};
use crate::side::SideInputs;
use crate::source_paths::SOURCE_INPUT_PREFIX;

pub(crate) fn collect(
    tree: &dyn SourceTree,
    root: &Path,
    side: &SideInputs,
    inventory: &Inventory,
    evidence: &Evidence,
) -> ReadEvidence {
    let mut result = ReadEvidence::default();
    for (path, digest) in &inventory.inputs {
        result.insert(
            format!("{SOURCE_INPUT_PREFIX}{path}"),
            ReadBaseline::Late(digest.clone()),
        );
    }
    let modules: BTreeSet<_> = evidence
        .modules
        .iter()
        .filter_map(|file| logical(file, side))
        .collect();
    for name in &modules {
        if let Ok(Some(node)) = tree.project(&root.join(name))
            && let Ok(digest) = tree.digest(&node.identity)
        {
            result.insert(name.clone(), ReadBaseline::Late(digest));
        }
    }
    for read in &evidence.reads {
        let (path, baseline) = match read {
            Read::WholeFile { path, digest } => {
                (path, ReadBaseline::ObservedWholeFile(digest.clone()))
            }
            Read::ByteRange {
                path,
                digest,
                offset,
                length,
                eof,
            } => (
                path,
                ReadBaseline::ObservedRange {
                    offset: *offset,
                    length: *length,
                    eof: *eof,
                    digest: digest.clone(),
                },
            ),
        };
        let physical = normalize(Path::new(path));
        if physical.starts_with(&side.source_root) {
            let name = relative(&physical, &side.source_root);
            if inventory.inputs.contains_key(&name) {
                result.insert(format!("{SOURCE_INPUT_PREFIX}{name}"), baseline.clone());
            }
        }
        if let Some(name) = logical(path, side)
            && modules.contains(&name)
        {
            result.insert(name, baseline);
        }
    }
    result
}

fn logical(file: &str, side: &SideInputs) -> Option<String> {
    let path = normalize(Path::new(file));
    side.logical_dependency(&path).or_else(|| {
        path.starts_with(&side.source_root)
            .then(|| relative(&path, &side.source_root))
    })
}

#[cfg(test)]
#[path = "_tests_/postcss_read_inventory_tests.rs"]
mod postcss_read_inventory_tests;
