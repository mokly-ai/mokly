//! Committed build and build-log notices reach the Postgres listener.

use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::ids::ProjectId;
use mkc_live_interface::messages::Notice;
use mkc_live_interface::relay::{InboundEvent, LiveRelay};
use mkc_live_pg::relay::PostgresRelay;
use mkc_test_pg::scratch_schema::ScratchSchema;
use tokio_postgres::Client;
use uuid::Uuid;

use super::{Database, notice, receive_project};

#[tokio::test]
async fn committed_visible_build_changes_and_log_chunks_send_notices() {
    let Some(schema) = ScratchSchema::create("build_notices") else {
        return;
    };
    DieselMigrations.migrate(schema.scoped_url()).unwrap();
    let relay = PostgresRelay::connect(schema.scoped_url()).await.unwrap();
    let mut inbound = relay.subscribe();
    let mut database = Database::connect(schema.scoped_url()).await;
    let project = ProjectId(Uuid::now_v7());
    let build = Uuid::now_v7();

    insert_build(&database.client, project, build).await;
    database
        .client
        .execute(
            "UPDATE builds SET lease_token = gen_random_uuid(),
                lease_expires_at = lease_expires_at + interval '10 seconds'
            WHERE id = $1",
            &[&build],
        )
        .await
        .unwrap();
    append_log(&mut database.client, build).await;
    database
        .client
        .execute(
            "UPDATE builds SET step = 'publish' WHERE id = $1",
            &[&build],
        )
        .await
        .unwrap();

    let rollback = database.client.transaction().await.unwrap();
    rollback
        .execute("UPDATE builds SET step = NULL WHERE id = $1", &[&build])
        .await
        .unwrap();
    rollback.rollback().await.unwrap();

    database
        .client
        .execute(
            "UPDATE builds SET log_complete = true WHERE id = $1",
            &[&build],
        )
        .await
        .unwrap();

    let fence = Uuid::now_v7();
    let transaction = database.client.transaction().await.unwrap();
    notice(&transaction, project, fence, 0).await;
    transaction.commit().await.unwrap();

    let mut actual = Vec::new();
    loop {
        let InboundEvent::Notice(event) = receive_project(&mut inbound, project).await else {
            panic!("expected a project notice");
        };
        if event.notice.id == fence {
            break;
        }
        actual.push(event.notice);
    }
    assert_eq!(
        actual,
        vec![
            Notice {
                kind: "build".into(),
                id: build,
                sequence: 0,
            },
            Notice {
                kind: "build-log".into(),
                id: build,
                sequence: 1,
            },
            Notice {
                kind: "build".into(),
                id: build,
                sequence: 1,
            },
            Notice {
                kind: "build".into(),
                id: build,
                sequence: 1,
            },
        ]
    );
}

async fn insert_build(client: &Client, project: ProjectId, build: Uuid) {
    client
        .execute(
            "WITH workspace AS (
                INSERT INTO organizations (id, name, slug, version, created_at)
                VALUES (gen_random_uuid(), 'Build notices', 'build-notices', 1, now())
                RETURNING id, slug
            ), workspace_slug AS (
                INSERT INTO organization_slugs (slug, organization_id)
                SELECT slug, id FROM workspace
            ), project AS (
                INSERT INTO projects
                    (id, organization_id, name, slug, repository, config_path, visibility, version)
                SELECT $1, id, 'Build notices', 'build-notices', 'test/notices',
                    'mokly.config.json', 'private', 1 FROM workspace
                RETURNING id, organization_id, slug
            ), project_slug AS (
                INSERT INTO project_slugs (organization_id, slug, project_id)
                SELECT organization_id, slug, id FROM project
            ), installation AS (
                INSERT INTO github_installations
                    (id, github_id, app_id, organization_id, account_id, account_name,
                    account_kind, manage_url, active, connected, updated_at)
                SELECT gen_random_uuid(), 1, 1, id, 1, 'test', 'organization',
                    'https://github.com/settings/installations/1', true, true, now() FROM workspace
                RETURNING id
            ), repository AS (
                INSERT INTO github_repositories
                    (id, installation_id, github_id, full_name, default_branch, private, active)
                SELECT gen_random_uuid(), id, 1, 'test/notices', 'main', true, true FROM installation
                RETURNING id
            )
            INSERT INTO builds
                (id, project_id, repository_id, trigger, branch, head_sha, config_path,
                state, step, attempt, next_attempt_at, attempt_operation_id, lease_token,
                lease_expires_at, deadline_at, created_at, started_at)
            SELECT $2, project.id, repository.id, 'request', 'main', repeat('a', 40),
                'mokly.config.json', 'running', 'install', 1, now(), gen_random_uuid(),
                gen_random_uuid(), now() + interval '1 minute', now() + interval '5 minutes',
                now(), now()
            FROM project CROSS JOIN repository",
            &[&project.0, &build],
        )
        .await
        .unwrap();
}

async fn append_log(client: &mut Client, build: Uuid) {
    let transaction = client.transaction().await.unwrap();
    transaction
        .execute(
            "UPDATE builds SET log_sequence = 1, log_bytes = 4,
                log_head_sequence = 1, log_elided_bytes = 2 WHERE id = $1",
            &[&build],
        )
        .await
        .unwrap();
    transaction
        .execute(
            "INSERT INTO build_log_chunks (build_id, sequence, attempt, step, stream, bytes, created_at)
            VALUES ($1, 1, 1, 'install', 'stdout', 'test'::bytea, now())",
            &[&build],
        )
        .await
        .unwrap();
    transaction.commit().await.unwrap();
}
