//! The render window starts work in priority order and reports in catalogue order.

use std::collections::BTreeMap;
use std::future::{Future, poll_fn};
use std::mem;
use std::pin::Pin;
use std::sync::Arc;
use std::task::Poll;

use mokly_catalogue::diagnostic::Warning;

use crate::background_dispatch::Dispatch;
use crate::error::Result;

/// One pending background render; it ends with its unreported warnings or a failure.
pub(crate) type Render<'a> = Pin<Box<dyn Future<Output = Result<Vec<Warning>>> + Send + 'a>>;

struct Pending<'a> {
    position: usize,
    render: Render<'a>,
    stage: Option<Arc<Dispatch>>,
    observed: bool,
}

/// A dispatch release admits another sidecar-stage owner before the document ends.
pub(crate) enum Event {
    Handoff,
    Completed(usize, Result<Vec<Warning>>),
}

/// At most `limit` current-pass owners before handoff. Shared stages bound completion.
/// Superseded unsignalled jobs retain their original workers and sidecar claims.
pub(crate) struct Window<'a> {
    limit: usize,
    renders: Vec<Pending<'a>>,
    held: BTreeMap<usize, Result<Vec<Warning>>>,
    settled: Vec<bool>,
    next_report: usize,
}

impl<'a> Window<'a> {
    /// An empty window; a zero limit admits one render.
    pub(crate) fn new(limit: usize, routes: usize) -> Self {
        Self {
            limit: limit.max(1),
            renders: Vec::new(),
            held: BTreeMap::new(),
            settled: vec![false; routes],
            next_report: 0,
        }
    }

    /// Whether another sidecar-stage owner can start.
    pub(crate) fn has_room(&self) -> bool {
        self.renders
            .iter()
            .filter(|pending| {
                !pending
                    .stage
                    .as_ref()
                    .is_some_and(|stage| stage.handed_off())
            })
            .count()
            < self.limit
    }

    /// Whether every started render has ended.
    pub(crate) fn is_empty(&self) -> bool {
        self.renders.is_empty()
    }

    /// Queue the render in start order and keep its position for catalogue-ordered reports.
    pub(crate) fn start_dispatched(
        &mut self,
        position: usize,
        render: Render<'a>,
        stage: Arc<Dispatch>,
    ) {
        stage.queue_bytes(
            mem::size_of_val(render.as_ref().get_ref()) + 4 * mem::size_of::<Pending<'_>>(),
        );
        self.renders.push(Pending {
            position,
            render,
            stage: Some(stage),
            observed: false,
        });
    }

    /// Start an ordinary render that retains its window place until completion.
    #[cfg(test)]
    pub(crate) fn start(&mut self, position: usize, render: Render<'a>) {
        self.renders.push(Pending {
            position,
            render,
            stage: None,
            observed: false,
        });
    }

    #[cfg(test)]
    pub(crate) async fn next(&mut self) -> (usize, Result<Vec<Warning>>) {
        loop {
            if let Event::Completed(position, result) = self.next_event().await {
                return (position, result);
            }
        }
    }

    /// Wait for the first render to end. Polling in start order lets the earliest
    /// queued render take a free worker first.
    pub(crate) async fn next_event(&mut self) -> Event {
        poll_fn(|context| {
            for index in 0..self.renders.len() {
                let pending = &mut self.renders[index];
                if let Some(stage) = &pending.stage {
                    stage.register(context.waker());
                }
                if !pending.observed
                    && pending
                        .stage
                        .as_ref()
                        .is_some_and(|stage| stage.handed_off())
                {
                    pending.observed = true;
                    return Poll::Ready(Event::Handoff);
                }
                if let Poll::Ready(result) = pending.render.as_mut().poll(context) {
                    let pending = self.renders.remove(index);
                    self.renders.shrink_to(self.limit.saturating_mul(2));
                    return Poll::Ready(Event::Completed(pending.position, result));
                }
            }
            Poll::Pending
        })
        .await
    }

    /// Release reports only when all earlier catalogue positions have settled, including
    /// positions that start later and views with already-published evidence.
    pub(crate) fn settle(
        &mut self,
        position: usize,
        result: Result<Vec<Warning>>,
    ) -> Vec<Result<Vec<Warning>>> {
        if !result.as_ref().is_ok_and(Vec::is_empty) {
            self.held.insert(position, result);
        }
        if let Some(settled) = self.settled.get_mut(position) {
            *settled = true;
        }
        let mut ready = Vec::new();
        while self.settled.get(self.next_report) == Some(&true) {
            if let Some(outcome) = self.held.remove(&self.next_report) {
                ready.push(outcome);
            }
            self.next_report += 1;
        }
        ready
    }
}
