//! Candidate resource digests are prefilters; paired reads still prove relocation equality.

use std::collections::BTreeMap;

use mokly_graph::types::RenderGeneration;
use mokly_model::review_affected::ReviewSide;

use crate::comparison_error::CompareResult;
use crate::error::Result;
use crate::resource_memo::ResourceMemo;

pub(crate) fn resources(
    generation: &dyn RenderGeneration,
    memo: &dyn ResourceMemo,
    side: ReviewSide,
    route: &str,
) -> Result<BTreeMap<String, String>> {
    let closure = generation.closure(route).compare()?;
    let mut hashes = BTreeMap::new();
    let mut stylesheets = Vec::new();
    for resource in &closure.evidence {
        if let Some(hash) = memo.fact(side, &resource.path)?.digest {
            hashes.insert(resource.path.clone(), format!("resource:{hash}"));
            if resource.path.ends_with(".css") {
                stylesheets.push(resource.path.clone());
            }
        }
    }
    for path in stylesheets {
        if let Some(hash) = memo.fingerprint(side, &path, &hashes)? {
            hashes.insert(path, format!("resource:{hash}"));
        }
    }
    Ok(hashes)
}
