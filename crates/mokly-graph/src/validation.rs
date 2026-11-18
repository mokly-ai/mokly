//! Cross-view logical anchors are checked against composed destination documents.

use std::collections::BTreeMap;

use mokly_html::links::Reference;
use mokly_model::catalogue::EntryContent;

use crate::error::{GraphError, Result, invalid};
use crate::session::Session;
use crate::types::DocumentPlan;
use crate::{references, workers};

fn validate_target(
    session: &Session,
    view: usize,
    plan: &DocumentPlan,
    fragment: &str,
) -> Result<bool> {
    if let Some(present) = session.state.link_results.get(view, fragment) {
        workers::check_cancelled(session.state.workers.as_ref())?;
        return Ok(present);
    }
    let shared = session.state.anchor_flights.acquire(&plan.key);
    let _guard = shared.lock().unwrap_or_else(|error| error.into_inner());
    if let Some(present) = session.state.link_results.get(view, fragment) {
        workers::check_cancelled(session.state.workers.as_ref())?;
        return Ok(present);
    }
    let artifact = session.raw(&plan.route)?;
    let document = artifact
        .document
        .as_ref()
        .expect("rendered destination artifacts carry their composed tree");
    let present = references::anchors(&document.tree).contains(fragment);
    session.state.link_results.record(view, fragment, present);
    if present {
        session.state.cache.insert(plan.key.clone(), artifact);
    }
    Ok(present)
}

fn destination(
    session: &Session,
    reference: &Reference,
    error_route: &str,
) -> Result<Option<usize>> {
    let entries = &session.state.catalogue.model.entries;
    let index = &session.state.link_index;
    let target = index
        .entry(entries, &reference.target)
        .ok_or_else(|| invalid(error_route, "unknown logical destination"))?;
    if let EntryContent::UseCase { steps } = &entries[target].content {
        let path = steps
            .first()
            .map_or(reference.target.as_str(), |step| step.screen_path.as_str());
        Ok(index.entry(entries, path))
    } else {
        Ok(Some(target))
    }
}

fn missing(source: &str, target: &str, fragment: &str) -> GraphError {
    invalid(
        source,
        format!("{source}: logical fragment {fragment:?} is missing from {target}"),
    )
}

pub(crate) fn links(session: &Session, links: &[Reference]) -> Result<()> {
    for reference in links {
        let Some(fragment) = &reference.fragment else {
            continue;
        };
        let Some(entry) = destination(session, reference, &reference.target)? else {
            continue;
        };
        for (view, plan) in session.state.link_index.views(
            &session.state.plans,
            &session.state.catalogue.model.entries,
            entry,
        ) {
            if !validate_target(session, view, plan, fragment)? {
                return Err(missing(&reference.source_route, &plan.route, fragment));
            }
        }
    }
    Ok(())
}

pub(crate) fn completed(
    session: &Session,
    views: &BTreeMap<String, workers::ValidatedView>,
) -> Result<()> {
    for view in views.values() {
        for reference in &view.links {
            let Some(fragment) = &reference.fragment else {
                continue;
            };
            let Some(entry) = destination(session, reference, &view.route)? else {
                continue;
            };
            for (target, plan) in session.state.link_index.views(
                &session.state.plans,
                &session.state.catalogue.model.entries,
                entry,
            ) {
                let Some(destination) = views.get(&plan.route) else {
                    continue;
                };
                let present = destination.anchors.contains(fragment);
                session.state.link_results.record(target, fragment, present);
                if !present {
                    return Err(missing(&view.route, &destination.route, fragment));
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "_tests_/validation_cache_tests.rs"]
mod validation_cache_tests;

#[cfg(test)]
#[path = "_tests_/validation_flight_tests.rs"]
mod validation_flight_tests;

#[cfg(test)]
#[path = "_tests_/validation_sharing_tests.rs"]
mod validation_sharing_tests;

#[cfg(test)]
#[path = "_tests_/validation_completed_tests.rs"]
mod validation_completed_tests;

#[cfg(test)]
#[path = "_tests_/validation_concurrent_tests.rs"]
mod validation_concurrent_tests;

#[cfg(test)]
#[path = "_tests_/validation_retry_tests.rs"]
mod validation_retry_tests;

#[cfg(test)]
#[path = "_tests_/validation_edge_tests.rs"]
mod validation_edge_tests;

#[cfg(test)]
#[path = "_tests_/validation_planning_tests.rs"]
mod validation_planning_tests;
