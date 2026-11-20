//! Every publication child table needs an explicit, exercised retention policy.

use std::collections::BTreeMap;
use std::sync::Arc;

use chrono::{Duration, Utc};
use diesel::prelude::*;
use diesel::sql_types::{self, BigInt, Text};
use mkc_auth::runtime::RuntimeMock;
use mkc_domain::ids::PublicationId;
use mkc_mokly_contract::bundle::ENVELOPE_PATH;
use mkc_publications::retention::{PublicationRetention, RetentionWorker};
use mkc_publications::transaction::StoreTransactions;
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::publication_changes::{Changes, Counts};
use mkc_store_interface::publication_event::{CatalogueGrant, EventKind, PublicationEvent};
use mkc_store_interface::publication_screens::{Scheme, ScreenView, Viewport};
use mkc_store_interface::store::Callback;
use mkc_store_interface::user::User;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use super::fixtures::{blob, file, project, publication, store};
use super::retained_build_fixture;

const RETENTION: [(&str, bool); 5] = [
    ("builds", true),
    ("catalogue_grants", false),
    ("publication_events", true),
    ("publication_files", false),
    ("publication_screen_views", false),
];

#[test]
fn retention_discovers_relationships_instead_of_column_spelling() {
    let Some((_store, schema)) = store() else {
        return;
    };
    let mut connection = schema.connection();
    for statement in [
        "CREATE TABLE retention_child_probe (source_publication uuid REFERENCES publications(id))",
        "CREATE TABLE retention_unrelated_probe (publication_id uuid)",
    ] {
        diesel::sql_query(statement)
            .execute(&mut connection)
            .unwrap();
    }
    let tables = child_tables(&mut connection);
    assert!(tables.iter().any(|table| {
        table.table_name == "retention_child_probe" && table.column_name == "source_publication"
    }));
    assert!(
        tables
            .iter()
            .all(|table| table.table_name != "retention_unrelated_probe")
    );
}

