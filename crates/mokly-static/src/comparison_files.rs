//! Capture each side's documents and closure at their unchanged relative addresses.

use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGeneration;
use mokly_model::review_affected::ReviewSide;
use mokly_model::routes;

use crate::error::{Error, InternalError, Result};
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
            routes::comparison_snapshot(side, &format!("mokly-generated/{}", plan.route)),
            artifact.bytes.clone().into(),
        )?;
    }
    for route in generation.resource_routes() {
        checkpoint(cancellation)?;
        let bytes = graph(generation.resource(&route))?.ok_or_else(|| Error::Invalid {
            path: route.clone(),
        })?;
        inventory.insert(
            routes::comparison_snapshot(side, &format!("mokly-generated/{route}")),
            bytes.into(),
        )?;
    }
    for path in generation.public_files() {
        checkpoint(cancellation)?;
        let route = format!("static/{path}");
        let bytes = graph(generation.resource_bytes(&route))?
            .ok_or_else(|| Error::Invalid { path: route })?;
        inventory.insert(routes::comparison_snapshot(side, &path), bytes.into())?;
    }
    Ok(())
}

pub(crate) fn compare<T>(result: mokly_compare::error::Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(mokly_compare::error::Error::Graph { source }) => graph(Err(source)),
        Err(source) => Err(InternalError::Comparison {
            source: Box::new(source),
        }
        .into()),
    }
}
