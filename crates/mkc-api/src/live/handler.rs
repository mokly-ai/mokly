//! Route upgrades and track the upgraded sockets through server shutdown.

use std::collections::HashMap;
use std::future::Future;
use std::num::NonZeroUsize;
use std::pin::Pin;
use std::sync::Arc;

use axum::extract::ws::WebSocketUpgrade;
use axum::extract::{FromRequestParts, Request};
use axum::response::Response;
use mkc_domain::ids::ProjectId;
use mkc_live::hub::{LiveHub, ReplicaHub};
use mkc_live::limits::MAX_CLIENT_MESSAGE_BYTES;
use mkc_live_interface::relay::{LiveRelay, ReplicaId};
use mkc_live_pg::relay::PostgresRelay;
use tokio_util::sync::CancellationToken;
use tokio_util::task::TaskTracker;
use uuid::Uuid;

use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::live_clock::LiveClock;
use crate::{request_headers, response};

use super::access::SocketAccess;
use super::socket::Socket;

const OUTBOUND_CAPACITY: usize = 256;

#[cfg_attr(test, unimock::unimock(api = [LiveHandlerMock]))]
pub(crate) trait LiveHandler: Send + Sync {
    fn handle(
        &self,
        params: HashMap<String, String>,
        request: Request,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + '_>>;
}

pub(crate) struct LiveComposition {
    pub(crate) access: Arc<dyn SocketAccess>,
    pub(crate) clock: Arc<dyn LiveClock>,
    pub(crate) relay: Option<Arc<dyn LiveRelay + Send + Sync>>,
}

impl LiveComposition {
    pub(crate) async fn start(&self, database_url: &str) -> Result<Arc<LiveServer>> {
        let capacity = NonZeroUsize::new(OUTBOUND_CAPACITY)
            .ok_or_else(|| ApiError::internal_message("live outbound queue capacity is zero"))?;
        let relay: Arc<dyn LiveRelay + Send + Sync> = match &self.relay {
            Some(relay) => relay.clone(),
            None => Arc::new(
                PostgresRelay::connect(database_url)
                    .await
                    .context("connect live relay")?,
            ),
        };
        let hub = ReplicaHub::start(ReplicaId(Uuid::now_v7()), relay, &[], capacity)
            .context("start live hub")?;
        Ok(Arc::new(LiveServer {
            access: self.access.clone(),
            clock: self.clock.clone(),
            hub: Arc::new(hub),
            stopping: CancellationToken::new(),
            sockets: TaskTracker::new(),
        }))
    }
}

pub(crate) struct LiveServer {
    access: Arc<dyn SocketAccess>,
    clock: Arc<dyn LiveClock>,
    hub: Arc<dyn LiveHub>,
    stopping: CancellationToken,
    sockets: TaskTracker,
}

impl LiveServer {
    pub(crate) fn shutdown(&self) {
        self.hub.shutdown();
        self.stopping.cancel();
        self.sockets.close();
    }

    pub(crate) async fn wait(&self) {
        self.sockets.wait().await;
    }

    async fn upgrade(&self, params: HashMap<String, String>, request: Request) -> Result<Response> {
        let (mut parts, _) = request.into_parts();
        let upgrade = match WebSocketUpgrade::from_request_parts(&mut parts, &()).await {
            Ok(upgrade) => upgrade,
            Err(_) => return Err(ApiError::ValidationFailed),
        };
        let project = params
            .get("projectId")
            .and_then(|id| id.parse().ok())
            .map(ProjectId)
            .ok_or(ApiError::ValidationFailed)?;
        let origin = request_headers::text(&parts.headers, "origin").map(str::to_owned);
        let credential = request_headers::session_credential(&parts.headers).map(str::to_owned);
        let access = self.access.clone();
        let session = tokio::task::spawn_blocking(move || {
            access.open(project, origin.as_deref(), credential.as_deref())
        })
        .await
        .context("authorize live socket")??;
        let token = self.sockets.token();
        let connection = self
            .hub
            .register(project, session.user)
            .context("register live socket")?;
        let socket = Socket {
            session: Arc::new(session),
            access: self.access.clone(),
            clock: self.clock.clone(),
            stopping: self.stopping.clone(),
        };
        Ok(upgrade
            .max_frame_size(MAX_CLIENT_MESSAGE_BYTES)
            .max_message_size(MAX_CLIENT_MESSAGE_BYTES)
            .on_upgrade(move |stream| async move {
                let _token = token;
                socket.serve(stream, connection).await;
            }))
    }
}

impl LiveHandler for LiveServer {
    fn handle(
        &self,
        params: HashMap<String, String>,
        request: Request,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        Box::pin(async move {
            match self.upgrade(params, request).await {
                Ok(response) => response,
                Err(error) => response::failure(error),
            }
        })
    }
}

impl Drop for LiveServer {
    fn drop(&mut self) {
        self.shutdown();
    }
}
