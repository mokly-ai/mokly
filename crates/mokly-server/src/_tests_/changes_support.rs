//! Empty valid classifications for scheduler, publication, and trace tests.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::axes::ColorScheme;
use unimock::{MockFn, Unimock, matching};

use crate::comparison_support::{accepted, historical_inputs, snapshot};
use crate::publication_support::empty_model;
use crate::snapshot::Snapshot;

/// Keep the returned mock owner on the test thread until its graphs are released.
pub(crate) fn fixture() -> (Arc<Snapshot>, ComparisonResult, Unimock) {
    let (mut catalogue, _) = historical_inputs();
    catalogue.model = empty_model();
    catalogue.model.color_schemes = vec![ColorScheme::Light];
    let model = Arc::new(catalogue.model.clone());
    let graph = Unimock::new((
        RenderGenerationMock::generation_key
            .each_call(matching!())
            .returns("after"),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(BTreeMap::new()),
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
    ));
    let mut input = accepted(Arc::new(graph.clone()), Arc::new(graph.clone()));
    let result = &mut Arc::get_mut(&mut input).unwrap().result;
    result.entries.clear();
    result.review.entries.clear();
    result.snapshot.changed_entries.clear();
    let result = Arc::try_unwrap(input).ok().unwrap().result;
    let mut origin = (*snapshot(None)).clone();
    Arc::make_mut(&mut origin.generation).model = model;
    (Arc::new(origin), result, graph)
}
