//! Deterministic observation of blob locks acquired by reference-deleting queries.

use std::sync::Arc;
use std::sync::mpsc;
use std::thread;

use chrono::{Duration, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Bool, Text};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::blob::{Blob, PublicationFile};
use mkc_store_interface::error::Result;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationMetadata, PublicationState};
use mkc_store_interface::store::{Callback, Store};
use uuid::Uuid;

use super::fixtures::{Database, database};

#[derive(QueryableByName)]
struct WaitingRow {
    #[diesel(sql_type = Bool)]
    waiting: bool,
}

#[derive(QueryableByName)]
struct LockedHash {
    #[diesel(sql_type = Text)]
    hash: String,
}

struct Fixture {
    project: Project,
    publication: Publication,
    low: BlobKey,
    high: BlobKey,
}

#[test]
fn publication_file_release_locks_referenced_blobs_in_hash_order() {
    let Some(mut db) = database() else { return };
    let fixture = fixture(&db);
    let publication = fixture.publication.id;

    observe_lock_order(
        &mut db,
        (fixture.project.id, &fixture.low),
        (fixture.project.id, &fixture.high),
        move |store| {
            store.transaction(&mut Callback(&mut |queries| {
                queries.delete_publication_files(publication)
            }))
        },
    );
}

#[test]
fn project_deletion_locks_referenced_blobs_in_hash_order() {
    let Some(mut db) = database() else { return };
    let fixture = fixture(&db);
    let project = fixture.project.id;

    observe_lock_order(
        &mut db,
        (fixture.project.id, &fixture.low),
        (fixture.project.id, &fixture.high),
        move |store| {
            store.transaction(&mut Callback(&mut |queries| {
                queries.delete_project(project)
            }))
        },
    );
}

#[test]
fn organization_deletion_locks_by_project_before_hash() {
    let Some(mut db) = database() else { return };
    let fixture = fixture(&db);
    let mut later_project = fixture.project.clone();
    later_project.id = Uuid::from_u128(u128::MAX).into();
    later_project.name = "Later project".into();
    later_project.slug = format!("later-{}", Uuid::now_v7().simple())
        .parse()
        .unwrap();
    later_project.repository = "mokly-ai/later-project".into();
    let mut later_publication = fixture.publication.clone();
    later_publication.id = Uuid::now_v7().into();
    later_publication.project_id = later_project.id;
    later_publication.metadata.as_mut().unwrap().head_sha = "b".repeat(40);
    let later_blob = blob(later_project.id, b"sorts-by-project-not-this-hash");
    db.store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_project(&later_project)?;
            queries.insert_publication(&later_publication)?;
            queries.insert_blob(&later_blob)?;
            queries.insert_publication_file(&file(&later_publication, "later", &later_blob))
        }))
        .unwrap();
    let organization = fixture.project.organization_id;

    observe_lock_order(
        &mut db,
        (fixture.project.id, &fixture.low),
        (later_project.id, &later_blob.key),
        move |store| {
            store.transaction(&mut Callback(&mut |queries| {
                queries.delete_organization(organization)
            }))
        },
    );
}

fn observe_lock_order(
    db: &mut Database,
    first: (mkc_domain::ids::ProjectId, &BlobKey),
    later: (mkc_domain::ids::ProjectId, &BlobKey),
    operation: impl FnOnce(Arc<dyn Store>) -> Result<()> + Send + 'static,
) {
    diesel::sql_query("BEGIN")
        .execute(&mut db.connection)
        .unwrap();
    diesel::sql_query("SET LOCAL lock_timeout = '2s'")
        .execute(&mut db.connection)
        .unwrap();
    let locked = lock_blob(&mut db.connection, first.0, &first.1.hash, false).unwrap();
    assert_eq!(locked[0].hash, first.1.hash.as_str());
    let observer_pid = diesel::select(diesel::dsl::sql::<diesel::sql_types::Integer>(
        "pg_backend_pid()",
    ))
    .get_result::<i32>(&mut db.connection)
    .unwrap();
    let store = db.store.clone();
    let (started, proceed) = mpsc::sync_channel(0);
    let handle = thread::spawn(move || {
        started.send(()).unwrap();
        operation(store)
    });
    proceed.recv().unwrap();

    let waiting = (0..1_000).any(|_| {
        let row = diesel::sql_query(
            "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS waiting",
        )
        .bind::<diesel::sql_types::Integer, _>(observer_pid)
        .get_result::<WaitingRow>(&mut db.connection)
        .unwrap();
        row.waiting
    });
    let later_lock = lock_blob(&mut db.connection, later.0, &later.1.hash, true);
    diesel::sql_query(if later_lock.is_ok() {
        "COMMIT"
    } else {
        "ROLLBACK"
    })
    .execute(&mut db.connection)
    .unwrap();
    let outcome = handle.join().unwrap();

    assert!(
        waiting,
        "operation did not wait on the observer's lowest-hash lock"
    );
    assert!(
        later_lock.is_ok(),
        "operation locked a later project/hash before waiting for the first"
    );
    outcome.unwrap();
}

