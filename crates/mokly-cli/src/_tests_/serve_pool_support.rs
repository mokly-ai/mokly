//! Record source-root runs at the injected sidecar request boundary.

use std::sync::{Arc, Mutex};

use mokly_sidecar::methods::{Call, ProcessCss};
use mokly_sidecar::pool::{PoolMock, SidecarPool};
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

#[derive(Default)]
pub(super) struct Observed {
    pub(super) roots: Vec<String>,
    pub(super) calls: Vec<String>,
}

pub(super) fn pool() -> (Arc<dyn SidecarPool>, Arc<Mutex<Observed>>) {
    let events = Arc::new(Mutex::new(Observed::default()));
    let observed = events.clone();
    let pool = Unimock::new((
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, call| {
                let Call::ProcessCss(params) = call else {
                    panic!("unexpected sidecar call")
                };
                let mut events = observed.lock().unwrap();
                if events.roots.last() != Some(&params.source_root) {
                    events.roots.push(params.source_root.clone());
                }
                events.calls.push(params.source_root);
                Ok(MethodResult::Empty)
            })),
        PoolMock::abort.next_call(matching!()).returns(Ok(())),
    ));
    (Arc::new(pool), events)
}

pub(super) fn css(root: &str, sequence: usize) -> Call {
    Call::ProcessCss(ProcessCss {
        source_root: root.into(),
        context: format!("{root}:{sequence}"),
        repository_roots: vec![],
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "style.css".into(),
        text: String::new(),
    })
}
