//! Cross-view logical anchors are checked against composed destination documents.

use std::collections::BTreeMap;

use mokly_html::links::Reference;
use mokly_model::catalogue::EntryContent;

use crate::error::{Result, invalid};
use crate::session::Session;
use crate::{references, workers};

pub(crate) fn links(session: &Session, links: &[Reference]) -> Result<()> {
    for reference in links {
        let Some(fragment) = &reference.fragment else {
            continue;
        };
        let target = session
            .state
            .catalogue
            .model
            .entries
            .iter()
            .find(|entry| entry.metadata.path == reference.target)
            .ok_or_else(|| invalid(&reference.target, "unknown logical destination"))?;
        let path = if let EntryContent::UseCase { steps } = &target.content {
            steps
                .first()
                .map_or(reference.target.as_str(), |step| step.screen_path.as_str())
        } else {
            &reference.target
        };
        for plan in session.state.plans.values().filter(|plan| {
            session.state.catalogue.model.entries[plan.entry]
                .metadata
                .path
                == path
        }) {
            let artifact = session.raw(&plan.route)?;
            if !artifact
                .document
                .as_ref()
                .is_some_and(|document| references::anchors(&document.tree).contains(fragment))
            {
                return Err(invalid(
                    &reference.source_route,
                    format!(
                        "{}: logical fragment {fragment:?} is missing from {}",
                        reference.source_route, plan.route
                    ),
                ));
            }
            session.state.cache.insert(plan.key.clone(), artifact);
        }
    }
    Ok(())
}

pub(crate) fn completed(
    session: &Session,
    views: &BTreeMap<String, workers::ValidatedView>,
) -> Result<()> {
    let mut by_entry: BTreeMap<&str, Vec<&workers::ValidatedView>> = BTreeMap::new();
    for (route, view) in views {
        let path = &session.state.catalogue.model.entries[session.state.plans[route].entry]
            .metadata
            .path;
        by_entry.entry(path).or_default().push(view);
    }
    let entries: BTreeMap<_, _> = session
        .state
        .catalogue
        .model
        .entries
        .iter()
        .map(|entry| (entry.metadata.path.as_str(), entry))
        .collect();
    for view in views.values() {
        for reference in &view.links {
            let Some(fragment) = &reference.fragment else {
                continue;
            };
            let target = entries
                .get(reference.target.as_str())
                .ok_or_else(|| invalid(&view.route, "unknown logical destination"))?;
            let path = if let EntryContent::UseCase { steps } = &target.content {
                steps
                    .first()
                    .map_or(reference.target.as_str(), |step| step.screen_path.as_str())
            } else {
                &reference.target
            };
            for destination in by_entry.get(path).into_iter().flatten() {
                if !destination.anchors.contains(fragment) {
                    return Err(invalid(
                        &view.route,
                        format!(
                            "{}: logical fragment {fragment:?} is missing from {}",
                            view.route, destination.route
                        ),
                    ));
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "_tests_/validation_cache_tests.rs"]
mod validation_cache_tests;
