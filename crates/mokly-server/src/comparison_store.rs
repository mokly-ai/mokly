//! Bounded immutable generations and serialized coalesced capture admission.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex, Weak};

use async_trait::async_trait;
use tokio::sync::{Semaphore, watch};
use tokio::task::JoinHandle;

use crate::assets::File;
use crate::changes::{Accepted, ChangeCancellation};
use crate::clock::Clock;
use crate::comparison_capture::{Capturer, MAX_BYTES};
use crate::diagnostics::Diagnostics;
use crate::entropy::Entropy;
use crate::error::{Result, ServerError};
use crate::publication::Publications;

/// Idle milliseconds before `collect` releases a generation or trims its snapshots.
pub(crate) const RETENTION: u64 = 60_000;
const MAX_TOTAL: usize = 128 * 1024 * 1024;
const MAX_GENERATIONS: usize = 64;
pub(crate) type Outcome = std::result::Result<String, Arc<ServerError>>;
pub(crate) type Pending = watch::Receiver<Option<Outcome>>;

/// HTTP and classification share this single generation owner.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ComparisonsMock))]
#[async_trait]
pub trait Comparisons: Send + Sync {
    /// Check installation capacity before projecting ready state, without reserving it.
    fn check_capacity(&self, accepted: &Accepted, files: &BTreeMap<String, File>) -> Result<()>;
    /// Install classification JSON and removed details without snapshot bytes.
    fn install(&self, accepted: Arc<Accepted>, files: BTreeMap<String, File>) -> Result<()>;
    /// Obtain a selected capture, coalescing identical pending requests.
    async fn selected(&self, accepted: Arc<Accepted>, path: String, refresh: bool) -> Outcome;
    /// Read an immutable generation, capturing a removed document only on demand.
    async fn file(&self, generation: &str, path: &str) -> Result<Option<File>>;
    /// Renew a retained generation's idle window; false when it is gone.
    fn renew(&self, generation: &str) -> bool;
    /// Collect idle generations and cancel captures from replaced classifications.
    fn collect(&self);
    /// Stop admission, cancel captures, and wait for every worker before releasing bytes.
    async fn stop(&self);
}

/// One immutable generation's files. `accepted` is weak, so cached files never keep an
/// old classification or its base capture alive. A missing snapshot is restored only
/// while another owner still holds the classification.
pub(crate) struct Bundle {
    pub(crate) files: BTreeMap<String, File>,
    pub(crate) accepted: Option<Weak<Accepted>>,
    pub(crate) touched: u64,
}
/// One selected generation of a classification. `owner` is weak for the same reason.
pub(crate) struct Selection {
    pub(crate) owner: Weak<Accepted>,
    pub(crate) generation: String,
}
pub(crate) struct PendingCapture {
    pub(crate) receiver: Pending,
    pub(crate) cancel: Arc<dyn ChangeCancellation>,
    pub(crate) source: Arc<dyn ChangeCancellation>,
}
#[derive(Default)]
pub(crate) struct State {
    pub(crate) closed: bool,
    pub(crate) bundles: BTreeMap<String, Bundle>,
    pub(crate) selections: BTreeMap<(usize, String), Selection>,
    pub(crate) pending: BTreeMap<(usize, String, bool), PendingCapture>,
    pub(crate) tasks: Vec<JoinHandle<()>>,
}

/// One store per Serve process; all clocks, entropy, and render work are injected.
#[derive(Clone)]
pub struct MemoryComparisons {
    pub(crate) state: Arc<Mutex<State>>,
    pub(crate) serial: Arc<Semaphore>,
    pub(crate) clock: Arc<dyn Clock>,
    pub(crate) entropy: Arc<dyn Entropy>,
    pub(crate) capture: Arc<dyn Capturer>,
    pub(crate) publications: Arc<dyn Publications>,
    pub(crate) diagnostics: Arc<dyn Diagnostics>,
}

impl MemoryComparisons {
    /// Construct without starting work or retaining a generation.
    pub fn new(
        clock: Arc<dyn Clock>,
        entropy: Arc<dyn Entropy>,
        capture: Arc<dyn Capturer>,
        publications: Arc<dyn Publications>,
        diagnostics: Arc<dyn Diagnostics>,
    ) -> Self {
        Self {
            state: Arc::new(Mutex::new(State::default())),
            serial: Arc::new(Semaphore::new(1)),
            clock,
            entropy,
            capture,
            publications,
            diagnostics,
        }
    }
}

/// Release generations idle for `RETENTION` and stale selections, and cancel captures of
/// replaced classifications. The current classification keeps its JSON and drops only
/// its snapshot files, because they duplicate the base capture, which can restore a
/// document without another base render.
pub(crate) fn collect(state: &mut State, now: u64, current: Option<&Arc<Accepted>>) {
    state.bundles.retain(|id, bundle| {
        if now.saturating_sub(bundle.touched) < RETENTION {
            return true;
        }
        if current.is_some_and(|accepted| accepted.id == *id) {
            bundle
                .files
                .retain(|path, _| !path.starts_with("snapshots/"));
            return true;
        }
        false
    });
    let epoch = current.map(|accepted| Arc::as_ptr(accepted) as usize);
    state.selections.retain(|(owner, _), selection| {
        Some(*owner) == epoch
            && selection.owner.upgrade().is_some()
            && state.bundles.contains_key(&selection.generation)
    });
    state.tasks.retain(|task| !task.is_finished());
    for ((id, _, historical), pending) in &state.pending {
        if !historical && Some(*id) != epoch {
            pending.cancel.cancel();
        }
    }
}

pub(crate) fn admit(state: &State, id: &str, files: &BTreeMap<String, File>) -> Result<()> {
    let existing = state.bundles.get(id);
    let extra: usize = files
        .iter()
        .filter(|(path, _)| !existing.is_some_and(|bundle| bundle.files.contains_key(*path)))
        .map(|(_, file)| file.bytes.len())
        .sum();
    let own: usize = existing.map_or(0, |bundle| {
        bundle.files.values().map(|file| file.bytes.len()).sum()
    });
    let total: usize = state
        .bundles
        .values()
        .flat_map(|bundle| bundle.files.values())
        .map(|file| file.bytes.len())
        .sum();
    if own + extra > MAX_BYTES
        || total + extra > MAX_TOTAL
        || existing.is_none() && state.bundles.len() >= MAX_GENERATIONS
    {
        return Err(ServerError::ComparisonCapacity);
    }
    Ok(())
}

#[cfg(test)]
#[path = "_tests_/comparison_store_tests.rs"]
mod comparison_store_tests;

#[cfg(test)]
#[path = "_tests_/comparison_capacity_tests.rs"]
mod comparison_capacity_tests;

#[cfg(test)]
#[path = "_tests_/comparison_owner_tests.rs"]
mod comparison_owner_tests;

#[cfg(test)]
#[path = "_tests_/comparison_historical_tests.rs"]
mod comparison_historical_tests;

#[cfg(test)]
#[path = "_tests_/comparison_idle_tests.rs"]
mod comparison_idle_tests;

#[cfg(test)]
#[path = "_tests_/comparison_release_tests.rs"]
mod comparison_release_tests;
