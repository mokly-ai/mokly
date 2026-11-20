//! Context, generation, and head compilation affinity rank same-root slots.

use std::cmp::Reverse;
use std::path::Path;

use crate::methods::Call;
use crate::pool_cleanup::stale_generation;
use crate::pool_preparation::Prerequisites;
use crate::pool_requests::generation;
use crate::pool_state::{Affinity, Slot, State};

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Loaded {
    Ready,
    Generation,
    Missing,
}

fn loaded(state: &State, slot: &Slot, call: &Call) -> Loaded {
    let Some(generation) = generation(call) else {
        return Loaded::Missing;
    };
    if slot
        .generations
        .get(generation)
        .is_none_or(|epoch| stale_generation(state, generation, *epoch))
    {
        Loaded::Missing
    } else if Prerequisites::for_call(call).loaded(state, slot, generation) {
        Loaded::Ready
    } else {
        Loaded::Generation
    }
}

fn matching(state: &State, call: &Call, root: &Path, outside_pass: bool) -> Option<usize> {
    state
        .available
        .iter()
        .enumerate()
        .filter(|(_, index)| !outside_pass || !state.head.candidates.contains_key(*index))
        .filter_map(|(position, index)| {
            state.slots[*index]
                .as_ref()
                .filter(|slot| slot.source_root == root)
                .map(|slot| {
                    let compilation = match call {
                        Call::Bundle(_) => slot.last_compilation,
                        _ => None,
                    };
                    (position, loaded(state, slot, call), compilation)
                })
        })
        .min_by_key(|(position, rank, compilation)| (*rank, Reverse(*compilation), *position))
        .map(|(position, _, _)| position)
}

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
            .then(|| matching(state, call, root, true))
            .flatten();
        let matching = matching(state, call, root, false);
        let unspawned = state
            .available
            .iter()
            .position(|index| state.slots[*index].is_none());
        if let Some(position) = reused.or(matching).or(unspawned) {
            state.available.remove(position)?
        } else if state.allocated() < limit {
            state.free.pop_first().unwrap_or_else(|| {
                state.slots.push(None);
                state.slots.len() - 1
            })
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
        !state.available.is_empty() || state.allocated() < limit
    }
}

#[cfg(test)]
#[path = "_tests_/pool_root_selection_tests.rs"]
mod pool_root_selection_tests;

#[cfg(test)]
#[path = "_tests_/generation_affinity/mod.rs"]
mod generation_affinity_tests;
