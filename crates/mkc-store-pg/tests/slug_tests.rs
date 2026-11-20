//! Real Postgres slug-claim uniqueness, lookup and cascade behavior.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::{Arc, Barrier};
use std::thread;

use chrono::Utc;
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::slug::{ProjectSlug, WorkspaceSlug};
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::error::Error;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::store::{Callback, Store};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use uuid::Uuid;

fn store() -> Option<(Arc<dyn Store>, ScratchSchema)> {
    let schema = ScratchSchema::create("slug")?;
    let migrations: &dyn MigrationRunner = &DieselMigrations;
    migrations.migrate(schema.scoped_url()).unwrap();
    let factory: &dyn StoreFactory = &PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    };
    Some((factory.connect(schema.scoped_url()).unwrap(), schema))
}

fn organization(name: &str, slug: &str) -> Organization {
    Organization {
        id: Uuid::now_v7().into(),
        name: name.into(),
        slug: slug.parse::<WorkspaceSlug>().unwrap(),
        version: 1,
        created_at: Utc::now(),
        plan: Plan::Free,
    }
}

fn project(organization: &Organization, slug: &str) -> Project {
    Project {
        id: Uuid::now_v7().into(),
        organization_id: organization.id,
        name: "Catalogue".into(),
        slug: slug.parse::<ProjectSlug>().unwrap(),
        repository: format!("mokly/{slug}"),
        config_path: "mokly.config.ts".into(),
        visibility: Visibility::Private,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    }
}

#[test]
fn current_and_retired_claims_are_atomic_reclaimable_and_cascading() {
    let Some((store, _schema)) = store() else {
        return;
    };
    let mut first = organization("First", "slug-history-first");
    let second = organization("Second", "slug-history-second");
    let mut first_project = project(&first, "catalogue-first");
    let second_project = project(&second, "catalogue-first");
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_organization(&first)?;
            queries.insert_organization(&second)?;
            queries.insert_project(&first_project)?;
            queries.insert_project(&second_project)?;
            Ok(())
        }))
        .unwrap();

    let old_organization = first.slug.clone();
    let old_project = first_project.slug.clone();
    first.slug = "slug-history-renamed".parse().unwrap();
    first.version += 1;
    first_project.slug = "catalogue-renamed".parse().unwrap();
    first_project.version += 1;
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.save_organization(&first)?;
            queries.save_project(&first_project)
        }))
        .unwrap();
    store
        .read(&mut Callback(&mut |queries| {
            let organization = queries
                .find_organization_by_slug(&old_organization)?
                .unwrap();
            assert!(organization.retired);
            assert_eq!(organization.value.id, first.id);
            let project = queries
                .find_project_by_slug(first.id, &old_project)?
                .unwrap();
            assert!(project.retired);
            assert_eq!(project.value.id, first_project.id);
            Ok(())
        }))
        .unwrap();

    let mut conflicting = organization("Conflict", old_organization.as_str());
    let result = store.transaction(&mut Callback(&mut |queries| {
        queries.insert_organization(&conflicting)
    }));
    assert!(matches!(result, Err(Error::SlugTaken)));
    conflicting.slug = "slug-history-third".parse().unwrap();
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_organization(&conflicting)
        }))
        .unwrap();

    first.slug = old_organization.clone();
    first.version += 1;
    first_project.slug = old_project.clone();
    first_project.version += 1;
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.save_organization(&first)?;
            queries.save_project(&first_project)
        }))
        .unwrap();
    store
        .read(&mut Callback(&mut |queries| {
            assert!(
                !queries
                    .find_organization_by_slug(&old_organization)?
                    .unwrap()
                    .retired
            );
            assert!(
                !queries
                    .find_project_by_slug(first.id, &old_project)?
                    .unwrap()
                    .retired
            );
            Ok(())
        }))
        .unwrap();

    store
        .transaction(&mut Callback(&mut |queries| {
            queries.delete_organization(first.id)
        }))
        .unwrap();
    store
        .read(&mut Callback(&mut |queries| {
            assert!(
                queries
                    .find_organization_by_slug(&old_organization)?
                    .is_none()
            );
            assert!(
                queries
                    .find_project_by_slug(first.id, &old_project)?
                    .is_none()
            );
            Ok(())
        }))
        .unwrap();
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.delete_organization(second.id)?;
            queries.delete_organization(conflicting.id)
        }))
        .unwrap();
}

#[test]
fn concurrent_claims_have_one_winner_and_typed_losers() {
    let Some((store, _schema)) = store() else {
        return;
    };
    let slug: WorkspaceSlug = format!("r-{}", Uuid::now_v7().simple()).parse().unwrap();
    let barrier = Arc::new(Barrier::new(8));
    let handles = (0..8)
        .map(|index| {
            let store = store.clone();
            let barrier = barrier.clone();
            let organization = organization(&format!("Racer {index}"), slug.as_str());
            thread::spawn(move || {
                barrier.wait();
                store.transaction(&mut Callback(&mut |queries| {
                    queries.insert_organization(&organization)
                }))
            })
        })
        .collect::<Vec<_>>();
    let outcomes = handles
        .into_iter()
        .map(|handle| handle.join().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(outcomes.iter().filter(|result| result.is_ok()).count(), 1);
    assert_eq!(
        outcomes
            .iter()
            .filter(|result| matches!(result, Err(Error::SlugTaken)))
            .count(),
        7
    );
    let mut winner = None;
    store
        .read(&mut Callback(&mut |queries| {
            winner = queries
                .find_organization_by_slug(&slug)?
                .map(|lookup| lookup.value.id);
            Ok(())
        }))
        .unwrap();
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.delete_organization(winner.unwrap())
        }))
        .unwrap();
}
