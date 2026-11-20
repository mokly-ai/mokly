//! Capture complete comparison records, public JSON, and exact document/resource bytes.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::{projection_detail, projection_index, projection_removed};
use mokly_model::projection;

#[derive(Debug, PartialEq)]
pub struct Outputs {
    records: String,
    public_json: Vec<u8>,
    payloads: BTreeMap<String, Vec<u8>>,
}

pub fn collect(result: &ComparisonResult) -> Outputs {
    let publication = projection_index::publication("mokly.config.json".into(), "fixture-base");
    let keys = projection_index::keys(result.after.as_ref());
    let mut index = projection::index(&result.after.catalogue().model, &keys, &publication);
    projection_index::apply(&mut index, result);
    let mut details = projection::pending_details(&result.after.catalogue().model, &index, &keys);
    for plan in result.after.plans().values() {
        let entry = &result.after.catalogue().model.entries[plan.entry];
        let artifact = result.after.comparison_document(&plan.route).unwrap();
        for view in &mut details.get_mut(&entry.metadata.path).unwrap().views {
            if Some(view.viewport) == plan.viewport && view.color_scheme == plan.color_scheme {
                view.usage = artifact.document.as_ref().unwrap().usage.clone();
            }
        }
    }
    projection_detail::apply_evidence(&mut details, result);
    let historical = projection_index::base_index(result, &publication);
    let removed_details = projection_removed::details(result, &historical).unwrap();
    let removed = projection_removed::records(result, historical);
    let mut payloads = BTreeMap::new();
    for (side, generation) in [("base", &result.before), ("head", &result.after)] {
        for route in generation.plans().keys() {
            payloads.insert(
                format!("{side}/document/{route}"),
                generation.render(route).unwrap().bytes.clone(),
            );
        }
        for route in generation.resource_routes() {
            if let Some(bytes) = generation.resource(&route).unwrap() {
                payloads.insert(format!("{side}/resource/{route}"), bytes);
            }
        }
        for path in generation.public_files() {
            let route = format!("static/{path}");
            payloads.insert(
                format!("{side}/public/{route}"),
                generation.resource_bytes(&route).unwrap().unwrap(),
            );
        }
    }
    Outputs {
        records: format!(
            "{:?}",
            (
                &result.entries,
                &result.pairing,
                result.counts,
                &result.warnings,
                result.resource_work,
                result.affected_lookups,
            )
        ),
        public_json: serde_json::to_vec(&(
            &result.review,
            &result.snapshot,
            index,
            details,
            removed,
            removed_details,
        ))
        .unwrap(),
        payloads,
    }
}
