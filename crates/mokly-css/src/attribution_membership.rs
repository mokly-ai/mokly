//! Shared own-page, nested-component, and exact-owner rule membership.

use std::collections::BTreeSet;

use crate::attribution::MatchProof;

pub(crate) fn own_root(matched: &MatchProof, component: &str) -> bool {
    matched
        .trusted_owner
        .as_deref()
        .is_none_or(|owner| owner == component)
        && matched
            .regions()
            .any(|region| region.root && region.path == component)
}

pub(crate) fn kept(
    matched: &MatchProof,
    component: &str,
    unfiltered: Option<&BTreeSet<String>>,
) -> bool {
    !matched.regions().any(|region| {
        !region.root
            && region.path != component
            && unfiltered.is_some_and(|paths| paths.contains(&region.path))
            && matched
                .inputs
                .as_ref()
                .is_none_or(|inputs| inputs.iter().any(|input| input == region))
    })
}

pub(crate) fn owner(
    matched: &MatchProof,
    changed: Option<&BTreeSet<String>>,
    unfiltered: Option<&BTreeSet<String>>,
) -> Option<String> {
    let declared = matched
        .trusted_owner
        .as_ref()
        .filter(|owner| {
            matched.regions().any(|region| &region.path == *owner)
                && kept(matched, owner, unfiltered)
        })
        .cloned();
    declared.or_else(|| {
        matched
            .regions()
            .find(|region| changed.is_some_and(|paths| paths.contains(&region.path)))
            .map(|region| region.path.clone())
    })
}
