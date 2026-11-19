//! Request builders and threaded requests for the preload scenarios.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use crate::bindings::Bindings;
use crate::methods::{Bundle, BundleRequest, Call, CssModules, Generation, ProcessCss, RenderPage};
use crate::pool::{Pool, SidecarPool};

use super::support::Event;

pub(super) fn call(slot: usize, label: &str) -> Event {
    Event::Call(slot, label.into())
}

pub(super) fn bundle(generation: &str) -> Call {
    Call::Bundle(BundleRequest {
        plan: None,
        params: Bundle {
            source_root: "/head".into(),
            configuration_directory: ".".into(),
            entry_files: vec![generation.into()],
            renderer: None,
            stories_files: vec![],
            repository_roots: vec![],
            module_resolution: Default::default(),
            evaluation: None,
        },
        capture: None,
    })
}

pub(super) fn maps(generation: &str) -> Call {
    Call::CssModules(CssModules {
        generation: generation.into(),
        class_maps: BTreeMap::new(),
    })
}

pub(super) fn describe(generation: &str) -> Call {
    Call::Describe(Generation {
        generation: generation.into(),
    })
}

pub(super) fn bindings(generation: &str) -> Call {
    Call::Bindings(Bindings {
        generation: generation.into(),
        entries: BTreeMap::new(),
    })
}

pub(super) fn render(generation: &str) -> Call {
    Call::RenderPage(RenderPage {
        generation: generation.into(),
        handle: "page#default".into(),
    })
}

pub(super) fn css(root: &str, context: &str) -> Call {
    Call::ProcessCss(ProcessCss {
        source_root: root.into(),
        context: context.into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "style.css".into(),
        text: String::new(),
    })
}

/// Run one request on its own thread and report its outcome on a channel.
pub(super) fn send(pool: &Arc<Pool>, call: Call) -> (JoinHandle<()>, Receiver<bool>) {
    let (done, outcome) = mpsc::channel();
    let pool = pool.clone();
    let job = thread::spawn(move || {
        let _ = done.send(pool.request(call).is_ok());
    });
    (job, outcome)
}

/// A request that must not wait reports within the ten-second expected-state allowance.
pub(super) fn finished(outcome: &Receiver<bool>) -> std::result::Result<bool, RecvTimeoutError> {
    outcome.recv_timeout(Duration::from_secs(10))
}
