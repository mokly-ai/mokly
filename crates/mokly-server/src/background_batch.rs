//! A sliding window of background renders that start and report in catalogue order.

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
}

impl<'a> Window<'a> {
    /// An empty window; a zero limit admits one render.
    pub(crate) fn new(limit: usize) -> Self {
        Self {
            limit: limit.max(1),
            renders: Vec::new(),
            held: BTreeMap::new(),
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

    /// Start the render at a catalogue position after every position already started.
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

    /// Hold an outcome with warnings or a failure until every earlier render has ended,
    /// then release the held outcomes in catalogue order.
    pub(crate) fn settle(
        &mut self,
        position: usize,
        result: Result<Vec<Warning>>,
    ) -> Vec<Result<Vec<Warning>>> {
        if !result.as_ref().is_ok_and(Vec::is_empty) {
            self.held.insert(position, result);
        }
        let earliest = self
            .renders
            .first()
            .map_or(usize::MAX, |pending| pending.position);
        let mut ready = Vec::new();
        while let Some(entry) = self.held.first_entry()
            && *entry.key() < earliest
        {
            ready.push(entry.remove());
        }
        ready
    }
}
