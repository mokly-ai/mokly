//! Event streams flush their terminating chunk before other connections are aborted.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use async_trait::async_trait;
use axum::Router;
use hyper::Request;
use hyper::body::Incoming;
use hyper::http::Method;
use hyper::server::conn::http1;
use hyper::service::{Service, service_fn};
use hyper_util::rt::TokioIo;
use hyper_util::service::TowerToHyperService;
use tokio::net::TcpStream;
use tokio::sync::watch;
use tokio::task::{Id, JoinSet};

/// Connection ownership stays within the local transport.
#[async_trait]
pub(crate) trait Clients: Send {
    /// Admit one socket and track whether it delivers an event stream.
    fn admit(&mut self, stream: TcpStream, router: Router);
    /// Whether there is a connection left to reap.
    fn is_empty(&self) -> bool;
    /// Reap one completed connection and its tracking data.
    async fn completed(&mut self);
    /// Drain event streams with one bounded grace period, then abort other clients.
    async fn shutdown(&mut self);
}

struct Peer {
    events: Arc<AtomicBool>,
    drain: watch::Sender<bool>,
    done: watch::Receiver<bool>,
}

/// Hyper connections resolve only after their response bytes have been flushed.
#[derive(Default)]
pub(crate) struct HttpClients {
    tasks: JoinSet<()>,
    peers: HashMap<Id, Peer>,
}

#[async_trait]
impl Clients for HttpClients {
    fn admit(&mut self, stream: TcpStream, router: Router) {
        let (drain, mut draining) = watch::channel(false);
        let (done, completed) = watch::channel(false);
        let events = Arc::new(AtomicBool::new(false));
        let observed = events.clone();
        let service = TowerToHyperService::new(router);
        let service = service_fn(move |request: Request<Incoming>| {
            let get = request.method() == Method::GET;
            let response = service.call(request);
            let observed = observed.clone();
            async move {
                let response = response.await;
                if get
                    && let Ok(response) = &response
                    && response
                        .headers()
                        .get("content-type")
                        .is_some_and(|value| value == "text/event-stream")
                {
                    observed.store(true, Ordering::Release);
                }
                response
            }
        });
        let task = self.tasks.spawn(async move {
            let connection = http1::Builder::new().serve_connection(TokioIo::new(stream), service);
            tokio::pin!(connection);
            let result = tokio::select! {
                result = &mut connection => result,
                _ = draining.changed() => {
                    connection.as_mut().graceful_shutdown();
                    connection.await
                },
            };
            if let Err(error) = result {
                tracing::debug!(%error, "client closed");
            }
            done.send_replace(true);
        });
        self.peers.insert(
            task.id(),
            Peer {
                events,
                drain,
                done: completed,
            },
        );
    }

    fn is_empty(&self) -> bool {
        self.tasks.is_empty()
    }

    async fn completed(&mut self) {
        let id = match self.tasks.join_next_with_id().await {
            Some(Ok((id, ()))) => id,
            Some(Err(error)) => error.id(),
            None => return,
        };
        self.peers.remove(&id);
    }

    async fn shutdown(&mut self) {
        let streams: Vec<_> = self
            .peers
            .values()
            .filter(|peer| peer.events.load(Ordering::Acquire))
            .map(|peer| {
                peer.drain.send_replace(true);
                peer.done.clone()
            })
            .collect();
        if !streams.is_empty() {
            let closing = async {
                for mut done in streams {
                    while !*done.borrow() {
                        if done.changed().await.is_err() {
                            break;
                        }
                    }
                }
            };
            let _ = tokio::time::timeout(Duration::from_millis(250), closing).await;
        }
        self.tasks.abort_all();
        while self.tasks.join_next().await.is_some() {}
        self.peers.clear();
    }
}

#[cfg(test)]
#[path = "_tests_/clients_tests.rs"]
mod clients_tests;
