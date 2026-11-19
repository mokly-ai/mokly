//! Compact sorted read pointers share charged identities across views and attempts.

use std::mem;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use mokly_graph::closure::Closure;
use mokly_graph::comparison_proof::{ComparisonRead, ContentIdentity};
use mokly_graph::types::RenderGeneration;
use mokly_model::review_affected::ReviewSide;
use mokly_model::usage::CatalogueUsage;

use crate::reuse_budget::Charge;
use crate::reuse_probes::Probes;

pub(crate) struct Read {
    pub(crate) side: ReviewSide,
    pub(crate) kind: ComparisonRead,
    pub(crate) route: Arc<str>,
    pub(crate) identity: ContentIdentity,
    pub(crate) _charge: Charge,
}

struct Reads {
    values: Vec<Arc<Read>>,
    complete: bool,
    charge: Charge,
}

pub(crate) struct Recorder {
    reads: Mutex<Reads>,
    probes: Mutex<Option<Arc<Probes>>>,
}

impl Recorder {
    pub(crate) fn new(probes: &Arc<Probes>) -> Option<Arc<Self>> {
        let charge = probes.resident.reserve(mem::size_of::<Self>() + 32)?;
        Some(Arc::new(Self {
            reads: Mutex::new(Reads {
                values: Vec::new(),
                complete: true,
                charge,
            }),
            probes: Mutex::new(Some(probes.clone())),
        }))
    }
    pub(crate) fn invalidate(&self) {
        self.reads
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .complete = false;
    }
    pub(crate) fn record(
        &self,
        generation: &dyn RenderGeneration,
        side: ReviewSide,
        kind: ComparisonRead,
        route: &str,
    ) {
        let Some(probes) = self.table() else {
            self.invalidate();
            return;
        };
        let start = Instant::now();
        self.record_inner(&probes, generation, side, kind, route);
        probes
            .recording_nanos
            .fetch_add(start.elapsed().as_nanos() as u64, Ordering::Relaxed);
    }
    fn record_inner(
        &self,
        probes: &Probes,
        generation: &dyn RenderGeneration,
        side: ReviewSide,
        kind: ComparisonRead,
        route: &str,
    ) {
        let mut reads = self.reads.lock().unwrap_or_else(|error| error.into_inner());
        if !reads.complete {
            return;
        }
        let position = reads.values.binary_search_by(|read| {
            (read.side, read.kind, read.route.as_ref()).cmp(&(side, kind, route))
        });
        let Err(position) = position else {
            return;
        };
        let growth = if reads.values.len() == reads.values.capacity() {
            reads.values.capacity().max(4)
        } else {
            0
        };
        if growth != 0 && !reads.charge.grow(growth * mem::size_of::<Arc<Read>>()) {
            reads.complete = false;
            probes.overflowed.store(true, Ordering::Release);
            return;
        }
        let Some(read) = probes.record(generation, side, kind, route) else {
            reads.complete = false;
            return;
        };
        reads.values.reserve_exact(growth);
        reads.values.insert(position, read);
    }
    pub(crate) fn closure_union(
        &self,
        before: &dyn RenderGeneration,
        after: &dyn RenderGeneration,
        closures: [&Closure; 2],
    ) {
        for closure in closures {
            for route in closure
                .edges
                .keys()
                .map(String::as_str)
                .chain(
                    closure
                        .evidence
                        .iter()
                        .map(|resource| resource.path.as_str()),
                )
                .chain(
                    closure
                        .references
                        .iter()
                        .map(|reference| reference.path.as_str()),
                )
            {
                self.record(before, ReviewSide::Before, ComparisonRead::Resource, route);
                self.record(after, ReviewSide::After, ComparisonRead::Resource, route);
            }
            for file in &closure.files {
                let route = format!("static/{file}");
                self.record(before, ReviewSide::Before, ComparisonRead::Resource, &route);
                self.record(after, ReviewSide::After, ComparisonRead::Resource, &route);
            }
        }
    }
    pub(crate) fn overflowed(&self) -> bool {
        self.table()
            .is_some_and(|probes| probes.overflowed.load(Ordering::Acquire))
    }
    pub(crate) fn len(&self) -> usize {
        self.reads
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .values
            .len()
    }
    pub(crate) fn bytes(&self) -> usize {
        let reads = self.reads.lock().unwrap_or_else(|error| error.into_inner());
        reads.charge.bytes()
            + reads
                .values
                .iter()
                .map(|read| read._charge.bytes())
                .sum::<usize>()
    }
    pub(crate) fn seed(&self, probes: &Probes) {
        let reads = self.reads.lock().unwrap_or_else(|error| error.into_inner());
        for read in &reads.values {
            probes.seed(read);
        }
    }
    pub(crate) fn usage(&self, nanos: u64) {
        if let Some(probes) = self.table() {
            probes.usage_nanos.fetch_add(nanos, Ordering::Relaxed);
        }
    }
    pub(crate) fn valid(
        &self,
        before: &dyn RenderGeneration,
        after: &dyn RenderGeneration,
        probes: &Probes,
        head: Option<&str>,
    ) -> Option<Option<CatalogueUsage>> {
        let start = Instant::now();
        let reads = self.reads.lock().unwrap_or_else(|error| error.into_inner());
        let mut usage = None;
        let valid = reads.complete
            && reads.values.iter().all(|read| {
                if read.side == ReviewSide::After
                    && read.kind == ComparisonRead::Document
                    && head == Some(read.route.as_ref())
                {
                    usage = probes.document(read, after);
                    usage.is_some()
                } else {
                    probes.identity(read, before, after) == Some(read.identity)
                }
            });
        probes
            .revalidation_nanos
            .fetch_add(start.elapsed().as_nanos() as u64, Ordering::Relaxed);
        if !valid || (head.is_some() && usage.is_none()) {
            return None;
        }
        Some(usage.flatten())
    }
    fn table(&self) -> Option<Arc<Probes>> {
        self.probes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }
    pub(crate) fn seal(&self) {
        *self
            .probes
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = None;
    }
}
