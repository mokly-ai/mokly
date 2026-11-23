//! Complete candidate construction reuses immutable evidence in current route order.

use std::collections::BTreeMap;
use std::mem;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_catalogue::diagnostic::Warning;

use crate::comparison_consumer::Consumer;
use crate::comparison_reuse::ReuseWork;
use crate::comparison_routes::ViewRoutes;
use crate::comparison_views::{ImmutableView, PendingView};
use crate::reuse_budget::{Charge, Resident};
use crate::reuse_probes::Probes;
use crate::reuse_reads::Recorder;
use crate::validation_inputs::arena_bytes;
use crate::{reuse_digest, reuse_weight};

pub(crate) struct SavedView {
    bytes: usize,
    _shared: (Charge, Vec<Arc<Charge>>),
    pub(crate) input: Arc<ImmutableView>,
    pub(crate) warnings: Box<[Warning]>,
    pub(crate) reads: Arc<Recorder>,
    _charge: Charge,
}

pub(crate) struct Classification {
    pub(crate) fence: [u8; 32],
    pub(crate) views: BTreeMap<[u8; 32], Arc<SavedView>>,
    charge: Charge,
    pub(crate) bytes: usize,
}

pub(crate) struct Collection {
    pub(crate) resident: Arc<Resident>,
    pub(crate) previous: Option<Arc<Classification>>,
    pub(crate) candidate: Option<Classification>,
    pub(crate) work: ReuseWork,
    pub(crate) probes: Arc<Probes>,
    pub(crate) paths: Option<[u8; 32]>,
    pub(crate) recording: Arc<AtomicBool>,
}

impl Collection {
    pub(crate) fn new(
        resident: Arc<Resident>,
        previous: Option<Arc<Classification>>,
        fence: Option<[u8; 32]>,
    ) -> Self {
        let fixed = mem::size_of::<Classification>() + 64;
        let candidate = fence.and_then(|fence| {
            resident.reserve(fixed).map(|mut charge| {
                if let Some(owner) = resident.register_optional(arena_bytes()) {
                    charge.attach_optional(owner);
                }
                Classification {
                    fence,
                    views: BTreeMap::new(),
                    charge,
                    bytes: fixed,
                }
            })
        });
        let overflowed = fence.is_some() && candidate.is_none();
        let probes = Probes::new(&resident);
        if let Some(previous) = &previous {
            for view in previous.views.values() {
                view.reads.seed(&probes);
            }
        }
        let recording = Arc::new(AtomicBool::new(candidate.is_some()));
        Self {
            resident,
            previous,
            candidate,
            work: ReuseWork {
                overflowed,
                ..ReuseWork::default()
            },
            probes,
            paths: None,
            recording,
        }
    }
    fn abandon(&mut self, overflowed: bool) {
        self.candidate = None;
        self.work.overflowed |= overflowed;
        self.recording.store(false, Ordering::Release);
    }
    pub(crate) fn key(&self, route: &ViewRoutes, consumer: &Consumer<'_>) -> Option<[u8; 32]> {
        let paths = self.paths?;
        reuse_digest::digest(&(
            consumer.previous,
            consumer.current,
            &consumer.component,
            &paths,
            route.key.viewport,
            route.key.color_scheme,
            &route.before,
            &route.after,
            route.moved,
        ))
    }
    pub(crate) fn lookup(&self, key: &[u8; 32]) -> Option<Arc<SavedView>> {
        self.previous.as_ref()?.views.get(key).cloned()
    }
    pub(crate) fn reused(&mut self, key: [u8; 32], view: Arc<SavedView>) {
        self.work.reused += 1;
        self.work.reads += view.reads.len();
        self.insert(key, view);
    }
    pub(crate) fn compared(
        &mut self,
        key: Option<[u8; 32]>,
        view: &PendingView,
        warnings: &[Warning],
        recorder: Option<Arc<Recorder>>,
    ) {
        self.work.compared += 1;
        let Some(key) = key else {
            self.abandon(false);
            return;
        };
        let Some(reads) = recorder else {
            self.abandon(self.recording.load(Ordering::Acquire));
            return;
        };
        self.work.reads += reads.len();
        if reads.overflowed() {
            self.abandon(true);
            return;
        }
        if self.candidate.is_none() {
            return;
        }
        let Some(charge) = self
            .resident
            .reserve(mem::size_of::<SavedView>() + 64 + reuse_weight::owned(&view.input, warnings))
        else {
            self.abandon(true);
            return;
        };
        let Some(shared) = reuse_weight::shared(&view.input, &self.resident) else {
            self.abandon(true);
            return;
        };
        let bytes = charge.bytes()
            + reads.bytes()
            + shared.0.bytes()
            + shared.1.iter().map(|charge| charge.bytes()).sum::<usize>();
        reads.seal();
        let saved = Arc::new(SavedView {
            bytes,
            input: view.input.clone(),
            warnings: warnings.to_vec().into_boxed_slice(),
            reads,
            _charge: charge,
            _shared: shared,
        });
        self.insert(key, saved);
    }
    fn insert(&mut self, key: [u8; 32], view: Arc<SavedView>) {
        if self.probes.overflowed.load(Ordering::Acquire) {
            self.abandon(true);
        }
        let Some(candidate) = &mut self.candidate else {
            return;
        };
        let index_bytes = mem::size_of::<([u8; 32], Arc<SavedView>)>() + 256;
        if !candidate.charge.grow(index_bytes) {
            self.abandon(true);
            return;
        }
        candidate.bytes += index_bytes + view.bytes;
        candidate.views.insert(key, view);
        self.work.candidate_views += 1;
        self.work.candidate_bytes = candidate.bytes;
    }
}

impl Classification {
    pub(crate) fn fact_id(&self) -> Option<usize> {
        self.charge.optional_id()
    }
}
