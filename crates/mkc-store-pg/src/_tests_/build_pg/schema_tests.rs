//! Migration constraints, existing-project defaults and reversible schema addition.

use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::result::Error;
use diesel::sql_types::{Bool, Text};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::log_tests::chunk;
use super::support::{attempt, fixture};

#[derive(QueryableByName)]
struct Flag {
    #[diesel(sql_type = Bool)]
    automatic_builds: bool,
}

#[test]
fn build_uploads_require_distinct_reserved_cleanup_event_ids() {
    let Some(f) = fixture() else {
        return;
    };
    let build = f.build("main", 1);
    f.schedule(&build);
    let mut reserved = f.publication(&build);
    reserved.state = PublicationState::Uploading;
    reserved.metadata = None;
    reserved.changes = None;
    f.store
        .transaction(&mut Callback(&mut |q| q.insert_publication(&reserved)))
        .unwrap();
    for event in [None, reserved.build_failure_event_id] {
        let mut invalid = reserved.clone();
        invalid.id = Uuid::now_v7().into();
        invalid.build_failure_event_id = event;
        assert!(
            f.store
                .transaction(&mut Callback(&mut |q| q.insert_publication(&invalid)))
                .is_err()
        );
    }
    let mut distinct = reserved.clone();
    distinct.id = Uuid::now_v7().into();
    distinct.build_failure_event_id = Some(Uuid::now_v7());
    f.store
        .transaction(&mut Callback(&mut |q| q.insert_publication(&distinct)))
        .unwrap();
}

#[test]
fn rollback_and_reapply_preserve_existing_projects_with_automatic_builds_off() {
    let Some(f) = fixture() else {
        return;
    };
    let mut connection = f.connection();
    connection
        .transaction::<(), Error, _>(|connection| {
            connection.batch_execute(include_str!(
                "../../../../mkc-db/migrations/202611011910_build_failure_causes/down.sql"
            ))?;
            connection.batch_execute(include_str!(
                "../../../../mkc-db/migrations/202610100900_cloud_builds/down.sql"
            ))?;
            diesel::sql_query("DELETE FROM __diesel_schema_migrations WHERE version IN ('202610100900', '202611011910')")
                .execute(connection)?;
            Ok(())
        })
        .unwrap();
    assert!(
        diesel::sql_query("SELECT * FROM builds")
            .execute(&mut connection)
            .is_err()
    );
    DieselMigrations.migrate(f.schema.scoped_url()).unwrap();
    let flag = diesel::sql_query("SELECT automatic_builds FROM projects")
        .get_result::<Flag>(&mut connection)
        .unwrap();
    assert!(!flag.automatic_builds);
    f.store
        .read(&mut Callback(&mut |q| {
            assert!(!q.project(f.project.id)?.unwrap().automatic_builds);
            Ok(())
        }))
        .unwrap();
}

#[test]
fn active_head_constraint_and_lifecycle_constraints_reject_invalid_rows() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let mut duplicate = f.build("other", 1);
    duplicate.head_sha = b.head_sha.clone();
    assert!(
        f.store
            .transaction(&mut Callback(&mut |q| q.schedule_build(&duplicate)))
            .is_err()
    );
    let mut connection = f.connection();
    for statement in [
        "UPDATE builds SET state = 'running'",
        "UPDATE builds SET state = 'failed', finished_at = created_at",
        "UPDATE builds SET state = 'published', finished_at = created_at",
        "UPDATE builds SET state = 'cancelled'",
        "UPDATE builds SET lease_token = gen_random_uuid()",
        "UPDATE builds SET head_sha = 'ABC'",
        "UPDATE builds SET log_bytes = 1048577",
        "UPDATE builds SET attempt = -1",
    ] {
        assert!(
            diesel::sql_query(statement)
                .execute(&mut connection)
                .is_err(),
            "{statement}"
        );
    }
    let flag = diesel::sql_query("SELECT automatic_builds FROM projects")
        .get_result::<Flag>(&mut connection)
        .unwrap();
    assert!(!flag.automatic_builds);
    let a = attempt(f.now);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &a)?;
            Ok(())
        }))
        .unwrap();
    for bytes in [vec![], vec![0; 65537]] {
        assert!(
            f.store
                .transaction(&mut Callback(&mut |q| {
                    q.append_build_log(b.id, &chunk(a.operation_id, bytes.clone(), f.now))?;
                    Ok(())
                }))
                .is_err()
        );
    }
    let digest_rejection = diesel::sql_query("INSERT INTO build_upload_grants(id, build_id, attempt, token_digest, expires_at, created_at)
        SELECT gen_random_uuid(), id, 1, decode('00', 'hex'), $1::timestamptz + interval '1 hour', $1::timestamptz FROM builds")
        .bind::<Text, _>(f.now.to_rfc3339()).execute(&mut connection);
    assert!(digest_rejection.is_err());
}
