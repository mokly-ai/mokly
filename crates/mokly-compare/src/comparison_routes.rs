//! Lazy ordered routes retain entry identity across the rolling view window.

use std::collections::BTreeSet;

use crate::comparison_types::ViewKey;
use crate::move_inventory::PlanIndex;
use crate::move_types::EntryPair;

pub(crate) struct ViewRoutes {
    pub(crate) pair: usize,
    pub(crate) moved: bool,
    pub(crate) key: ViewKey,
    pub(crate) before: Option<String>,
    pub(crate) after: Option<String>,
}

pub(crate) fn stream<'a>(
    pairs: &'a [EntryPair],
    before: &'a PlanIndex<'_>,
    after: &'a PlanIndex<'_>,
) -> impl Iterator<Item = ViewRoutes> + 'a {
    pairs.iter().enumerate().flat_map(move |(index, pair)| {
        let left = pair.before.and_then(|entry| before.get(&entry));
        let right = pair.after.and_then(|entry| after.get(&entry));
        let keys: BTreeSet<_> = left
            .into_iter()
            .chain(right)
            .flat_map(|plans| plans.keys().copied())
            .collect();
        keys.into_iter().map(move |key| ViewRoutes {
            pair: index,
            moved: pair.moved,
            key,
            before: left
                .and_then(|plans| plans.get(&key))
                .map(|plan| plan.route.clone()),
            after: right
                .and_then(|plans| plans.get(&key))
                .map(|plan| plan.route.clone()),
        })
    })
}
