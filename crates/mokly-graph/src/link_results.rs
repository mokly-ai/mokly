//! Bounded generation facts keep anchor presence separate from caller diagnostics.

use std::mem;
use std::sync::Mutex;

/// A miss always leaves the caller responsible for its ordinary target check.
#[cfg_attr(test, unimock::unimock(api = LinkResultsMock))]
pub(crate) trait LinkResults: Send + Sync {
    /// Return anchor presence without a caller-specific diagnostic.
    fn get(&self, view: usize, fragment: &str) -> Option<bool>;
    /// Admit one fact only when its complete retained charge fits.
    fn record(&self, view: usize, fragment: &str, present: bool);
    /// Nonempty charge includes the owning allocation, record slice, and fragments.
    fn retained_bytes(&self) -> usize;
    /// Count admitted view and fragment pairs.
    fn len(&self) -> usize;
}

/// Each generation admits at most two MiB of compact pair facts.
pub(crate) const LIMIT: usize = 2 * 1024 * 1024;

/// Sorted boxed records retain exact capacity after each admitted fact.
pub(crate) struct MemoryLinkResults {
    bound: usize,
    state: Mutex<State>,
}

#[derive(Default)]
struct State {
    records: Box<[Record]>,
    fragments: usize,
}

struct Record {
    view: usize,
    fragment: Box<str>,
    present: bool,
}

impl State {
    fn position(&self, view: usize, fragment: &str) -> Result<usize, usize> {
        self.records.binary_search_by(|record| {
            record
                .view
                .cmp(&view)
                .then_with(|| record.fragment.as_ref().cmp(fragment))
        })
    }

    fn bytes(&self) -> usize {
        if self.records.is_empty() {
            return 0;
        }
        mem::size_of::<MemoryLinkResults>()
            + 2 * mem::size_of::<usize>()
            + mem::size_of_val(self.records.as_ref())
            + self.fragments
    }
}

impl MemoryLinkResults {
    /// Construct an empty store with a caller-selected retained ceiling.
    pub(crate) fn new(bound: usize) -> Self {
        Self {
            bound,
            state: Mutex::new(State::default()),
        }
    }
}

impl LinkResults for MemoryLinkResults {
    fn get(&self, view: usize, fragment: &str) -> Option<bool> {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state
            .position(view, fragment)
            .ok()
            .map(|index| state.records[index].present)
    }

    fn record(&self, view: usize, fragment: &str, present: bool) {
        {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            let index = match state.position(view, fragment) {
                Ok(index) => {
                    state.records[index].present = present;
                    return;
                }
                Err(index) => index,
            };
            let Some(fragments) = state.fragments.checked_add(fragment.len()) else {
                return;
            };
            let charge = (state.records.len() + 1)
                .checked_mul(mem::size_of::<Record>())
                .and_then(|bytes| bytes.checked_add(fragments))
                .and_then(|bytes| bytes.checked_add(mem::size_of::<Self>()))
                .and_then(|bytes| bytes.checked_add(2 * mem::size_of::<usize>()));
            if charge.is_none_or(|bytes| bytes > self.bound) {
                return;
            }
            let mut records = mem::take(&mut state.records).into_vec();
            records.reserve_exact(1);
            records.insert(
                index,
                Record {
                    view,
                    fragment: fragment.into(),
                    present,
                },
            );
            state.records = records.into_boxed_slice();
            state.fragments = fragments;
        }
        debug_assert!(self.retained_bytes() <= self.bound);
        debug_assert!(self.len() <= self.bound);
    }

    fn retained_bytes(&self) -> usize {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .bytes()
    }

    fn len(&self) -> usize {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .records
            .len()
    }
}

#[cfg(test)]
#[path = "_tests_/link_results_tests.rs"]
mod link_results_tests;
