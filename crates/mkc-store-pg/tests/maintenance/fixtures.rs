//! Private schema per maintenance test, with required-database failure semantics.

use std::env;
use std::sync::Arc;

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
