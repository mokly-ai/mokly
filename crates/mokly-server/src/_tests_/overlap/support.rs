//! Explicit sidecar and completion gates make every scheduling edge observable.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_graph::cache_lease::ByteLease;
use tokio::sync::mpsc;
use unimock::{MockFn, Unimock, matching};

use crate::backend::{Documents, DocumentsMock};

pub(super) fn route(index: usize) -> String {
    format!("screen-{index}/index.mobile.html")
}

type Gate = Arc<(Mutex<bool>, Condvar)>;

fn wait(gate: &Gate) {
    let mut open = gate.0.lock().unwrap();
    while !*open {
        open = gate.1.wait(open).unwrap();
    }
}
fn open(gate: &Gate) {
    *gate.0.lock().unwrap() = true;
    gate.1.notify_all();
}

struct Lease(Arc<AtomicUsize>);
impl ByteLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

#[derive(Default)]
pub(super) struct Counts {
    pub(super) sidecars: AtomicUsize,
    pub(super) completions: AtomicUsize,
    pub(super) sidecar_peak: AtomicUsize,
    pub(super) completion_peak: AtomicUsize,
    pub(super) leases: Arc<AtomicUsize>,
}

pub(super) struct Renders {
    _mock: Unimock,
    root: Vec<Gate>,
    done: Vec<Gate>,
    events: mpsc::UnboundedReceiver<(&'static str, usize)>,
    seen: Vec<(&'static str, usize)>,
    pub(super) starts: Arc<Mutex<Vec<String>>>,
    pub(super) reports: Arc<Mutex<Vec<String>>>,
    pub(super) counts: Arc<Counts>,
}

impl Renders {
    pub(super) fn new(count: usize) -> (Self, Arc<dyn Documents>) {
        let root: Vec<Gate> = (0..count)
            .map(|_| Arc::new((Mutex::new(false), Condvar::new())))
            .collect();
        let done = root
            .iter()
            .map(|_| Arc::new((Mutex::new(false), Condvar::new())))
            .collect::<Vec<_>>();
        let (send, events) = mpsc::unbounded_channel();
        let counts = Arc::new(Counts::default());
        let starts = Arc::new(Mutex::new(Vec::new()));
        let reports = Arc::new(Mutex::new(Vec::new()));
        let mock = Unimock::new((
            DocumentsMock::background_staged
                .each_call(matching!(_, _))
                .answers_arc(Arc::new({
                    let root = root.clone();
                    let done = done.clone();
                    let counts = counts.clone();
                    let starts = starts.clone();
                    let send = send.clone();
                    move |_, path, completion| {
                        let index = (0..count).find(|index| route(*index) == path).unwrap();
                        starts.lock().unwrap().push(path.into());
                        counts.sidecar_peak.fetch_max(
                            counts.sidecars.fetch_add(1, Ordering::SeqCst) + 1,
                            Ordering::SeqCst,
                        );
                        send.send(("start", index)).unwrap();
                        wait(&root[index]);
                        send.send(("root", index)).unwrap();
                        counts.leases.fetch_add(1, Ordering::SeqCst);
                        completion.handoff(Box::new(Lease(counts.leases.clone())));
                        counts.sidecars.fetch_sub(1, Ordering::SeqCst);
                        counts.completion_peak.fetch_max(
                            counts.completions.fetch_add(1, Ordering::SeqCst) + 1,
                            Ordering::SeqCst,
                        );
                        send.send(("complete", index)).unwrap();
                        wait(&done[index]);
                        counts.completions.fetch_sub(1, Ordering::SeqCst);
                        send.send(("end", index)).unwrap();
                        Ok(vec![Warning {
                            code: "marker-in-raw-text",
                            subject: WarningSubject::Route(path.into()),
                            message: path.into(),
                        }])
                    }
                })),
            DocumentsMock::report
                .each_call(matching!(_, false))
                .answers_arc(Arc::new({
                    let reports = reports.clone();
                    move |_, warnings, _| {
                        reports
                            .lock()
                            .unwrap()
                            .extend(warnings.iter().map(|warning| warning.message.clone()))
                    }
                })),
            DocumentsMock::generated
                .each_call(matching!("foreground"))
                .answers_arc(Arc::new({
                    let starts = starts.clone();
                    move |_, _| {
                        starts.lock().unwrap().push("foreground".into());
                        Ok(None)
                    }
                })),
        ))
        .no_verify_in_drop();
        let documents: Arc<dyn Documents> = Arc::new(mock.clone());
        (
            Self {
                _mock: mock,
                root,
                done,
                events,
                seen: Vec::new(),
                starts,
                reports,
                counts,
            },
            documents,
        )
    }

    pub(super) fn root(&self, index: usize) {
        open(&self.root[index]);
    }
    pub(super) fn done(&self, index: usize) {
        open(&self.done[index]);
    }

    pub(super) async fn until(&mut self, event: (&'static str, usize)) {
        while !self.seen.contains(&event) {
            self.seen.push(self.events.recv().await.unwrap());
        }
    }
}

impl Drop for Renders {
    fn drop(&mut self) {
        for gate in self.root.iter().chain(&self.done) {
            open(gate);
        }
    }
}