#[test]
fn maintenance_keeps_ready_children_and_explicit_expiry_applies_its_release_policy() {
    let Some((store, schema)) = store() else {
        return;
    };
    let project = project(store.as_ref());
    let mut old = publication(&project, PublicationState::Validating, 0, "feature");
    let metadata = old.metadata.as_mut().unwrap();
    metadata.base_ref = Some("main".into());
    metadata.base_sha = Some("a".repeat(40));
    let latest = publication(&project, PublicationState::Validating, 0, "feature");
    let content = blob(project.id, b"retention fixture");
    let mut reference = file(project.id, old.id, content.key.clone());
    reference.size = content.size;
    let mut private_metadata = reference.clone();
    private_metadata.path = ENVELOPE_PATH.into();
    let changes = Changes::Available(Counts {
        added: 1,
        changed: 2,
        removed: 3,
    });
    let user = User {
        id: Uuid::now_v7().into(),
        email: "retention@example.com".into(),
        name: "Retention".into(),
        created_at: Utc::now(),
    };
    store
        .transaction(&mut Callback(&mut |q| {
            q.insert_user(&user)?;
            q.insert_publication(&old)?;
            q.insert_publication(&latest)?;
            q.insert_blob(&content)?;
            q.insert_publication_file(&reference)?;
            q.insert_publication_file(&private_metadata)?;
            q.insert_publication_screen_views(
                old.id,
                &[ScreenView {
                    screen_path: "start".parse().unwrap(),
                    viewport: Viewport::Desktop,
                    scheme: Scheme::Light,
                }],
            )?;
            assert!(q.ready_publication(old.id, changes)?);
            assert!(q.ready_publication(latest.id, Changes::NoComparison)?);
            retained_build_fixture::populate(q, &project, &old)?;
            q.insert_catalogue_grant(&CatalogueGrant {
                digest: "a".repeat(64),
                publication_id: old.id,
                user_id: user.id,
                expires_at: Utc::now() + Duration::days(40),
            })?;
            q.insert_publication_event(&PublicationEvent {
                id: Uuid::now_v7(),
                publication_id: old.id,
                kind: EventKind::Ready,
                created_at: Utc::now(),
            })
        }))
        .unwrap();
    let mut connection = schema.connection();
    let before = child_counts(&mut connection, old.id);
    assert!(
        before.values().all(|count| *count > 0),
        "every child table must be populated"
    );
    let worker = PublicationRetention {
        transactions: Arc::new(StoreTransactions {
            store: store.clone(),
        }),
        runtime: Arc::new(Unimock::new(
            RuntimeMock::now
                .each_call(matching!())
                .returns(Utc::now() + Duration::days(31)),
        )),
    };
    let report = worker.run_batch(None).unwrap();
    assert_eq!((report.abandoned, report.pruned), (0, 0));
    assert_eq!(child_counts(&mut connection, old.id), before);
    store
        .transaction(&mut Callback(&mut |q| {
            let ready = q.publication(old.id)?.unwrap();
            assert_eq!(
                (ready.state, ready.expired_at),
                (PublicationState::Ready, None)
            );
            assert_eq!(q.publication_files(old.id)?.len(), 2);
            assert_eq!(q.blob(project.id, &content.key.hash)?.unwrap().ref_count, 2);
            assert!(q.expire_publication(old.id, Utc::now())?);
            q.delete_publication_files(old.id)?;
            q.insert_publication_event(&PublicationEvent {
                id: Uuid::now_v7(),
                publication_id: old.id,
                kind: EventKind::Expired,
                created_at: Utc::now(),
            })
        }))
        .unwrap();
    let after = child_counts(&mut connection, old.id);
    for (table, retain) in RETENTION {
        if retain {
            assert!(
                after[table] >= before[table],
                "{table} must retain its observations"
            );
        } else {
            assert_eq!(after[table], 0, "{table} must release expired rows");
        }
    }
    store
        .read(&mut Callback(&mut |q| {
            let retained = q.publication(old.id)?.unwrap();
            assert_eq!(retained.state, PublicationState::Expired);
            assert_eq!(retained.changes, Some(changes));
            assert_eq!(q.blob(project.id, &content.key.hash)?.unwrap().ref_count, 0);
            Ok(())
        }))
        .unwrap();
}

#[derive(QueryableByName)]
struct ChildTable {
    #[diesel(sql_type = Text)]
    table_name: String,
    #[diesel(sql_type = Text)]
    column_name: String,
}

#[derive(QueryableByName)]
struct RowCount {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

fn child_counts(
    connection: &mut PgConnection,
    publication: PublicationId,
) -> BTreeMap<String, i64> {
    let tables = child_tables(connection);
    assert_eq!(
        tables
            .iter()
            .map(|t| t.table_name.as_str())
            .collect::<Vec<_>>(),
        RETENTION.map(|(table, _)| table),
        "new publication children require a retention policy and fixture"
    );
    tables
        .into_iter()
        .map(|table| {
            let count = diesel::sql_query(format!(
                "SELECT count(*) AS count FROM {} WHERE {} = $1",
                table.table_name, table.column_name
            ))
            .bind::<sql_types::Uuid, _>(publication.0)
            .get_result::<RowCount>(connection)
            .unwrap()
            .count;
            (table.table_name, count)
        })
        .collect()
}

fn child_tables(connection: &mut PgConnection) -> Vec<ChildTable> {
    diesel::sql_query(
        "SELECT DISTINCT fk.conrelid::regclass::text AS table_name, \
         quote_ident(child.attname) AS column_name \
         FROM pg_constraint fk \
         JOIN LATERAL unnest(fk.conkey, fk.confkey) AS columns(child_num, parent_num) ON true \
         JOIN pg_attribute child \
           ON child.attrelid = fk.conrelid AND child.attnum = columns.child_num \
         JOIN pg_attribute parent \
           ON parent.attrelid = fk.confrelid AND parent.attnum = columns.parent_num \
         WHERE fk.contype = 'f' AND fk.confrelid = 'publications'::regclass \
           AND parent.attname = 'id' \
         ORDER BY table_name, column_name",
    )
    .load::<ChildTable>(connection)
    .unwrap()
}
