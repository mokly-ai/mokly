//! A sliding window of background renders that start and report in catalogue order.

use std::collections::BTreeMap;
use std::future::{Future, poll_fn};
use std::pin::Pin;
use std::task::Poll;

use crate::error::{Result, ServerError};

/// One pending background render.
pub(crate) type Render<'a> = Pin<Box<dyn Future<Output = Result<()>> + Send + 'a>>;

/// At most `limit` renders in flight, kept in start order with their catalogue positions.
pub(crate) struct Window<'a> {
    limit: usize,
    renders: Vec<(usize, Render<'a>)>,
    failures: BTreeMap<usize, ServerError>,
}

impl<'a> Window<'a> {
    /// An empty window; a zero limit admits one render.
    pub(crate) fn new(limit: usize) -> Self {
        Self {
            limit: limit.max(1),
            renders: Vec::new(),
            failures: BTreeMap::new(),
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
    pub(crate) async fn next(&mut self) -> (usize, Result<()>) {
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

    /// Hold a failure until every earlier render has ended, then release the held
    /// failures in catalogue order.
    pub(crate) fn settle(&mut self, position: usize, result: Result<()>) -> Vec<ServerError> {
        if let Err(error) = result {
            self.failures.insert(position, error);
        }
        let earliest = self
            .renders
            .first()
            .map_or(usize::MAX, |(position, _)| *position);
        let mut ready = Vec::new();
        while let Some(entry) = self.failures.first_entry()
            && *entry.key() < earliest
        {
            ready.push(entry.remove());
        }
        ready
    }
}
