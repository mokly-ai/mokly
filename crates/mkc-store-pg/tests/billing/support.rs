//! Migrated store and rollback helpers for isolated billing scenarios.

use std::sync::Arc;

use chrono::Utc;
use diesel::{Connection, PgConnection};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::values::Plan;
use mkc_store_interface::error::Result;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::store::{Decision, Queries, Store, Transaction};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use uuid::Uuid;

/// One migrated scratch schema; the store closes before the schema is dropped.
pub(super) struct Database {
    pub(super) store: Arc<dyn Store>,
    schema: ScratchSchema,
}

impl Database {
    /// Open a raw connection scoped to this test's schema.
    pub(super) fn connection(&self) -> PgConnection {
        PgConnection::establish(self.schema.scoped_url()).unwrap()
    }
}

pub(super) fn database() -> Option<Database> {
    let schema = ScratchSchema::create("billing")?;
    DieselMigrations.migrate(schema.scoped_url()).unwrap();
    let factory: &dyn StoreFactory = &PgStoreFactory {
        runtime: Arc::new(runtime::SystemRuntime),
    };
    Some(Database {
        store: factory.connect(schema.scoped_url()).unwrap(),
        schema,
    })
}

struct Scenario<'a>(&'a mut dyn FnMut(&mut dyn Queries) -> Result<()>);

impl Transaction for Scenario<'_> {
    fn run(&mut self, queries: &mut dyn Queries) -> Result<Decision> {
        (self.0)(queries)?;
        Ok(Decision::Rollback)
    }
}

pub(super) fn run(scenario: &mut dyn FnMut(&mut dyn Queries) -> Result<()>) {
    let Some(database) = database() else {
        return;
    };
    database.store.transaction(&mut Scenario(scenario)).unwrap();
}

pub(super) fn organization(name: &str, plan: Plan) -> Organization {
    Organization {
        id: Uuid::now_v7().into(),
        name: name.into(),
        slug: format!("b-{}", Uuid::now_v7().simple()).parse().unwrap(),
        version: 1,
        created_at: Utc::now(),
        plan,
    }
}
