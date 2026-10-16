//! One PostCSS context uses one slot until release or process recycling.

use crate::methods::Call;
use crate::pool_state::State;

pub(super) fn acquire(state: &mut State, call: &Call, limit: usize) -> Option<usize> {
    let context = match call {
        Call::ProcessCss(params) => Some(params.context.as_str()),
        _ => None,
    };
    if let Some(index) = context.and_then(|id| state.affinity.get(id)).copied() {
        let position = state
            .available
            .iter()
            .position(|candidate| *candidate == index)?;
        return state.available.remove(position);
    }
    let index = state.available.pop_front().or_else(|| {
        if state.slots.len() < limit {
            state.slots.push(None);
            Some(state.slots.len() - 1)
        } else {
            None
        }
    })?;
    if let Some(context) = context {
        state.affinity.insert(context.into(), index);
    }
    Some(index)
}

/// Select eligible work without reserving or changing a slot.
pub(super) fn runnable(state: &State, context: Option<&str>, limit: usize) -> bool {
    if let Some(index) = context.and_then(|id| state.affinity.get(id)) {
        state.available.contains(index)
    } else {
        !state.available.is_empty() || state.slots.len() < limit
    }
}
