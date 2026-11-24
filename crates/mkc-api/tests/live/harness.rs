//! A single live replica with a bound listener and an injectable shutdown.

use std::net::SocketAddr;
use std::sync::Arc;

use futures_util::{Stream, StreamExt};
use mkc_api::application::{ApplicationFactory, ConfiguredApplicationFactory};
use mkc_auth::runtime::Runtime;
use mkc_domain::ids::ProjectId;
use mkc_live::memory::MemoryRelay;
use mkc_live_interface::messages::Notice;
use mkc_live_interface::relay::ProjectNotice;
use mkc_store_interface::store::{Callback, Store};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use serde_json::{Value, json};
use tempfile::TempDir;
use tokio::net::TcpStream;
use tokio::runtime::Builder;
use tokio::sync::oneshot;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};
use tokio_util::sync::CancellationToken;
use tungstenite::Message;
use tungstenite::client::IntoClientRequest;
use tungstenite::handshake::client::Request;
use uuid::Uuid;

use crate::test_server::{BoundListener, ServerThread};

use super::clock::Clock;
use super::fixtures::{ORIGIN, seed, settings};

pub(super) struct Harness {
    _server: ServerThread,
    pub(super) address: SocketAddr,
    pub(super) clock: Arc<Clock>,
    pub(super) relay: Arc<MemoryRelay>,
    pub(super) store: Arc<dyn Store>,
    pub(super) stop: CancellationToken,
    pub(super) finished: oneshot::Receiver<()>,
    _files: TempDir,
    _schema: ScratchSchema,
}

impl Harness {
    pub(super) fn start() -> Option<Self> {
        let schema = ScratchSchema::create("live_api")?;
        let listener = BoundListener::bind();
        let address = listener.address;
        let files = tempfile::tempdir().unwrap();
        let relay = Arc::new(MemoryRelay::default());
        let clock = Arc::new(Clock::new());
        let app = ConfiguredApplicationFactory {
            runtime: clock.clone(),
            live_relay: Some(relay.clone()),
            live_clock: clock.clone(),
            ..Default::default()
        }
        .create(settings(schema.scoped_url(), address, files.path()))
        .unwrap();
        let store = PgStoreFactory {
            runtime: Arc::new(SystemRuntime),
        }
        .connect(schema.scoped_url())
        .unwrap();
        store
            .transaction(&mut Callback(&mut |queries| {
                seed(queries, Runtime::now(clock.as_ref()))
            }))
            .unwrap();
        let stop = CancellationToken::new();
        let signal = stop.clone();
        let drop_signal = stop.clone();
        let (done, finished) = oneshot::channel();
        let server = ServerThread::spawn(
            "live API",
            move || drop_signal.cancel(),
            move || {
                let runtime = Builder::new_current_thread().enable_all().build().unwrap();
                runtime.block_on(async move {
                    app.serve_on_until(listener.into_tokio(), Box::pin(signal.cancelled_owned()))
                        .await
                        .unwrap();
                    let _ = done.send(());
                });
            },
        );
        Some(Self {
            _server: server,
            address,
            clock,
            relay,
            store,
            stop,
            finished,
            _files: files,
            _schema: schema,
        })
    }

    pub(super) fn request(&self, project: &str, origin: &str, credential: Option<&str>) -> Request {
        let mut request = format!("ws://{}/v1/live/projects/{project}", self.address)
            .into_client_request()
            .unwrap();
        let headers = request.headers_mut();
        headers.insert("origin", origin.parse().unwrap());
        headers.insert("x-request-id", "live-test".parse().unwrap());
        if let Some(credential) = credential {
            headers.insert(
                "cookie",
                format!("other=fixture; mkc_session={credential}")
                    .parse()
                    .unwrap(),
            );
        }
        request
    }

    pub(super) async fn open(
        &self,
        project: ProjectId,
        credential: &str,
    ) -> WebSocketStream<MaybeTlsStream<TcpStream>> {
        let (socket, response) =
            connect_async(self.request(&project.to_string(), ORIGIN, Some(credential)))
                .await
                .unwrap();
        assert_eq!(response.status(), 101);
        socket
    }

    pub(super) fn notice(&self, project: ProjectId) {
        self.relay.inject_notice(ProjectNotice {
            project,
            notice: Notice {
                kind: "build".into(),
                id: Uuid::from_u128(8),
                sequence: 12,
            },
        });
    }
}

pub(super) async fn receive(
    socket: &mut (impl Stream<Item = tungstenite::Result<Message>> + Unpin),
) -> Message {
    socket.next().await.unwrap().unwrap()
}

pub(super) async fn assert_notice(
    socket: &mut (impl Stream<Item = tungstenite::Result<Message>> + Unpin),
) {
    let frame = receive(socket).await;
    let Message::Text(text) = frame else {
        panic!("expected a text notice, got {frame:?}");
    };
    let body: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(
        body,
        json!({
            "type": "notice",
            "kind": "build",
            "id": "00000000-0000-0000-0000-000000000008",
            "sequence": 12
        })
    );
}
