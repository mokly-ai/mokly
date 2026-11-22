//! Background walks of one generation keep their read sets for its own classification.

use std::collections::BTreeMap;
use std::mem;
use std::sync::Mutex;

use crate::comparison_proof::ContentIdentity;
use crate::head_validation::{ClosureFacts, ValidationRead, ValidationRecorder};
use crate::session::Session;

/// Each generation keeps at most two MiB of background walk records.
pub(crate) const LIMIT: usize = 2 * 1024 * 1024;

/// One read or lexical observer call of a background walk, in walk order.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WalkStep {
    /// A walk read and the identity that the walk saw.
    Read(ValidationRead, String, ContentIdentity),
    /// A lexical observer call.
    Observe(String),
}

/// The complete read set and closure facts of one background walk of a generation.
#[derive(Clone, Debug, Default)]
pub struct WalkRecord {
    /// Reads, without repeats of one input, and observer calls in walk order.
    pub steps: Vec<WalkStep>,
    /// Authored files and closure warnings of the walk. The replay list stays empty.
    pub closure: ClosureFacts,
}

/// The records of the views that this generation's background pass walked.
#[derive(Default)]
pub(crate) struct PassWalks {
    state: Mutex<Records>,
}

#[derive(Default)]
struct Records {
    records: BTreeMap<String, (WalkRecord, usize)>,
    bytes: usize,
}

impl PassWalks {
    /// Keep one complete record while the generation's bound has room for it.
    pub(crate) fn insert(&self, route: &str, record: WalkRecord) {
        let bytes = record_bytes(&record) + route.len();
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let previous = state.records.remove(route).map_or(0, |(_, bytes)| bytes);
        state.bytes -= previous;
        let Some(total) = state
            .bytes
            .checked_add(bytes)
            .filter(|total| *total <= LIMIT)
        else {
            return;
        };
        state.bytes = total;
        state.records.insert(route.into(), (record, bytes));
    }

    /// Move a route's record to its classification, which releases it here.
    pub(crate) fn take(&self, route: &str) -> Option<WalkRecord> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let (record, bytes) = state.records.remove(route)?;
        state.bytes -= bytes;
        Some(record)
    }
}

/// Records the read set of one background walk with the generation's own identities.
pub(crate) struct PassRecorder<'a> {
    session: &'a Session,
    state: Mutex<Pending>,
}

struct Pending {
    steps: Vec<WalkStep>,
    complete: bool,
}

impl<'a> PassRecorder<'a> {
    pub(crate) fn new(session: &'a Session) -> Self {
        Self {
            session,
            state: Mutex::new(Pending {
                steps: Vec::new(),
                complete: true,
            }),
        }
    }

    /// Return the steps of a walk that recorded every input.
    pub(crate) fn finish(self) -> Option<Vec<WalkStep>> {
        let pending = self
            .state
            .into_inner()
            .unwrap_or_else(|error| error.into_inner());
        pending.complete.then_some(pending.steps)
    }

    fn read(&self, kind: ValidationRead, route: &str, identity: Option<ContentIdentity>) {
        let mut pending = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let Some(identity) = identity else {
            pending.complete = false;
            return;
        };
        let repeated = pending.steps.iter().any(
            |step| matches!(step, WalkStep::Read(read, path, _) if *read == kind && path == route),
        );
        if !repeated {
            pending
                .steps
                .push(WalkStep::Read(kind, route.into(), identity));
        }
    }
}

impl ValidationRecorder for PassRecorder<'_> {
    fn input(&self, kind: ValidationRead, route: &str) {
        self.read(kind, route, self.session.head_identity(kind, route));
    }
    fn content(&self, kind: ValidationRead, route: &str, identity: Option<ContentIdentity>) {
        self.read(kind, route, identity);
    }
    fn observe(&self, path: &str) {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .steps
            .push(WalkStep::Observe(path.into()));
    }
    fn unknown(&self) {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .complete = false;
    }
}

fn record_bytes(record: &WalkRecord) -> usize {
    mem::size_of::<WalkRecord>()
        + 256
        + record
            .steps
            .iter()
            .map(|step| {
                mem::size_of::<WalkStep>()
                    + match step {
                        WalkStep::Read(_, route, _) => route.len(),
                        WalkStep::Observe(path) => path.len(),
                    }
            })
            .sum::<usize>()
        + record
            .closure
            .files
            .iter()
            .map(|path| mem::size_of::<String>() + 64 + path.len())
            .sum::<usize>()
        + record
            .closure
            .warnings
            .iter()
            .map(|warning| {
                mem::size_of_val(warning) + warning.message.len() + warning.printed_subject().len()
            })
            .sum::<usize>()
}
