//! Renderer-declared resource seeds and the stylesheet-owner warning.

use std::collections::BTreeSet;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_model::evidence::EvidenceOwner;
use serde_json::Value;

use crate::references::ResourceReference;
use crate::urls::local_target;

/// Seeds are repository-relative, so they resolve against the public root.
const SEED_SOURCE: &str = "static/index.html";

/// Queue every seed with the entry as owner, and warn once per stylesheet seed.
///
/// A seed grants no access and supplies no CSS evidence. A stylesheet that a
/// renderer names here still enters the closure as a file, but its rules are
/// never attributed, so the author is told to import the CSS or to declare it
/// in `stylesheets`. The closure drops the warning with the rest of its result
/// when a seed fails the public path checks.
pub(crate) fn queue(
    route: &str,
    seeds: &[String],
) -> (Vec<(String, ResourceReference)>, Vec<Warning>) {
    let stylesheets: BTreeSet<&String> = seeds.iter().filter(|seed| is_stylesheet(seed)).collect();
    let warnings = stylesheets
        .into_iter()
        .map(|seed| Warning {
            code: "stylesheet-owner",
            subject: WarningSubject::Route(route.into()),
            message: format!(
                "renderer resource {} is a stylesheet and supplies no CSS evidence. Import the CSS or declare it in stylesheets instead.",
                Value::String(seed.clone())
            ),
        })
        .collect();
    let queue = seeds
        .iter()
        .map(|seed| {
            (
                SEED_SOURCE.to_string(),
                ResourceReference {
                    url: seed.clone(),
                    owner: EvidenceOwner::Entry,
                    ignored: false,
                    instance_key: None,
                },
            )
        })
        .collect();
    (queue, warnings)
}

fn is_stylesheet(seed: &str) -> bool {
    matches!(local_target(SEED_SOURCE, seed), Ok(Some(target)) if target.ends_with(".css"))
}

#[cfg(test)]
#[path = "_tests_/closure_seeds_tests.rs"]
mod closure_seeds_tests;
