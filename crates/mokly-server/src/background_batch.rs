//! A sliding window of background renders that start and report in catalogue order.

use std::collections::BTreeMap;
use std::future::{Future, poll_fn};
use std::pin::Pin;
use std::task::Poll;

use mokly_catalogue::diagnostic::Warning;

use crate::error::Result;

/// One pending background render; it ends with its unreported warnings or a failure.
pub(crate) type Render<'a> = Pin<Box<dyn Future<Output = Result<Vec<Warning>>> + Send + 'a>>;

/// At most `limit` renders in flight, kept in start order with their catalogue positions.
pub(crate) struct Window<'a> {
    limit: usize,
    renders: Vec<(usize, Render<'a>)>,
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

    /// Whether another render can start.
    pub(crate) fn has_room(&self) -> bool {
        self.renders.len() < self.limit
    }

    /// Whether every started render has ended.
    pub(crate) fn is_empty(&self) -> bool {
        self.renders.is_empty()
    }

    /// Start the render at a catalogue position after every position already started.
    pub(crate) fn start(&mut self, position: usize, render: Render<'a>) {
        self.renders.push((position, render));
    }

    /// Wait for the first render to end. Polling in start order lets the earliest
    /// queued render take a free worker first.
    pub(crate) async fn next(&mut self) -> (usize, Result<Vec<Warning>>) {
        poll_fn(|context| {
            for index in 0..self.renders.len() {
                if let Poll::Ready(result) = self.renders[index].1.as_mut().poll(context) {
                    let (position, _) = self.renders.remove(index);
                    return Poll::Ready((position, result));
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
            .map_or(usize::MAX, |(position, _)| *position);
        let mut ready = Vec::new();
        while let Some(entry) = self.held.first_entry()
            && *entry.key() < earliest
        {
            ready.push(entry.remove());
        }
        ready
    }
}
