//! Final immutable asset capture verifies the selected generation before inventory admission.

use mokly_graph::types::RenderGeneration;
use mokly_model::output::validation::FILE_LIMIT;

use crate::comparison_files::graph;
use crate::error::{Error, Result};

pub(crate) fn generated(
    generation: &dyn RenderGeneration,
    route: &str,
    output_path: &str,
) -> Result<Option<Vec<u8>>> {
    if route.starts_with("assets/")
        && let Some(mut asset) = graph(generation.open_asset(route))?
    {
        if asset.length() > FILE_LIMIT as u64 {
            return Err(Error::TooLarge {
                path: output_path.into(),
            });
        }
        return graph(asset.read_bytes()).map(Some);
    }
    graph(generation.resource(route))
}

#[cfg(test)]
#[path = "_tests_/resource_bytes_tests.rs"]
mod resource_bytes_tests;
