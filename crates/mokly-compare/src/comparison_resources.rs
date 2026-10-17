//! Validate both resource closures, prove relocation aliases, and collect rule evidence.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_css::attribution::{PageObservation, observe};
use mokly_css::match_tree::MatchTree;
use mokly_css::rule_matching::match_document;
use mokly_css::{observation, rules};
use mokly_graph::closure::Closure;
use mokly_graph::types::RenderGeneration;
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_model::review_affected::ReviewSide;

use crate::comparison_error::CompareResult;
use crate::css_documents;
use crate::error::Result;
use crate::material::mapped;
use crate::material_urls;
use crate::resource_memo::ResourceMemo;

/// Per-pair closure evidence. No resource byte set remains after this call.
pub(crate) struct Resources {
    pub(crate) before: Closure,
    pub(crate) after: Closure,
    pub(crate) aliases: BTreeMap<String, String>,
}

pub(crate) fn closures(
    before: Arc<dyn RenderGeneration>,
    after: Arc<dyn RenderGeneration>,
    before_route: Option<&str>,
    after_route: Option<&str>,
    relocate: bool,
    memo: &dyn ResourceMemo,
) -> Result<Resources> {
    let left = before_route.map_or_else(
        || Ok(Closure::default()),
        |route| before.closure(route).compare(),
    )?;
    let right = after_route.map_or_else(
        || Ok(Closure::default()),
        |route| after.closure(route).compare(),
    )?;
    let aliases = if relocate {
        aliases(&left, &right, memo)?
    } else {
        BTreeMap::new()
    };
    Ok(Resources {
        before: left,
        after: right,
        aliases,
    })
}

fn aliases(
    before: &Closure,
    after: &Closure,
    memo: &dyn ResourceMemo,
) -> Result<BTreeMap<String, String>> {
    let before: BTreeSet<_> = before
        .evidence
        .iter()
        .map(|resource| resource.path.as_str())
        .collect();
    let after: BTreeSet<_> = after
        .evidence
        .iter()
        .map(|resource| resource.path.as_str())
        .collect();
    let mut left_hashes: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut right_hashes: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut result = BTreeMap::new();
    for path in before.difference(&after) {
        if let Some(hash) = memo.fact(ReviewSide::Before, path)?.digest {
            left_hashes.entry(hash).or_default().push((*path).into());
        }
    }
    for path in after.difference(&before) {
        if let Some(hash) = memo.fact(ReviewSide::After, path)?.digest {
            right_hashes.entry(hash).or_default().push((*path).into());
        }
    }
    for (hash, left) in &left_hashes {
        if left.len() == 1
            && let Some(right) = right_hashes.get(hash).filter(|paths| paths.len() == 1)
        {
            result.insert(left[0].clone(), right[0].clone());
        }
    }
    for extension in [
        "css", "png", "svg", "jpg", "jpeg", "webp", "avif", "gif", "woff", "woff2", "ttf", "otf",
        "html", "pdf",
    ] {
        let left: Vec<_> = before
            .difference(&after)
            .filter(|path| path.ends_with(&format!(".{extension}")) && !result.contains_key(**path))
            .collect();
        let right: Vec<_> = after
            .difference(&before)
            .filter(|path| {
                path.ends_with(&format!(".{extension}"))
                    && !result.values().any(|value| value == **path)
            })
            .collect();
        if left.len() == 1 && right.len() == 1 {
            result.insert((**left[0]).into(), (**right[0]).into());
        }
    }
    Ok(result)
}

pub(crate) struct ResourceInput<'a> {
    pub(crate) resources: &'a Resources,
    pub(crate) memo: &'a dyn ResourceMemo,
    pub(crate) before_tree: Option<&'a MatchTree>,
    pub(crate) after_tree: Option<&'a MatchTree>,
    pub(crate) paths: &'a BTreeMap<String, String>,
    pub(crate) before_route: &'a str,
    pub(crate) after_route: &'a str,
}

pub(crate) fn evidence(
    input: ResourceInput<'_>,
    observation: &mut PageObservation,
) -> Result<Vec<ResourceEvidence>> {
    let resources = input.resources;
    let before_documents = css_documents::collect(
        input.memo,
        ReviewSide::Before,
        input.before_route,
        input.before_tree,
        &resources.aliases,
    )?;
    let after_documents = css_documents::collect(
        input.memo,
        ReviewSide::After,
        input.after_route,
        input.after_tree,
        &BTreeMap::new(),
    )?;
    let mut candidates: BTreeSet<_> = resources
        .before
        .evidence
        .iter()
        .map(|resource| {
            resources
                .aliases
                .get(&resource.path)
                .unwrap_or(&resource.path)
                .clone()
        })
        .collect();
    candidates.extend(
        resources
            .after
            .evidence
            .iter()
            .map(|resource| resource.path.clone()),
    );
    let inverse: BTreeMap<_, _> = resources
        .aliases
        .iter()
        .map(|(before, after)| (after, before))
        .collect();
    let mut output = Vec::new();
    for path in candidates {
        let before_path = inverse.get(&path).copied().unwrap_or(&path);
        if input.memo.equal(before_path, &path, &resources.aliases)? {
            continue;
        }
        if path.ends_with(".css") {
            let diff = input.memo.diff(before_path, &path, &resources.aliases)?;
            if matches!(diff.as_ref(), rules::RuleDiff::Resolved { added, removed, changed } if added.is_empty() && removed.is_empty() && changed.is_empty())
            {
                continue;
            }
            let contexts: BTreeSet<_> = before_documents
                .iter()
                .chain(&after_documents)
                .filter(|document| document.stylesheets.contains(&path))
                .map(|document| document.id.as_str())
                .collect();
            for context in contexts {
                let left = before_documents
                    .iter()
                    .find(|document| document.id == context)
                    .map(|document| &document.tree);
                let right = after_documents
                    .iter()
                    .find(|document| document.id == context)
                    .map(|document| &document.tree);
                let matches = match_document(&diff, left, right);
                observation
                    .rules
                    .extend(observe(&path, &matches, left, right));
            }
        } else {
            for (side, paths) in [
                (&resources.before.evidence, input.paths),
                (&resources.after.evidence, &BTreeMap::new()),
            ] {
                for reference in side.iter().filter(|reference| {
                    resources
                        .aliases
                        .get(&reference.path)
                        .unwrap_or(&reference.path)
                        == &path
                }) {
                    let owner = match &reference.owner {
                        EvidenceOwner::Entry => EvidenceOwner::Entry,
                        EvidenceOwner::Component { path } => EvidenceOwner::Component {
                            path: mapped(path, paths),
                        },
                    };
                    output.push(ResourceEvidence {
                        path: path.clone(),
                        owner,
                    });
                }
            }
        }
    }
    output.sort_by(|left, right| {
        mokly_model::review_order::resource_key(left)
            .cmp(&mokly_model::review_order::resource_key(right))
    });
    output.dedup();
    observation.rules = observation::merge(std::mem::take(&mut observation.rules));
    Ok(output)
}

pub(crate) fn css_urls(bytes: &[u8], source: &str, aliases: &BTreeMap<String, String>) -> Vec<u8> {
    let Ok(text) = str::from_utf8(bytes) else {
        return bytes.to_vec();
    };
    material_urls::css(text, source, aliases).into_bytes()
}
