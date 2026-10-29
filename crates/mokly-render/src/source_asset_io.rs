//! Preserve source-side selection while forwarding opaque digest batches.

use std::io;
use std::path::PathBuf;

use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::tree::SourceTree;

use crate::sources::{SideTree, SourceOrigin};

impl SideTree {
    pub(crate) fn digest_assets(&self, paths: &[PathBuf]) -> Vec<Result<String>> {
        let mut results: Vec<Option<Result<String>>> = (0..paths.len()).map(|_| None).collect();
        let mut sources = Vec::new();
        let mut dependencies = Vec::new();
        for (index, path) in paths.iter().enumerate() {
            match self.selected(path) {
                Ok((_, physical, SourceOrigin::Repository)) => sources.push((index, physical)),
                Ok((_, physical, SourceOrigin::Dependency)) => dependencies.push((index, physical)),
                Err(error) => results[index] = Some(Err(error)),
            }
        }
        forward(self.sources.as_ref(), &sources, &mut results);
        forward(self.dependencies.as_ref(), &dependencies, &mut results);
        paths
            .iter()
            .zip(results)
            .map(|(path, result)| {
                result.unwrap_or_else(|| {
                    Err(SourceError::Io {
                        operation: "digest opaque batch",
                        path: path.clone(),
                        source: io::ErrorKind::UnexpectedEof.into(),
                    })
                })
            })
            .collect()
    }
}

fn forward(
    tree: &dyn SourceTree,
    selected: &[(usize, PathBuf)],
    results: &mut [Option<Result<String>>],
) {
    if selected.is_empty() {
        return;
    }
    let paths: Vec<_> = selected.iter().map(|(_, path)| path.clone()).collect();
    for ((index, path), result) in selected.iter().zip(tree.digest_unretained_batch(&paths)) {
        results[*index] = Some(match tree.project(path) {
            Ok(Some(node)) if node.identity != *path => tree.digest_unretained(&node.identity),
            Ok(_) => result,
            Err(error) => Err(error),
        });
    }
}
