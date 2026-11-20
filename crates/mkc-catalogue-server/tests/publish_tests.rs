//! Real server processes, Postgres, local storage and the published Mokly CLI.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::env;
use std::path::Path;
use std::process::Command;
use std::sync::Arc;

use chrono::{Duration, Utc};
use diesel::{Connection, PgConnection, RunQueryDsl};
use mkc_api::application;
use mkc_api::application::ApplicationFactory;
use mkc_auth::runtime::RuntimeMock;
use mkc_catalogue_server::application::{
    ApplicationFactory as CatalogueFactory, SystemApplicationFactory,
};
use mkc_config::catalogue::CatalogueConfig;
use mkc_config::settings::{ConfigProvider, EnvironmentConfig, ProcessEnvironment};
use mkc_file_store_local::directory::{FileStoreFactory, LocalFileStoreFactory};
use mkc_github_interface::check::{CheckRunsMock, Conclusion};
use mkc_publications::check_worker::{ChecksWorker, PublicationChecks};
use mkc_publications::garbage_collection::{BlobGarbageCollector, GarbageCollector};
use mkc_publications::locations::Locations;
use mkc_publications::retention::{PublicationRetention, RetentionWorker};
use mkc_publications::transaction::StoreTransactions;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use unimock::{MockFn, Unimock, matching};
use url::Url;
use uuid::Uuid;

struct SmokeSchema {
    database: String,
    name: String,
}

impl Drop for SmokeSchema {
    fn drop(&mut self) {
        let mut connection = PgConnection::establish(&self.database).unwrap();
        diesel::sql_query(format!("DROP SCHEMA {} CASCADE", self.name))
            .execute(&mut connection)
            .unwrap();
    }
}

fn isolated_database(database: &str) -> (String, SmokeSchema) {
    let name = format!("publication_smoke_{}", Uuid::now_v7().simple());
    let mut connection = PgConnection::establish(database).unwrap();
    diesel::sql_query(format!("CREATE SCHEMA {name}"))
        .execute(&mut connection)
        .unwrap();
    let mut scoped = Url::parse(database).unwrap();
    scoped
        .query_pairs_mut()
        .append_pair("options", &format!("-csearch_path={name}"));
    (
        scoped.to_string(),
        SmokeSchema {
            database: database.to_owned(),
            name,
        },
    )
}

#[test]
fn publication_api_process() {
    if env::var("MKC_SMOKE_PROCESS").as_deref() != Ok("api") {
        return;
    }
    tracing_subscriber::fmt().json().init();
    let settings = EnvironmentConfig {
        environment: Arc::new(ProcessEnvironment),
    }
    .load()
    .unwrap();
    let app = application::SystemApplicationFactory
        .create(settings)
        .unwrap();
    tokio::runtime::Runtime::new()
        .unwrap()
        .block_on(app.serve())
        .unwrap();
}

#[test]
fn publication_catalogue_process() {
    if env::var("MKC_SMOKE_PROCESS").as_deref() != Ok("catalogue") {
        return;
    }
    tracing_subscriber::fmt().json().init();
    let settings = EnvironmentConfig {
        environment: Arc::new(ProcessEnvironment),
    }
    .catalogue()
    .unwrap();
    let app = SystemApplicationFactory.create(settings).unwrap();
    tokio::runtime::Runtime::new()
        .unwrap()
        .block_on(app.serve())
        .unwrap();
}

#[test]
fn published_package_and_fixture_reach_isolated_catalogue_hosts() {
    let database = env::var("MKC_TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/mkc_test".into());
    if let Err(error) = PgConnection::establish(&database) {
        assert!(
            env::var_os("MKC_TEST_DATABASE_URL").is_none() && env::var_os("CI").is_none(),
            "Required publication database is unreachable: {error}"
        );
        eprintln!("SKIP publication smoke: unconfigured Postgres is unreachable: {error}");
        return;
    }
    let (database, _schema) = isolated_database(&database);
    let script =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../scripts/cloud/smoke_publications.py");
    let output = Command::new("timeout")
        .arg("600s")
        .arg("python3")
        .arg(script)
        .arg(env::current_exe().unwrap())
        .env("MKC_TEST_DATABASE_URL", database)
        .output()
        .unwrap();
    let report = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    println!("{report}");
    assert!(output.status.success(), "{report}");
}

