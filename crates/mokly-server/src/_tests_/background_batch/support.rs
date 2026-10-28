//! Gated blocking renders that record their starts, warnings, and reports.

use std::collections::BTreeSet;
use std::io;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_graph::error::GraphError;
use tokio::sync::mpsc;
use unimock::{MockFn, Unimock, matching};

use crate::backend::{Documents, DocumentsMock};
use crate::error::{InternalError, ServerError};

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

/// A build warning whose message names its route.
pub(super) fn warning(route: &str) -> Warning {
    Warning {
        code: "marker-in-raw-text",
        subject: WarningSubject::Route(route.into()),
        message: format!("warning of {route}"),
    }
}

/// Blocking renders that record their start order and hold gated routes. The blocking
/// pool can drop its document handle after the worker permit returns, so the mock skips
/// drop verification and the tests assert the recorded starts instead.
pub(super) struct Renders {
    started: Arc<Mutex<Vec<String>>>,
    events: Arc<Mutex<Vec<String>>>,
    signals: mpsc::UnboundedReceiver<String>,
    gates: Vec<(String, Gate)>,
    active: Arc<AtomicUsize>,
    peak: Arc<AtomicUsize>,
}

impl Renders {
    /// Gate the named routes and fail the failing ones. Generated reads render too, so a
    /// test can hold a worker with a foreground request.
    pub(super) fn new(gated: &[&str], failing: &[&str]) -> (Self, Arc<dyn Documents>) {
        Self::warned(gated, failing, &[])
    }

    /// As [`Renders::new`], and the warned routes return a warning. A warned failing
    /// route fails with a render error that keeps its warning.
    pub(super) fn warned(
        gated: &[&str],
        failing: &[&str],
        warned: &[&str],
    ) -> (Self, Arc<dyn Documents>) {
        let started = Arc::new(Mutex::new(Vec::new()));
        let events = Arc::new(Mutex::new(Vec::new()));
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
        let warned: BTreeSet<String> = warned.iter().map(|route| (*route).to_owned()).collect();
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
                let warnings: Vec<_> = warned
                    .contains(route)
                    .then(|| warning(route))
                    .into_iter()
                    .collect();
                match (failing.contains(route), warnings.is_empty()) {
                    (true, true) => Err(failure(route)),
                    (true, false) => Err(ServerError::Render {
                        source: GraphError::Attempt {
                            failures: Vec::new(),
                            warnings,
                        },
                    }),
                    (false, _) => Ok(warnings),
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
                DocumentsMock::report
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new({
                        let events = events.clone();
                        move |_, warnings: &[Warning], failed| {
                            for warning in warnings {
                                events
                                    .lock()
                                    .unwrap()
                                    .push(format!("{}, failed {failed}", warning.message));
                            }
                        }
                    })),
            ))
            .no_verify_in_drop(),
        );
        let renders = Self {
            started,
            events,
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

    /// Wait until every given route has reached the renderer, in any order, and return
    /// every route seen. Blocking threads can signal their starts out of order.
    pub(super) async fn wait_for(&mut self, routes: &[String]) -> BTreeSet<String> {
        let mut seen = BTreeSet::new();
        while !routes.iter().all(|route| seen.contains(route)) {
            seen.insert(self.next_start().await);
        }
        seen
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

    /// The record of reported warnings, shared with recording diagnostics.
    pub(super) fn events(&self) -> Arc<Mutex<Vec<String>>> {
        self.events.clone()
    }
}

impl Drop for Renders {
    fn drop(&mut self) {
        for (route, _) in self.gates.clone() {
            self.release(&route);
        }
    }
}
