//! Independent work bypasses a busy affine slot and final cleanup cannot lose releases.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::Duration;

use unimock::{MockFn, Unimock, matching};

use crate::methods::{Call, ProcessCss, RenderPage};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::wire::MethodResult;
use crate::workers::WorkerMock;

fn pool() -> Arc<Pool> {
    Arc::new(Pool::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Launch {
            node: "node".into(),
            entry: "sidecar.js".into(),
            repository: "/repo".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: 2.try_into().unwrap(),
            timeout_ms: None,
        },
    ))
}
fn css() -> Call {
    Call::ProcessCss(ProcessCss {
        context: "affine".into(),
        source_root: "/repo".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
        postcss: "p.mjs".into(),
        source_path: "x.css".into(),
        text: String::new(),
    })
}
#[test]
fn a_render_uses_an_idle_slot_while_an_earlier_affine_call_waits() {
    let pool = pool();
    let (busy, _) = pool.acquire(&css()).unwrap();
    let queued = pool.clone();
    let waiting = thread::spawn(move || {
        let (index, slot) = queued.acquire(&css()).unwrap();
        queued.release(index, slot).unwrap();
        index
    });
    {
        let mut state = pool.lock().unwrap();
        while state.ticket < 2 {
            state = pool.ready.wait(state).unwrap();
        }
    }
    let render = pool.clone();
    let (send, receive) = mpsc::channel();
    let rendering = thread::spawn(move || {
        let (index, slot) = render
            .acquire(&Call::RenderPage(RenderPage {
                generation: "g".into(),
                handle: "page".into(),
            }))
            .unwrap();
        send.send(index).unwrap();
        render.release(index, slot).unwrap();
    });
    let independent = receive.recv_timeout(Duration::from_secs(10));
    pool.release(busy, None).unwrap();
    assert_eq!(waiting.join().unwrap(), busy);
    rendering.join().unwrap();
    assert_eq!(independent.unwrap(), 1);
}
#[test]
fn a_release_during_last_cleanup_is_delivered_when_the_slot_returns_idle() {
    let pool = pool();
    let recorded = Arc::new(Mutex::new(Vec::new()));
    let events = recorded.clone();
    let owner = Arc::downgrade(&pool);
    let worker = Unimock::new(
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                let Call::DisposeContext(params) = &request.call else {
                    panic!()
                };
                events.lock().unwrap().push(params.context.clone());
                if params.context == "first" {
                    let pool = owner.upgrade().unwrap();
                    pool.release_context("last");
                    pool.synchronize_releases();
                }
                Ok(MethodResult::Empty)
            }))
            .n_times(2),
    );
    {
        let mut state = pool.lock().unwrap();
        state.slots.push(None);
        state.contexts.insert("last".into());
    }
    pool.release(
        0,
        Some(Slot {
            worker: Box::new(worker.clone()),
            control: Arc::new(worker),
            generations: BTreeMap::new(),
            maps: BTreeSet::new(),
            described: BTreeSet::new(),
            bindings: BTreeMap::new(),
            contexts: BTreeSet::from(["first".into(), "last".into()]),
            renders: 0,
            requests: 0,
        }),
    )
    .unwrap();
    pool.synchronize_releases();
    assert_eq!(*recorded.lock().unwrap(), ["first", "last"]);
}
