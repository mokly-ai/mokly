//! Real Postgres transaction rollback, mappings and cascade integration.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::Utc;
use diesel::prelude::*;
use diesel::sql_types::{Text, Timestamptz, Uuid as SqlUuid};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::values::{Plan, Role};
use mkc_store_interface::error::Error;
use mkc_store_interface::integration::IntegrationSubject;
use mkc_store_interface::member::Member;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::store::{Callback, Store};
use mkc_store_interface::user::User;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use uuid::Uuid;

fn store() -> Option<(Arc<dyn Store>, ScratchSchema)> {
    let schema = ScratchSchema::create("persistence")?;
    let migrations: &dyn MigrationRunner = &DieselMigrations;
    migrations.migrate(schema.scoped_url()).unwrap();
    let factory: &dyn StoreFactory = &PgStoreFactory {
        runtime: Arc::new(runtime::SystemRuntime),
    };
    Some((factory.connect(schema.scoped_url()).unwrap(), schema))
}

#[test]
fn query_mappings_rollback_and_foreign_key_cascade() {
    let Some((store, _schema)) = store() else {
        return;
    };
    let id = Uuid::from_u128(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
    );
    let user = User {
        id: id.into(),
        name: "Integration".to_owned(),
        email: format!("{id}@example.com"),
        created_at: Utc::now(),
    };
    let org = Organization {
        id: Uuid::from_u128(id.as_u128() + 1).into(),
        name: "Integration".to_owned(),
        slug: format!("o-{}", id.simple()).parse().unwrap(),
        version: 1,
        created_at: Utc::now(),
        plan: Plan::Free,
    };
    let member = Member {
        id: Uuid::from_u128(id.as_u128() + 2).into(),
        organization_id: org.id,
        user_id: Some(user.id),
        email: user.email.clone(),
        role: Role::Owner,
        version: 1,
        expires_at: None,
    };
    let result = store.transaction(&mut Callback(&mut |queries| {
        queries.insert_user(&user)?;
        Err(Error::internal(diesel::result::Error::RollbackTransaction))
    }));
    assert!(matches!(result, Err(Error::Internal(_))));
    store
        .transaction(&mut Callback(&mut |queries| {
            assert!(queries.user(user.id)?.is_none());
            queries.insert_user(&user)?;
            queries.insert_organization(&org)?;
            queries.insert_member(&member)?;
            assert_eq!(queries.user_memberships(user.id)?[0].role, Role::Owner);
            assert_eq!(queries.find_user(&user.email)?.unwrap().id, user.id);
            Ok(())
        }))
        .unwrap();
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.delete_organization(org.id)?;
            assert!(queries.members(org.id)?.is_empty());
            queries.delete_user(user.id)
        }))
        .unwrap();
}

#[test]
fn integrations_select_persisted_accounts_by_subject_and_cascade() {
    let Some((store, schema)) = store() else {
        return;
    };
    let mut connection = PgConnection::establish(schema.scoped_url()).unwrap();
    let id = Uuid::from_u128(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
    );
    let user = User {
        id: id.into(),
        name: "Integration".into(),
        email: format!("{id}@example.com"),
        created_at: Utc::now(),
    };
    let org = Organization {
        id: Uuid::from_u128(id.as_u128() + 1).into(),
        name: "Team".into(),
        slug: format!("o-{}", id.simple()).parse().unwrap(),
        version: 1,
        created_at: Utc::now(),
        plan: Plan::Free,
    };
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_user(&user)?;
            queries.insert_organization(&org)?;
            assert!(
                queries
                    .integration(IntegrationSubject::User(user.id))?
                    .is_none()
            );
            assert!(
                queries
                    .integration(IntegrationSubject::Organization(org.id))?
                    .is_none()
            );
            Ok(())
        }))
        .unwrap();
    insert_integration(&mut connection, "user", user.id.0, "octocat").unwrap();
    insert_integration(&mut connection, "organization", org.id.0, "mokly-ai").unwrap();
    assert!(matches!(
        insert_integration(&mut connection, "user", user.id.0, "duplicate"),
        Err(diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _
        ))
    ));
    assert!(matches!(
        insert_integration(&mut connection, "organization", user.id.0, "wrong-parent"),
        Err(diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::ForeignKeyViolation,
            _
        ))
    ));
    store
        .read(&mut Callback(&mut |queries| {
            assert_eq!(
                queries
                    .integration(IntegrationSubject::User(user.id))?
                    .unwrap()
                    .account,
                "octocat"
            );
            assert_eq!(
                queries
                    .integration(IntegrationSubject::Organization(org.id))?
                    .unwrap()
                    .account,
                "mokly-ai"
            );
            assert!(
                queries
                    .integration(IntegrationSubject::Organization(user.id.0.into()))?
                    .is_none()
            );
            assert!(
                queries
                    .integration(IntegrationSubject::User(org.id.0.into()))?
                    .is_none()
            );
            Ok(())
        }))
        .unwrap();
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.delete_user(user.id)?;
            assert!(
                queries
                    .integration(IntegrationSubject::User(user.id))?
                    .is_none()
            );
            assert!(
                queries
                    .integration(IntegrationSubject::Organization(org.id))?
                    .is_some()
            );
            queries.delete_organization(org.id)?;
            assert!(
                queries
                    .integration(IntegrationSubject::Organization(org.id))?
                    .is_none()
            );
            Ok(())
        }))
        .unwrap();
}

fn insert_integration(
    connection: &mut PgConnection,
    kind: &str,
    id: Uuid,
    account: &str,
) -> QueryResult<usize> {
    diesel::sql_query("INSERT INTO integrations (subject_kind, subject_id, provider, account_name, created_at) VALUES ($1, $2, 'github', $3, $4)")
        .bind::<Text, _>(kind)
        .bind::<SqlUuid, _>(id)
        .bind::<Text, _>(account)
        .bind::<Timestamptz, _>(Utc::now())
        .execute(connection)
}
