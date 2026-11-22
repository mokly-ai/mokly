//! Optional facts share complete walk-read identities and keep no runtime inputs.

use std::collections::BTreeMap;
use std::mem;
use std::sync::atomic::{AtomicBool, AtomicUsize};
use std::sync::{Arc, Mutex};

use mokly_graph::comparison_proof::ContentIdentity;
use mokly_graph::head_validation::{ClosureFacts, ValidationRead};

use crate::reuse_budget::Charge;

pub(crate) struct Read {
    pub(crate) kind: ValidationRead,
    pub(crate) route: Arc<str>,
    pub(crate) identity: ContentIdentity,
    pub(crate) _charge: Charge,
}

pub(crate) struct Fact {
    pub(crate) key: ContentIdentity,
    pub(crate) closure: ClosureFacts,
    pub(crate) reads: Vec<Arc<Read>>,
    pub(crate) steps: Vec<Step>,
    pub(crate) _charge: Charge,
}

pub(crate) struct Pending {
    pub(crate) reads: Vec<Arc<Read>>,
    pub(crate) observed: Vec<String>,
    pub(crate) complete: bool,
    pub(crate) steps: Vec<Step>,
    pub(crate) charge: Charge,
}

#[derive(Clone, Copy)]
pub(crate) enum Step {
    Read(usize),
    Observe(usize),
}

type InputKey = (ValidationRead, Arc<str>);
type Inputs = BTreeMap<InputKey, Option<Arc<Read>>>;

impl Pending {
    pub(crate) fn step(&mut self, step: Step) {
        let growth = if self.steps.len() == self.steps.capacity() {
            self.steps.capacity().max(4)
        } else {
            0
        };
        if !self.charge.grow(growth * mem::size_of::<Step>()) {
            self.complete = false;
            return;
        }
        self.steps.reserve_exact(growth);
        self.steps.push(step);
    }
}

pub(crate) struct Data {
    pub(crate) facts: Mutex<BTreeMap<Arc<str>, Arc<Fact>>>,
    pub(crate) inputs: Mutex<Inputs>,
    pub(crate) input_bytes: AtomicUsize,
    pub(crate) consistent: AtomicBool,
    pub(crate) pending: Mutex<BTreeMap<String, Pending>>,
    pub(crate) charge: Mutex<Charge>,
}

impl Data {
    pub(crate) fn new(charge: Charge) -> Self {
        Self {
            charge: Mutex::new(charge),
            facts: Mutex::new(BTreeMap::new()),
            inputs: Mutex::new(BTreeMap::new()),
            input_bytes: AtomicUsize::new(0),
            consistent: AtomicBool::new(true),
            pending: Mutex::new(BTreeMap::new()),
        }
    }
}

pub(crate) fn closure_bytes(closure: &ClosureFacts) -> usize {
    closure
        .files
        .iter()
        .map(|path| mem::size_of::<String>() + 256 + path.len())
        .sum::<usize>()
        + closure.warnings.len() * mem::size_of::<mokly_catalogue::diagnostic::Warning>()
        + closure
            .warnings
            .iter()
            .map(|warning| warning.message.len() + warning.printed_subject().len())
            .sum::<usize>()
}
