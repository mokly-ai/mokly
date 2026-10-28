//! Gated blocking renders and a scripted publication for batch scheduling tests.

use std::collections::BTreeSet;
use std::io;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};

use tokio::sync::{broadcast, mpsc, watch};
use unimock::{MockFn, Unimock, matching};

use crate::backend::{Documents, DocumentsMock};
use crate::background::UsagePass;
use crate::diagnostics::{Diagnostics, DiagnosticsMock};
use crate::error::{InternalError, ServerError};
use crate::publication::{PublicationEvent, PublicationsMock, Subscription};
use crate::snapshot::Snapshot;
use crate::work::Work;

type Gate = Arc<(Mutex<bool>, Condvar)>;

/// The route of the numbered screen that `publication_support::snapshot` creates.
pub(super) fn route(number: usize) -> String {
    format!("screen-{number}/index.mobile.html")
}

/// A failure whose text names its route, so reports can be told apart.
pub(super) fn failure(route: &str) -> ServerError {
    ServerError::Internal(InternalError::Io {
        source: io::Error::other(route.to_owned()),
    })
}

/// Blocking renders that record their start order and hold gated routes. The blocking
/// pool can drop its document handle after the worker permit returns, so the mock skips
/// drop verification and the tests assert the recorded starts instead.
pub(super) struct Renders {
    started: Arc<Mutex<Vec<String>>>,
    signals: mpsc::UnboundedReceiver<String>,
    gates: Vec<(String, Gate)>,
    active: Arc<AtomicUsize>,
    peak: Arc<AtomicUsize>,
}

impl Renders {
    /// Gate the named routes and fail the failing ones. Generated reads render too, so a
    /// test can hold a worker with a foreground request.
    pub(super) fn new(gated: &[&str], failing: &[&str]) -> (Self, Arc<dyn Documents>) {
        let started = Arc::new(Mutex::new(Vec::new()));
        let (signal, signals) = mpsc::unbounded_channel();
        let gates: Vec<(String, Gate)> = gated
            .iter()
            .map(|route| {
                (
                    (*route).to_owned(),
                    Arc::new((Mutex::new(false), Condvar::new())),
                )
            })
            .collect();
        let failing: BTreeSet<String> = failing.iter().map(|route| (*route).to_owned()).collect();
        let active = Arc::new(AtomicUsize::new(0));
        let peak = Arc::new(AtomicUsize::new(0));
        let render = {
            let started = started.clone();
            let gates = gates.clone();
            let active = active.clone();
            let peak = peak.clone();
            move |route: &str| {
                started.lock().unwrap().push(route.to_owned());
                peak.fetch_max(active.fetch_add(1, Ordering::SeqCst) + 1, Ordering::SeqCst);
                let _ = signal.send(route.to_owned());
                if let Some((_, gate)) = gates.iter().find(|(name, _)| name == route) {
                    let mut released = gate.0.lock().unwrap();
                    while !*released {
                        released = gate.1.wait(released).unwrap();
                    }
                }
                active.fetch_sub(1, Ordering::SeqCst);
            }
        };
        let background = Arc::new({
            let render = render.clone();
            move |_: &Unimock, route: &str| {
                render(route);
                if failing.contains(route) {
                    Err(failure(route))
                } else {
                    Ok(())
                }
            }
        });
        let generated = Arc::new(move |_: &Unimock, route: &str| {
            render(route);
            Ok(None)
        });
        let documents: Arc<dyn Documents> = Arc::new(
            Unimock::new((
                DocumentsMock::background
                    .each_call(matching!(_))
                    .answers_arc(background),
                DocumentsMock::generated
                    .each_call(matching!(_))
                    .answers_arc(generated),
            ))
            .no_verify_in_drop(),
        );
        let renders = Self {
            started,
            signals,
            gates,
            active,
            peak,
        };
        (renders, documents)
    }

    /// Wait until the next render reaches the renderer and return its route.
    pub(super) async fn next_start(&mut self) -> String {
        self.signals.recv().await.unwrap()
    }

