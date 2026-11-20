//! Demand-started idle timeout for asynchronous provider streams.

use std::io;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Duration;

use futures_util::Stream;
use thiserror::Error;
use tokio::time::{Sleep, sleep};

/// The provider sent nothing for a whole idle period while the stream was polled.
#[derive(Debug, Error)]
#[error("[mkc-file-store-gcs/idle-timeout] provider media stream stayed idle")]
struct ProviderStreamIdle;

/// Arms the timer only after the provider returns pending, polls the provider
/// before the timer on every wake and disarms it on each item, so time the
/// consumer spends not polling never counts as provider idle. Expiry yields
/// one timeout error and ends the stream.
pub(crate) struct IdleTimeout<S> {
    inner: Pin<Box<S>>,
    duration: Duration,
    timer: Option<Pin<Box<Sleep>>>,
    ended: bool,
}

impl<S> IdleTimeout<S> {
    pub(crate) fn new(inner: S, duration: Duration) -> Self {
        Self {
            inner: Box::pin(inner),
            duration,
            timer: None,
            ended: false,
        }
    }
}

impl<S, T> Stream for IdleTimeout<S>
where
    S: Stream<Item = io::Result<T>>,
{
    type Item = io::Result<T>;

    fn poll_next(self: Pin<&mut Self>, context: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.get_mut();
        if this.ended {
            return Poll::Ready(None);
        }
        match this.inner.as_mut().poll_next(context) {
            Poll::Ready(item) => {
                this.timer = None;
                if item.is_none() {
                    this.ended = true;
                }
                return Poll::Ready(item);
            }
            Poll::Pending => {}
        }
        let timer = this
            .timer
            .get_or_insert_with(|| Box::pin(sleep(this.duration)));
        match timer.as_mut().poll(context) {
            Poll::Ready(()) => {
                this.timer = None;
                this.ended = true;
                Poll::Ready(Some(Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    ProviderStreamIdle,
                ))))
            }
            Poll::Pending => Poll::Pending,
        }
    }
}

#[cfg(test)]
#[path = "_tests_/idle_timeout_tests.rs"]
mod tests;
