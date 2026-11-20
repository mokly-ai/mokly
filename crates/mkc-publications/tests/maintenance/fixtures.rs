//! Isolated project records and real Postgres composition for integration tests.

use std::env;
use std::sync::Arc;

use chrono::{Duration, Utc};
use diesel::{Connection, PgConnection, RunQueryDsl};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::blob::{Blob, PublicationFile};
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationMetadata, PublicationState};
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::store::{Callback, Store};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use serde_json::{Value, json};
use url::Url;
use uuid::Uuid;

pub(super) struct SchemaGuard {
    database: String,
    name: String,
}

impl SchemaGuard {
    pub(super) fn connection(&self) -> PgConnection {
        let mut connection = PgConnection::establish(&self.database).unwrap();
        diesel::sql_query(format!("SET search_path TO {}", self.name))
            .execute(&mut connection)
            .unwrap();
        connection
    }
}

impl Drop for SchemaGuard {
    fn drop(&mut self) {
        let mut connection = PgConnection::establish(&self.database).unwrap();
        diesel::sql_query(format!("DROP SCHEMA {} CASCADE", self.name))
            .execute(&mut connection)
            .unwrap();
    }
}

pub(super) fn store() -> Option<(Arc<dyn Store>, SchemaGuard)> {
    let url = env::var("MKC_TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/mkc_test".into());
    if let Err(error) = PgConnection::establish(&url) {
        assert!(
            env::var_os("MKC_TEST_DATABASE_URL").is_none() && env::var_os("CI").is_none(),
            "Required maintenance database is unreachable: {error}"
        );
        eprintln!("SKIP maintenance integration: unconfigured Postgres is unreachable: {error}");
        return None;
    }
    let name = format!("m9_{}", Uuid::now_v7().simple());
    let mut connection = PgConnection::establish(&url).unwrap();
    diesel::sql_query(format!("CREATE SCHEMA {name}"))
        .execute(&mut connection)
        .unwrap();
    let guard = SchemaGuard {
        database: url.clone(),
        name: name.clone(),
    };
    let mut scoped = Url::parse(&url).unwrap();
    scoped
        .query_pairs_mut()
        .append_pair("options", &format!("-csearch_path={name}"));
    DieselMigrations.migrate(scoped.as_str()).unwrap();
    Some((
        PgStoreFactory {
            runtime: Arc::new(SystemRuntime),
        }
        .connect(scoped.as_str())
        .unwrap(),
        guard,
    ))
}

pub(super) fn project(store: &dyn Store) -> Project {
    let org = Organization {
        id: Uuid::now_v7().into(),
        name: "Maintenance integration".into(),
        slug: format!("m-{}", Uuid::now_v7().simple()).parse().unwrap(),
        version: 1,
        created_at: Utc::now(),
        plan: Plan::Free,
    };
    let project = Project {
        id: Uuid::now_v7().into(),
        organization_id: org.id,
        name: "Catalogue".into(),
        slug: format!("p-{}", Uuid::now_v7().simple()).parse().unwrap(),
        repository: "mokly-ai/mokly-cloud".into(),
        config_path: "mokly.config.json".into(),
        visibility: Visibility::Public,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    };
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_organization(&org)?;
            queries.insert_project(&project)
        }))
        .unwrap();
    project
}

pub(super) fn publication(
    project: &Project,
    state: PublicationState,
    age: i64,
    branch: &str,
) -> Publication {
    let created_at = Utc::now() - Duration::days(age);
    Publication {
        id: Uuid::now_v7().into(),
        project_id: project.id,
        metadata: (state != PublicationState::Uploading).then(|| PublicationMetadata {
            branch: branch.into(),
            head_sha: BlobHash::digest(Uuid::now_v7().as_bytes()).to_string(),
            base_ref: None,
            base_sha: None,
            pull_request: None,
            config_path: project.config_path.clone(),
            exported_at: created_at,
        }),
        state,
        changes: matches!(state, PublicationState::Ready | PublicationState::Expired)
            .then_some(Changes::NoComparison),
        failure: None,
        created_at,
        deadline: created_at + Duration::minutes(15),
        expired_at: None,
        build_id: None,
        build_failure_event_id: None,
    }
}

pub(super) fn file(project_id: ProjectId, id: PublicationId, key: BlobKey) -> PublicationFile {
    PublicationFile {
        publication_id: id,
        project_id,
        path: "index.html".into(),
        key,
        content_type: "text/html".into(),
        size: 1,
    }
}

pub(super) fn blob(project_id: ProjectId, content: &[u8]) -> Blob {
    Blob {
        project_id,
        key: BlobKey {
            hash: BlobHash::digest(content),
            incarnation: Uuid::now_v7(),
        },
        size: content.len() as i64,
        content_type: "text/html".into(),
        ref_count: 0,
        deleting: false,
        unreferenced_at: Some(Utc::now() - Duration::days(2)),
        stored_at: None,
    }
}

/// Current-only metadata for completion tests that keep one stored index file.
pub(super) fn current_index() -> Vec<u8> {
    let mut index: Value = serde_json::from_slice(include_bytes!(
        "../../../mkc-mokly-contract/fixtures/index-v9.json"
    ))
    .unwrap();
    index.as_object_mut().unwrap().remove("baseCommit");
    index["comparisonUrl"] = Value::Null;
    index["changesStatus"] = json!("disabled");
    index["removedEntries"] = json!([]);
    for kind in ["components", "documents", "pages", "screens", "useCases"] {
        for record in index[kind].as_array_mut().unwrap() {
            record["changes"] = json!({"status":"disabled"});
            record.as_object_mut().unwrap().remove("previousPath");
            if record.get("comparison").is_some() {
                record["comparison"] = json!({"status":"disabled"});
            }
            if let Some(views) = record.get_mut("views").and_then(Value::as_array_mut) {
                for view in views {
                    view["comparison"] = json!({"status":"disabled"});
                }
            }
        }
    }
    serde_json::to_vec(&index).unwrap()
}
