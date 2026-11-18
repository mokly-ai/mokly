//! One PostCSS context uses one slot until release or process recycling.

use std::path::Path;

use crate::methods::Call;
use crate::pool_state::{Affinity, State};

pub(super) fn acquire(
    state: &mut State,
    call: &Call,
    root: &Path,
    limit: usize,
    protected: Option<usize>,
) -> Option<usize> {
    let context = match call {
        Call::ProcessCss(params) => Some(params.context.as_str()),
        _ => None,
    };
    let index = if let Some(index) = context
        .and_then(|id| state.affinity.get(id))
        .map(|affinity| affinity.index)
    {
        let position = state
            .available
            .iter()
            .position(|candidate| *candidate == index)?;
        state.available.remove(position)?
    } else {
        let reused = (!state.head.candidates.is_empty())
            .then(|| {
                state.available.iter().position(|index| {
                    !state.head.candidates.contains_key(index)
                        && state.slots[*index]
                            .as_ref()
                            .is_some_and(|slot| slot.source_root == root)
                })
            })
            .flatten();
        let matching = state.available.iter().position(|index| {
            state.slots[*index]
                .as_ref()
                .is_some_and(|slot| slot.source_root == root)
        });
        let unspawned = state
            .available
            .iter()
            .position(|index| state.slots[*index].is_none());
        if let Some(position) = reused.or(matching).or(unspawned) {
            state.available.remove(position)?
        } else if state.slots.len() < limit {
            state.slots.push(None);
            state.slots.len() - 1
        } else {
            let position = state
                .available
                .iter()
                .position(|index| Some(*index) != protected)
                .unwrap_or(0);
            state.available.remove(position)?
        }
    };
    if let Some(context) = context {
        state.affinity.insert(
            context.into(),
            Affinity {
                index,
                source_root: root.into(),
            },
        );
    }
    Some(index)
}

/// Select eligible work without reserving or changing a slot.
pub(super) fn runnable(state: &State, context: Option<&str>, limit: usize) -> bool {
    if let Some(affinity) = context.and_then(|id| state.affinity.get(id)) {
        state.available.contains(&affinity.index)
    } else {
        !state.available.is_empty() || state.slots.len() < limit
    }
}

#[cfg(test)]
#[path = "_tests_/pool_root_selection_tests.rs"]
mod pool_root_selection_tests;