#[test]
fn publication_retention_process() {
    if env::var("MKC_SMOKE_PROCESS").as_deref() != Ok("retention") {
        return;
    }
    let store = PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    }
    .connect(&env::var("MKC_DATABASE_URL").unwrap())
    .unwrap();
    let worker: &dyn RetentionWorker = &PublicationRetention {
        transactions: Arc::new(StoreTransactions { store }),
        runtime: Arc::new(Unimock::new((
            RuntimeMock::now
                .each_call(matching!())
                .returns(Utc::now() + Duration::days(31)),
            RuntimeMock::id
                .each_call(matching!())
                .answers(&|_| Uuid::now_v7()),
        ))),
    };
    let mut cursor = None;
    loop {
        let report = worker.run_batch(cursor).unwrap();
        cursor = report.next;
        if cursor.is_none() {
            break;
        }
    }
}

#[test]
fn publication_garbage_process() {
    if env::var("MKC_SMOKE_PROCESS").as_deref() != Ok("garbage") {
        return;
    }
    let store = PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    }
    .connect(&env::var("MKC_DATABASE_URL").unwrap())
    .unwrap();
    let files = LocalFileStoreFactory
        .open(Path::new(&env::var("MKC_FILE_STORE_ROOT").unwrap()))
        .unwrap();
    let collector = BlobGarbageCollector {
        transactions: Arc::new(StoreTransactions { store }),
        files,
        runtime: Arc::new(Unimock::new(
            RuntimeMock::now
                .each_call(matching!())
                .returns(Utc::now() + Duration::days(2)),
        )),
    };
    let mut cursor = None;
    loop {
        let report = collector.run_batch(cursor.as_deref()).unwrap();
        cursor = report.next_cursor;
        if report.blobs == 0 && report.orphans == 0 && cursor.is_none() {
            break;
        }
    }
}

#[test]
fn publication_failure_check_process() {
    if env::var("MKC_SMOKE_PROCESS").as_deref() != Ok("failure-check") {
        return;
    }
    let expected: usize = env::var("MKC_SMOKE_FAILURE_CHECKS")
        .unwrap()
        .parse()
        .unwrap();
    assert!(expected > 0);
    let store = PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    }
    .connect(&env::var("MKC_DATABASE_URL").unwrap())
    .unwrap();
    let worker: &dyn ChecksWorker = &PublicationChecks {
        transactions: Arc::new(StoreTransactions { store }),
        files: Arc::new(Unimock::new(())),
        runtime: Arc::new(Unimock::new(
            RuntimeMock::now.each_call(matching!()).returns(Utc::now()),
        )),
        locations: Locations {
            app_origin: "http://localhost:8081".into(),
            catalogue_domain: "localhost".into(),
            catalogue_scheme: "http".into(),
            catalogue_port: Some(8082),
        },
        github: Arc::new(Unimock::new(
            CheckRunsMock::upsert
                .each_call(matching!(_))
                .answers(&|_, check| {
                    assert_eq!(check.conclusion, Some(Conclusion::Failure));
                    assert_eq!(check.repository, "mokly-ai/mokly-cloud");
                    assert_eq!(check.head_sha.len(), 40);
                    Ok(())
                })
                .n_times(expected),
        )),
    };
    // Scope the batch to this smoke's own project so retained events from other
    // suites never become input to its provider and file-store doubles.
    let project = env::var("MKC_SMOKE_PROJECT_ID")
        .unwrap()
        .parse::<Uuid>()
        .unwrap();
    assert!(worker.run_batch(Some(project.into())).unwrap() >= expected);
}

#[test]
fn smoke_prerequisites_are_actionable_and_worktree_independent() {
    let scripts = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../scripts/cloud/_tests_");
    let output = Command::new("timeout")
        .args(["30s", "python3", "-m", "unittest", "discover", "-s"])
        .arg(scripts)
        .args(["-p", "*_tests.py", "-v"])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}