fn lock_blob(
    connection: &mut PgConnection,
    project: mkc_domain::ids::ProjectId,
    hash: &BlobHash,
    nowait: bool,
) -> QueryResult<Vec<LockedHash>> {
    let suffix = if nowait { " NOWAIT" } else { "" };
    diesel::sql_query(format!(
        "SELECT hash FROM blobs WHERE project_id = $1 AND hash = $2 FOR UPDATE{suffix}"
    ))
    .bind::<diesel::sql_types::Uuid, _>(project.0)
    .bind::<Text, _>(hash.as_str())
    .load(connection)
}

fn fixture(db: &Database) -> Fixture {
    let now = Utc::now();
    let organization = Organization {
        id: Uuid::now_v7().into(),
        name: "Lock order".into(),
        slug: format!("o-{}", Uuid::now_v7().simple()).parse().unwrap(),
        version: 1,
        created_at: now,
        plan: Plan::Free,
    };
    let project = Project {
        id: Uuid::now_v7().into(),
        organization_id: organization.id,
        name: "Lock order".into(),
        slug: format!("p-{}", Uuid::now_v7().simple()).parse().unwrap(),
        repository: "mokly-ai/mokly-cloud".into(),
        config_path: "mokly.config.ts".into(),
        visibility: Visibility::Private,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    };
    let publication = Publication {
        id: Uuid::now_v7().into(),
        project_id: project.id,
        metadata: Some(PublicationMetadata {
            branch: "lock-order".into(),
            head_sha: "a".repeat(40),
            base_ref: None,
            base_sha: None,
            pull_request: None,
            config_path: project.config_path.clone(),
            exported_at: now,
        }),
        state: PublicationState::Validating,
        failure: None,
        changes: None,
        created_at: now,
        deadline: now + Duration::minutes(15),
        expired_at: None,
        build_id: None,
        build_failure_event_id: None,
    };
    let mut blobs = [
        blob(project.id, b"lock-order-first"),
        blob(project.id, b"lock-order-second"),
    ];
    blobs.sort_by(|left, right| left.key.hash.cmp(&right.key.hash));
    let low = blobs[0].clone();
    let high = blobs[1].clone();
    db.store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_organization(&organization)?;
            queries.insert_project(&project)?;
            queries.insert_publication(&publication)?;
            queries.insert_blob(&high)?;
            queries.insert_blob(&low)?;
            queries.insert_publication_file(&file(&publication, "a-high", &high))?;
            queries.insert_publication_file(&file(&publication, "z-low", &low))
        }))
        .unwrap();
    Fixture {
        project,
        publication,
        low: low.key,
        high: high.key,
    }
}

fn blob(project_id: mkc_domain::ids::ProjectId, bytes: &[u8]) -> Blob {
    Blob {
        project_id,
        key: BlobKey {
            hash: BlobHash::digest(bytes),
            incarnation: Uuid::now_v7(),
        },
        size: bytes.len() as i64,
        content_type: "application/octet-stream".into(),
        ref_count: 0,
        deleting: false,
        unreferenced_at: Some(Utc::now()),
        stored_at: None,
    }
}

fn file(publication: &Publication, path: &str, blob: &Blob) -> PublicationFile {
    PublicationFile {
        publication_id: publication.id,
        project_id: publication.project_id,
        path: path.into(),
        key: blob.key.clone(),
        content_type: blob.content_type.clone(),
        size: blob.size,
    }
}
