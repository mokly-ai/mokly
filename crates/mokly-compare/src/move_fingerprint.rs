//! Candidate resource digests are prefilters; paired reads still prove relocation equality.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_graph::types::RenderGeneration;
use mokly_model::material::digest;
use mokly_model::review_affected::ReviewSide;

use crate::comparison_error::CompareResult;
use crate::comparison_resources::{HistoricalResources, css_urls};
use crate::error::Result;

pub(crate) fn resources(
    generation: &dyn RenderGeneration,
    base: Arc<dyn RenderGeneration>,
    side: ReviewSide,
    route: &str,
) -> Result<BTreeMap<String, String>> {
    let closure = match side {
        ReviewSide::Before => generation.closure(route).compare()?,
        ReviewSide::After => generation
            .comparison_closure(
                route,
                Arc::new(HistoricalResources {
                    before: base.clone(),
                }),
            )
            .compare()?,
    };
    let mut hashes = BTreeMap::new();
    let mut stylesheets = BTreeMap::new();
    for resource in &closure.evidence {
        let bytes = match generation.resource_bytes(&resource.path).compare()? {
            Some(bytes) => bytes,
            None if side == ReviewSide::After => base
                .resource_bytes(&resource.path)
                .compare()?
                .unwrap_or_default(),
            None => Vec::new(),
        };
        hashes.insert(
            resource.path.clone(),
            format!("resource:{}", digest(&bytes)),
        );
        if resource.path.ends_with(".css") {
            stylesheets.insert(resource.path.clone(), bytes);
        }
    }
    for (path, bytes) in stylesheets {
        let normalized = css_urls(&bytes, &path, &hashes);
        hashes.insert(path, format!("resource:{}", digest(&normalized)));
    }
    Ok(hashes)
}
