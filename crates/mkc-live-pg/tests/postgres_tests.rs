//! Two replica hubs and listener recovery on an isolated Postgres schema.

#![allow(clippy::unwrap_used, clippy::panic)]

use std::collections::BTreeMap;
use std::num::NonZeroUsize;
use std::sync::Arc;

use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::ids::ProjectId;
use mkc_live::connection::{ClientEventKind, Connection};
use mkc_live::hub::{LiveHub, ReplicaHub};
use mkc_live::outbound::Outbound;
use mkc_live_interface::messages::{ClientEvent, Notice, ServerMessage, ServerSignal};
use mkc_live_interface::relay::{
    InboundEvent, LiveRelay, ProjectNotice, RelayMessage, ReplicaId, TickBatch,
};
use mkc_live_pg::relay::PostgresRelay;
use mkc_test_pg::scratch_schema::ScratchSchema;
use serde_json::json;
use tokio::sync::broadcast;
use tokio::task::JoinHandle;
use tokio_postgres::{Client, NoTls, Transaction};
use uuid::Uuid;

const TEST_KIND: &str = "test-event";

#[tokio::test(start_paused = true)]
async fn two_hubs_receive_committed_notices_and_every_split_event() {
    let Some(schema) = ScratchSchema::create("live_replicas") else {
        return;
    };
    DieselMigrations.migrate(schema.scoped_url()).unwrap();
    let mut database = Database::connect(schema.scoped_url()).await;
    let first = hub(schema.scoped_url()).await;
    let second = hub(schema.scoped_url()).await;
    let project = ProjectId(Uuid::now_v7());
    let user = Uuid::now_v7().into();
    let mut source = first.register(project, user).unwrap();
    let mut remote = second.register(project, user).unwrap();
    let id = Uuid::now_v7();

    let transaction = database.client.transaction().await.unwrap();
    notice(&transaction, project, id, 10).await;
    transaction.rollback().await.unwrap();
    let transaction = database.client.transaction().await.unwrap();
    notice(&transaction, project, id, 11).await;
    transaction.commit().await.unwrap();
    let expected = ServerMessage::Signal(ServerSignal::Notice(Notice {
        kind: "build".into(),
        id,
        sequence: 11,
    }));
    assert_eq!(receive(&mut source).await, expected);
    assert_eq!(receive(&mut remote).await, expected);

    let repeated = json!({"type": TEST_KIND, "value": "é".repeat(1_990)});
    let last = json!({"type": TEST_KIND, "value": "b".repeat(3_990)});
    for value in [&repeated, &repeated, &last] {
        source.submit_text(&value.to_string()).unwrap();
    }
    for value in [&repeated, &repeated, &last] {
        assert_eq!(
            serde_json::to_value(receive(&mut remote).await).unwrap(),
            *value
        );
    }
}

#[tokio::test(start_paused = true)]
async fn a_listener_reconnect_reports_a_gap_and_restores_both_subscriptions() {
    let Some(schema) = ScratchSchema::create("live_reconnect") else {
        return;
    };
    DieselMigrations.migrate(schema.scoped_url()).unwrap();
    let mut database = Database::connect(schema.scoped_url()).await;
    let application = schema.name();
    let scoped = format!("{}&application_name={application}", schema.scoped_url());
    let relay = PostgresRelay::connect(&scoped).await.unwrap();
    let mut inbound = relay.subscribe();
    let row = database.client.query_one(
        "SELECT pid FROM pg_stat_activity WHERE application_name = $1 AND query LIKE 'LISTEN %'",
        &[&application],
    ).await.unwrap();
    let listener: i32 = row.get("pid");
    let terminated: bool = database
        .client
        .query_one("SELECT pg_terminate_backend($1)", &[&listener])
        .await
        .unwrap()
        .get(0);
    assert!(terminated);

    let project = ProjectId(Uuid::now_v7());
    assert_eq!(
        receive_project(&mut inbound, project).await,
        InboundEvent::Gap
    );
    let id = Uuid::now_v7();
    let transaction = database.client.transaction().await.unwrap();
    notice(&transaction, project, id, 12).await;
    transaction.commit().await.unwrap();
    assert_eq!(
        receive_project(&mut inbound, project).await,
        InboundEvent::Notice(ProjectNotice {
            project,
            notice: Notice {
                kind: "build".into(),
                id,
                sequence: 12
            },
        }),
    );

    let replica = ReplicaId(Uuid::now_v7());
    let event: ClientEvent =
        serde_json::from_value(json!({"type": TEST_KIND, "value": 15})).unwrap();
    relay
        .publish(TickBatch {
            replica,
            projects: BTreeMap::from([(project, vec![event.clone()])]),
        })
        .unwrap();
    assert_eq!(
        receive_project(&mut inbound, project).await,
        InboundEvent::Relay(RelayMessage {
            replica,
            project,
            events: vec![event],
        }),
    );
}

async fn hub(url: &str) -> ReplicaHub {
    let relay = Arc::new(PostgresRelay::connect(url).await.unwrap());
    ReplicaHub::start(
        ReplicaId(Uuid::now_v7()),
        relay,
        &[ClientEventKind {
            name: TEST_KIND,
            coalesce_key: None,
        }],
        NonZeroUsize::new(8).unwrap(),
    )
    .unwrap()
}

async fn notice(transaction: &Transaction<'_>, project: ProjectId, id: Uuid, sequence: i64) {
    transaction
        .execute(
            "SELECT mkc_live_notice($1, $2, $3, $4)",
            &[&project.0, &"build", &id, &sequence],
        )
        .await
        .unwrap();
}

async fn receive(connection: &mut Connection) -> ServerMessage {
    let Some(Outbound::Message(message)) = connection.recv().await else {
        panic!("expected a message on a live socket");
    };
    message.as_ref().clone()
}

async fn receive_project(
    inbound: &mut broadcast::Receiver<InboundEvent>,
    project: ProjectId,
) -> InboundEvent {
    loop {
        let event = inbound.recv().await.unwrap();
        match &event {
            InboundEvent::Notice(notice) if notice.project == project => return event,
            InboundEvent::Relay(relay) if relay.project == project => return event,
            InboundEvent::Gap => return event,
            _ => {}
        }
    }
}

struct Database {
    client: Client,
    driver: JoinHandle<()>,
}

impl Database {
    async fn connect(url: &str) -> Self {
        let (client, connection) = tokio_postgres::connect(url, NoTls).await.unwrap();
        let driver = tokio::spawn(async move { connection.await.unwrap() });
        Self { client, driver }
    }
}

impl Drop for Database {
    fn drop(&mut self) {
        self.driver.abort();
    }
}