    /// Let one gated route finish.
    pub(super) fn release(&self, route: &str) {
        if let Some((_, gate)) = self.gates.iter().find(|(name, _)| name == route) {
            *gate.0.lock().unwrap() = true;
            gate.1.notify_all();
        }
    }

    /// Every route that reached the renderer, in arrival order.
    pub(super) fn started(&self) -> Vec<String> {
        self.started.lock().unwrap().clone()
    }

    /// The most renders that ran at the same time.
    pub(super) fn peak(&self) -> usize {
        self.peak.load(Ordering::SeqCst)
    }

    /// Whether any render still runs.
    pub(super) fn active(&self) -> usize {
        self.active.load(Ordering::SeqCst)
    }
}

impl Drop for Renders {
    fn drop(&mut self) {
        for (route, _) in self.gates.clone() {
            self.release(&route);
        }
    }
}

/// A publication whose current snapshot the test replaces, and the passes' completions.
pub(super) struct Script {
    _mock: Unimock,
    pub(super) current: Arc<Mutex<Arc<Snapshot>>>,
    pub(super) updates: broadcast::Sender<PublicationEvent>,
    pub(super) published: Arc<Mutex<Vec<Vec<String>>>>,
    pub(super) stop: Arc<watch::Sender<bool>>,
}

impl Script {
    /// Replace the current snapshot and announce the new revision.
    pub(super) fn replace(&self, next: Arc<Snapshot>) {
        *self.current.lock().unwrap() = next;
        assert!(
            self.updates
                .send(PublicationEvent {
                    revision: 2,
                    deployment_id: "process".into(),
                })
                .is_ok()
        );
    }
}

/// A pass over `origin` with the given batch. With `publishes`, its first completion
/// stops Serve; without it, a completion fails the test. The script comes first, so
/// its original mock drops after the pass's clone.
pub(super) fn pass(
    origin: Arc<Snapshot>,
    batch: usize,
    work: Arc<dyn Work>,
    diagnostics: Arc<dyn Diagnostics>,
    publishes: bool,
) -> (Script, UsagePass, watch::Receiver<bool>) {
    let current = Arc::new(Mutex::new(origin));
    let (updates, receiver) = broadcast::channel(64);
    let (stop, stopping) = watch::channel(false);
    let stop = Arc::new(stop);
    let published = Arc::new(Mutex::new(Vec::new()));
    let reads = (
        PublicationsMock::current
            .each_call(matching!())
            .answers_arc(Arc::new({
                let current = current.clone();
                move |_| current.lock().unwrap().clone()
            })),
        PublicationsMock::subscribe
            .next_call(matching!())
            .returns(Subscription {
                current: PublicationEvent {
                    revision: 1,
                    deployment_id: "process".into(),
                },
                updates: receiver,
            }),
    );
    let mock = if publishes {
        Unimock::new((
            reads,
            PublicationsMock::completed_many
                .each_call(matching!(_, _))
                .answers_arc(Arc::new({
                    let published = published.clone();
                    let stop = stop.clone();
                    move |_, _, routes| {
                        published.lock().unwrap().push(routes.to_vec());
                        stop.send_replace(true);
                        Ok(())
                    }
                })),
        ))
    } else {
        Unimock::new(reads)
    };
    let pass = UsagePass {
        batch,
        changes: None,
        publications: Arc::new(mock.clone()),
        work,
        diagnostics,
    };
    let script = Script {
        _mock: mock,
        current,
        updates,
        published,
        stop,
    };
    (script, pass, stopping)
}

/// Diagnostics that record each reported failure's text.
pub(super) fn reports() -> (Arc<dyn Diagnostics>, Arc<Mutex<Vec<String>>>) {
    let reports = Arc::new(Mutex::new(Vec::new()));
    let diagnostics = Unimock::new(DiagnosticsMock::failed.each_call(matching!(_)).answers_arc(
        Arc::new({
            let reports = reports.clone();
            move |_, error| reports.lock().unwrap().push(error.to_string())
        }),
    ));
    (Arc::new(diagnostics), reports)
}
