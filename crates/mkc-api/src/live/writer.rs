//! Flush one staged frame while the socket can still read and enforce deadlines.

use std::future::poll_fn;
use std::pin::Pin;
use std::task::{Poll, ready};
use std::time::Duration;

use axum::extract::ws::{CloseFrame, Message, WebSocket};
use futures_util::Sink;
use futures_util::stream::SplitSink;
use tokio::time::timeout;

const CLOSE_WRITE_TIMEOUT: Duration = Duration::from_secs(1);

pub(super) struct Writer {
    sink: SplitSink<WebSocket, Message>,
    pending: Option<Message>,
    busy: bool,
}

impl Writer {
    pub(super) fn new(sink: SplitSink<WebSocket, Message>) -> Self {
        Self {
            sink,
            pending: None,
            busy: false,
        }
    }

    pub(super) fn busy(&self) -> bool {
        self.busy
    }

    pub(super) fn stage(&mut self, message: Message) {
        self.pending = Some(message);
        self.busy = true;
    }

    /// Keep the staged frame until the sink accepts it, even if another branch wins.
    pub(super) async fn flush(&mut self) -> Result<(), axum::Error> {
        poll_fn(|cx| {
            let mut sink = Pin::new(&mut self.sink);
            if self.pending.is_some() {
                ready!(sink.as_mut().poll_ready(cx))?;
                if let Some(message) = self.pending.take() {
                    sink.as_mut().start_send(message)?;
                }
            }
            ready!(sink.poll_flush(cx))?;
            self.busy = false;
            Poll::Ready(Ok(()))
        })
        .await
    }

    /// Flush the Close reply or code without waiting indefinitely for a blocked peer.
    pub(super) async fn finish(&mut self, code: Option<u16>) {
        self.pending = code.map(|code| {
            Message::Close(Some(CloseFrame {
                code,
                reason: "".into(),
            }))
        });
        let _ = timeout(CLOSE_WRITE_TIMEOUT, self.flush()).await;
    }
}
