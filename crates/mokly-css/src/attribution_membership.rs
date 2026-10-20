//! Shared own-page, nested-component, and exact-owner rule membership.

use std::collections::BTreeSet;

use crate::attribution::MatchProof;

/// Own-page proof covers its whole root; declared claims stop at their instance.
#[derive(Clone, Copy, Eq, PartialEq)]
pub(crate) enum Boundary {
    /// Filter every nested region below the component's own root.
    OwnPage,
    /// Stop before examining the declared instance or any of its ancestors.
    DeclaredInstance,
}

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
    boundary: Boundary,
) -> bool {
    !matched
        .regions()
        .take_while(|region| boundary == Boundary::OwnPage || region.path != component)
        .any(|region| {
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
                && kept(matched, owner, unfiltered, Boundary::DeclaredInstance)
        })
        .cloned();
    declared.or_else(|| {
        matched
            .regions()
            .find(|region| changed.is_some_and(|paths| paths.contains(&region.path)))
            .map(|region| region.path.clone())
    })
}
