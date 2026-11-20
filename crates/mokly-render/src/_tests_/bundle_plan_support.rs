//! Core plan tests call real bundle requests over mocked physical and pool boundaries.

use std::collections::{BTreeMap, VecDeque};
use std::sync::{Arc, Mutex};

use mokly_sidecar::compiled::{
    CompiledGeneration, PhysicalInput, ReuseEvidence, UncapturedEvidence,
};
use mokly_sidecar::methods::{Bundle, BundleRequest, Call};
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::resolution_plan::{PlannedImport, ResolutionPlan};
use mokly_sidecar::results;
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

use crate::recorded_calls::lock_calls;
use crate::runtime::Runtime;

pub(super) fn params() -> Bundle {
    Bundle {
        evaluation: None,
        entry_files: vec!["entry.ts".into()],
        renderer: None,
        stories_files: vec![],
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
    }
}

pub(super) fn evidence() -> Arc<ReuseEvidence> {
    Arc::new(ReuseEvidence {
        complete: true,
        durable: true,
        uncaptured: None,
        inputs: BTreeMap::from([("/physical/config.json".into(), PhysicalInput::Absent)]),
    })
}

pub(super) fn plan() -> Arc<ResolutionPlan> {
    Arc::new(ResolutionPlan {
        imports: BTreeMap::from([(
            "edge".into(),
            PlannedImport {
                path: "/repo/value.ts".into(),
                side_effects: true,
            },
        )]),
    })
}

pub(super) fn result(
    plan: Option<Arc<ResolutionPlan>>,
    evidence: Arc<ReuseEvidence>,
) -> results::Bundle {
    results::Bundle {
        plan,
        generation: "generation".into(),
        epoch: 1,
        cache: None,
        compile_count: 1,
        modules: vec![],
        unmapped_dependency_directories: None,
        compiled: Arc::new(CompiledGeneration {
            toolchain: "fixture".into(),
            metadata_identity: None,
            reuse_evidence: evidence,
            identity: "identity".into(),
            code: String::new(),
            runtime_key: "runtime".into(),
            dependency_roots: vec![],
            css_modules: vec![],
            sources: BTreeMap::new(),
            peers: BTreeMap::new(),
            inputs: BTreeMap::new(),
            metadata_inputs: BTreeMap::new(),
            input_directories: BTreeMap::new(),
            metadata_directories: BTreeMap::new(),
            unmapped_dependency_directories: None,
        }),
    }
}

pub(super) fn marked() -> results::Bundle {
    result(
        None,
        Arc::new(ReuseEvidence {
            complete: false,
            durable: false,
            uncaptured: Some(UncapturedEvidence::ServeEdit),
            inputs: BTreeMap::new(),
        }),
    )
}

pub(super) fn runtime(
    physical: Unimock,
    replies: Vec<results::Bundle>,
    calls: Arc<Mutex<Vec<BundleRequest>>>,
) -> Runtime {
    let replies = Mutex::new(VecDeque::from(replies));
    Runtime::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(physical),
        Arc::new(Unimock::new((
            PoolMock::request
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, call| {
                    let Call::Bundle(request) = call else {
                        panic!("unexpected request")
                    };
                    lock_calls(&calls).push(request);
                    Ok(MethodResult::Bundle(Box::new(
                        replies.lock().unwrap().pop_front().unwrap_or_else(marked),
                    )))
                })),
            PoolMock::release_generation
                .each_call(matching!(_, _))
                .returns(()),
        ))),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        "test".into(),
        None,
    )
}
