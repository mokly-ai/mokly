//! One bounded identity table shares recording and worker proofs across an attempt.

use std::collections::BTreeMap;
use std::mem;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use mokly_graph::comparison_proof::{ComparisonRead, ContentIdentity, DocumentProof, ProofMode};
use mokly_graph::types::RenderGeneration;
use mokly_model::review_affected::ReviewSide;
use mokly_model::usage::CatalogueUsage;

use crate::reuse_budget::{Charge, Resident};
use crate::reuse_reads::Read;

struct Probe {
    previous: Option<Arc<Read>>,
    value: Mutex<Option<Option<Arc<Read>>>>,
    _charge: Charge,
}

pub(crate) struct Probes {
    pub(crate) documents: Mutex<BTreeMap<String, DocumentProof>>,
    pub(crate) resident: Arc<Resident>,
    values: Mutex<[BTreeMap<Arc<str>, Arc<Probe>>; 6]>,
    _charge: Option<Charge>,
    pub(crate) checked: AtomicUsize,
    pub(crate) reads: AtomicUsize,
    pub(crate) recording_reads: AtomicUsize,
    pub(crate) recording_nanos: AtomicU64,
    pub(crate) revalidation_nanos: AtomicU64,
    pub(crate) usage_nanos: AtomicU64,
    pub(crate) overflowed: AtomicBool,
}

impl Probes {
    pub(crate) fn new(resident: &Arc<Resident>) -> Arc<Self> {
        let charge = resident.reserve(mem::size_of::<Self>() + 32 + 6 * 320);
        Arc::new(Self {
            documents: Mutex::new(BTreeMap::new()),
            resident: resident.clone(),
            values: Default::default(),
            overflowed: AtomicBool::new(charge.is_none()),
            _charge: charge,
            checked: AtomicUsize::new(0),
            reads: AtomicUsize::new(0),
            recording_reads: AtomicUsize::new(0),
            recording_nanos: AtomicU64::new(0),
            revalidation_nanos: AtomicU64::new(0),
            usage_nanos: AtomicU64::new(0),
        })
    }
    fn probe(
        &self,
        side: ReviewSide,
        kind: ComparisonRead,
        route: &str,
        previous: Option<&Arc<Read>>,
    ) -> Option<Arc<Probe>> {
        if self.overflowed.load(Ordering::Acquire) {
            return None;
        }
        let index = match kind {
            ComparisonRead::Document => 0,
            ComparisonRead::Closure => 1,
            ComparisonRead::Resource => 2,
        } + usize::from(side == ReviewSide::After) * 3;
        let mut tables = self
            .values
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(probe) = tables[index].get(route) {
            return Some(probe.clone());
        }
        let bytes = mem::size_of::<Probe>()
            + mem::size_of::<(Arc<str>, Arc<Probe>)>()
            + 96
            + previous.map_or(route.len() + 32, |_| 0);
        let Some(charge) = self.resident.reserve(bytes) else {
            self.overflowed.store(true, Ordering::Release);
            return None;
        };
        let route = previous.map_or_else(|| Arc::from(route), |read| read.route.clone());
        let probe = Arc::new(Probe {
            previous: previous.cloned(),
            value: Mutex::new(None),
            _charge: charge,
        });
        tables[index].insert(route, probe.clone());
        Some(probe)
    }
    pub(crate) fn seed(&self, read: &Arc<Read>) {
        self.probe(read.side, read.kind, &read.route, Some(read));
    }
    fn retain(
        &self,
        probe: &Probe,
        side: ReviewSide,
        kind: ComparisonRead,
        route: &str,
        identity: ContentIdentity,
    ) -> Option<Arc<Read>> {
        if let Some(previous) = &probe.previous
            && previous.identity == identity
        {
            return Some(previous.clone());
        }
        let Some(charge) = self
            .resident
            .reserve(mem::size_of::<Read>() + route.len() + 64)
        else {
            self.overflowed.store(true, Ordering::Release);
            return None;
        };
        Some(Arc::new(Read {
            side,
            kind,
            route: Arc::from(route),
            identity,
            _charge: charge,
        }))
    }
    pub(crate) fn record(
        &self,
        generation: &dyn RenderGeneration,
        side: ReviewSide,
        kind: ComparisonRead,
        route: &str,
    ) -> Option<Arc<Read>> {
        let probe = self.probe(side, kind, route, None)?;
        let mut value = probe
            .value
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(Some(read)) = &*value {
            return Some(read.clone());
        }
        self.recording_reads.fetch_add(1, Ordering::Relaxed);
        let mut identity = generation.comparison_identity(kind, route, ProofMode::Retained);
        if identity.is_none() && side == ReviewSide::After {
            self.recording_reads.fetch_add(1, Ordering::Relaxed);
            identity = generation.comparison_identity(kind, route, ProofMode::Current);
        }
        let read = self.retain(&probe, side, kind, route, identity?)?;
        *value = Some(Some(read.clone()));
        Some(read)
    }
    pub(crate) fn identity(
        &self,
        read: &Arc<Read>,
        before: &dyn RenderGeneration,
        after: &dyn RenderGeneration,
    ) -> Option<ContentIdentity> {
        self.checked.fetch_add(1, Ordering::Relaxed);
        let probe = self.probe(read.side, read.kind, &read.route, Some(read))?;
        let mut value = probe
            .value
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(value) = &*value {
            return value.as_ref().map(|read| read.identity);
        }
        let (generation, mode) = if read.side == ReviewSide::Before {
            (before, ProofMode::Retained)
        } else {
            (after, ProofMode::Current)
        };
        self.reads.fetch_add(1, Ordering::Relaxed);
        let identity = generation.comparison_identity(read.kind, &read.route, mode);
        if identity.is_some() || read.side == ReviewSide::After {
            *value = Some(identity.and_then(|identity| {
                self.retain(&probe, read.side, read.kind, &read.route, identity)
            }));
        }
        identity
    }
    pub(crate) fn document(
        &self,
        read: &Arc<Read>,
        after: &dyn RenderGeneration,
    ) -> Option<Option<CatalogueUsage>> {
        self.checked.fetch_add(1, Ordering::Relaxed);
        let probe = self.probe(read.side, read.kind, &read.route, Some(read))?;
        let mut value = probe
            .value
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        self.reads.fetch_add(1, Ordering::Relaxed);
        let start = Instant::now();
        let forwarded = self
            .documents
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .remove(read.route.as_ref());
        let proof = forwarded.or_else(|| after.comparison_document_proof(&read.route));
        self.usage_nanos
            .fetch_add(start.elapsed().as_nanos() as u64, Ordering::Relaxed);
        let proof = proof?;
        *value = Some(self.retain(&probe, read.side, read.kind, &read.route, proof.identity));
        (proof.identity == read.identity).then_some(proof.usage)
    }
}
