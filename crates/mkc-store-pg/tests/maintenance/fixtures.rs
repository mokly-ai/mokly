//! Private schema per maintenance test, with required-database failure semantics.

use std::env;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use diesel::connection::SimpleConnection;
use diesel::sql_types::Timestamptz;
use diesel::{Connection, PgConnection, RunQueryDsl};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_store_interface::store::Store;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use uuid::Uuid;

pub(super) struct Database {
    pub(super) store: Arc<dyn Store>,
    pub(super) connection: PgConnection,
    name: String,
}

impl Drop for Database {
    fn drop(&mut self) {
        diesel::sql_query(format!("DROP SCHEMA {} CASCADE", self.name))
            .execute(&mut self.connection)
            .unwrap();
    }
}

/// A migrated private schema whose store connection gives up lock waits after
/// two seconds. Migration waits for the workspace-wide migration lock without
/// that limit, because every parallel test migrates its own schema under it.
pub(super) fn database() -> Option<Database> {
    let url = env::var("MKC_TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/mkc_test".into());
    let mut connection = match PgConnection::establish(&url) {
        Ok(connection) => connection,
        Err(error) => {
            assert!(
                env::var_os("MKC_TEST_DATABASE_URL").is_none() && env::var_os("CI").is_none(),
                "Required maintenance Postgres unreachable: {error}"
            );
            eprintln!("SKIP maintenance: unconfigured Postgres unreachable: {error}");
            return None;
        }
    };
    let name = format!("maintenance_{}", Uuid::now_v7().simple());
    diesel::sql_query(format!("CREATE SCHEMA {name}"))
        .execute(&mut connection)
        .unwrap();
    diesel::sql_query(format!("SET search_path TO {name}"))
        .execute(&mut connection)
        .unwrap();
    let separator = if url.contains('?') { '&' } else { '?' };
    let private = format!("{url}{separator}options=-csearch_path%3D{name}");
    DieselMigrations.migrate(&private).unwrap();
    let scoped = format!("{private}%20-clock_timeout%3D2000");
    let store = PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    }
    .connect(&scoped)
    .unwrap();
    Some(Database {
        store,
        connection,
        name,
    })
}

/// Insert 200 attempts with one due upload and one failure at the age cutoff.
/// Remaining rows are recent failures or uploads with future deadlines.
pub(super) fn publication_candidate_rows(connection: &mut PgConnection, now: DateTime<Utc>) {
    connection
        .batch_execute(
            "BEGIN;
            INSERT INTO organizations (id, name, slug, version, created_at)
            VALUES ('00000000-0000-0000-0000-000000000001', 'Retention plans', 'retention-plans', 1, now());
            INSERT INTO organization_slugs (slug, organization_id)
            VALUES ('retention-plans', '00000000-0000-0000-0000-000000000001');
            INSERT INTO projects (id, organization_id, name, slug, repository, config_path, visibility, version)
            VALUES ('00000000-0000-0000-0000-000000000002',
                '00000000-0000-0000-0000-000000000001', 'Retention plans', 'retention-plans',
                'test/retention-plans', 'mokly.config.ts', 'private', 1);
            INSERT INTO project_slugs (organization_id, slug, project_id)
            VALUES ('00000000-0000-0000-0000-000000000001', 'retention-plans',
                '00000000-0000-0000-0000-000000000002');
            COMMIT;",
        )
        .unwrap();
    diesel::sql_query(
        "INSERT INTO publications (id, project_id, state, failure_code, created_at, deadline)
        SELECT lpad(n::text, 32, '0')::uuid, '00000000-0000-0000-0000-000000000002',
            CASE WHEN n <= 100 THEN 'uploading' ELSE 'failed' END,
            CASE WHEN n > 100 THEN 'internal' END,
            CASE WHEN n = 199 THEN $1::timestamptz - interval '30 days'
                ELSE $1::timestamptz - interval '1 hour' END,
            CASE WHEN n = 99 THEN $1::timestamptz ELSE $1::timestamptz + interval '1 hour' END
        FROM generate_series(1, 200) n",
    )
    .bind::<Timestamptz, _>(now)
    .execute(connection)
    .unwrap();
    diesel::sql_query("ANALYZE publications")
        .execute(connection)
        .unwrap();
}
