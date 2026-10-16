//! Capture each side's documents and closure at their unchanged relative addresses.

use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGeneration;
use mokly_model::namespace;
use mokly_model::review_affected::ReviewSide;

use crate::error::{Error, Result};
use crate::inventory::Inventory;
use crate::transaction::Cancellation;

pub(crate) fn checkpoint(cancellation: &dyn Cancellation) -> Result<()> {
    if cancellation.requested() {
        Err(Error::Cancelled)
    } else {
        Ok(())
    }
}

pub(crate) fn graph<T>(result: std::result::Result<T, GraphError>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(Error::Render {
            source: Box::new(source),
        }),
    }
}

pub(crate) fn side(
    generation: &dyn RenderGeneration,
    side: ReviewSide,
    inventory: &mut Inventory,
    cancellation: &dyn Cancellation,
) -> Result<()> {
    for plan in generation.plans().values() {
        checkpoint(cancellation)?;
        let artifact = graph(generation.render(&plan.route))?;
        inventory.insert(
            snapshot_path(side, &format!("mokly-generated/{}", plan.route)),
            artifact.bytes.clone().into(),
        )?;
    }
    for route in generation.resource_routes() {
        checkpoint(cancellation)?;
        let bytes = graph(generation.resource(&route))?.ok_or_else(|| Error::Invalid {
            path: route.clone(),
        })?;
        inventory.insert(
            snapshot_path(side, &format!("mokly-generated/{route}")),
            bytes.into(),
        )?;
    }
    for path in generation.public_files() {
        checkpoint(cancellation)?;
        let route = format!("static/{path}");
        let bytes = graph(generation.resource_bytes(&route))?
            .ok_or_else(|| Error::Invalid { path: route })?;
        inventory.insert(snapshot_path(side, &path), bytes.into())?;
    }
    Ok(())
}

pub(crate) fn snapshot_path(side: ReviewSide, route: &str) -> String {
    let side = match side {
        ReviewSide::Before => "before",
        ReviewSide::After => "after",
    };
    format!("snapshots/{side}/{route}")
}

pub(crate) fn review_path(generation: &str) -> String {
    namespace::viewer(&format!("diffs/generations/{generation}/review.json"))
}
