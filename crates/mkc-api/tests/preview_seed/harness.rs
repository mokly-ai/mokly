//! The real seed executable with one database schema and one local store.

use std::process::Command;
use std::sync::Arc;

use bytes::Bytes;
use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::seed_name::SeedName;
use mkc_file_store_local::directory::{LocalFileStoreFactory, SeedStoreFactory};
use mkc_test_pg::scratch_schema::ScratchSchema;
use serde_json::{Value, json};
use tempfile::TempDir;

use super::frozen::{HEAD, catalogue, refused_plan};

pub(crate) struct Harness {
    pub(crate) database: ScratchSchema,
    root: TempDir,
    files: Arc<dyn SeedStore>,
}

pub(crate) struct Output {
    pub(crate) code: i32,
    pub(crate) log: String,
}

impl Harness {
    pub(crate) fn new() -> Self {
        let database = ScratchSchema::create("preview_seed").expect("Postgres is required");
        let root = TempDir::new().unwrap();
        let files = LocalFileStoreFactory.open_seed(root.path()).unwrap();
        Self {
            database,
            root,
            files,
        }
    }

    pub(crate) fn stage(&self, run: &str, pull_request: Option<u32>) {
        let environment =
            pull_request.map_or_else(|| "local".to_owned(), |pr| format!("preview-pr-{pr}"));
        self.put_json(
            run,
            "request.json",
            &json!({
                "schemaVersion": 1, "environment": environment, "revision": HEAD,
                "pullRequest": pull_request,
            }),
        );
    }

    pub(crate) fn catalogue(&self, run: &str, pull_request: Option<u32>, corrupt: bool) {
        let fixture = catalogue(pull_request);
        self.put(run, "catalogue/plan.tar.gz", fixture.plan.clone());
        for (hash, bytes) in &fixture.blobs {
            let bytes = if corrupt {
                b"corrupt catalogue blob".to_vec()
            } else {
                bytes.clone()
            };
            self.put(run, &format!("catalogue/blobs/{hash}"), bytes);
        }
    }

    pub(crate) fn put_json(&self, run: &str, file: &str, value: &Value) {
        self.put(run, file, serde_json::to_vec(value).unwrap());
    }

    pub(crate) fn refused_plan(&self, run: &str) {
        self.put(run, "catalogue/plan.tar.gz", refused_plan().plan);
    }

    fn put(&self, run: &str, file: &str, bytes: Vec<u8>) {
        self.files
            .put(&SeedName::new(run, file).unwrap(), Bytes::from(bytes))
            .unwrap();
    }

    pub(crate) fn get(&self, run: &str, file: &str) -> Option<Vec<u8>> {
        let name = SeedName::new(run, file).unwrap();
        self.files.get(&name, name.max_bytes()).unwrap()
    }

    pub(crate) fn json(&self, run: &str, file: &str) -> Value {
        let bytes = self.get(run, file);
        assert!(bytes.is_some(), "{run}/{file} was not written");
        serde_json::from_slice(&bytes.unwrap()).unwrap()
    }

    pub(crate) fn run(&self, run: &str, overrides: &[(&str, &str)]) -> Output {
        let mut command = Command::new(env!("CARGO_BIN_EXE_mkc-api"));
        command
            .env_clear()
            .args(["preview-seed", "--run", run])
            .env("MKC_ENV", "development")
            .env("MKC_DATABASE_URL", self.database.scoped_url())
            .env("MKC_APP_ORIGIN", "http://localhost:8081")
            .env("MKC_API_ORIGIN", "http://127.0.0.1:8080")
            .env("MKC_MAILER", "log")
            .env("MKC_CATALOGUE_ORIGIN", "http://localhost:8082")
            .env("MKC_CATALOGUE_SIGNING_KEY", "a".repeat(64))
            .env("MKC_FILE_STORE", "local")
            .env("MKC_FILE_STORE_ROOT", self.root.path())
            .env("MKC_PREVIEW_SIGN_IN_SECRET", "c".repeat(64))
            .env("MKC_PREVIEW_SIGN_IN_EMAIL", "preview@mokly.ai")
            .env("MKC_PREVIEW_SIGN_IN_PLAN", "team");
        for (key, value) in overrides {
            if value.is_empty() {
                command.env_remove(key);
            } else {
                command.env(key, value);
            }
        }
        let output = command.output().unwrap();
        let log = format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(
            !log.contains(&"c".repeat(64)),
            "sign-in secret reached logs"
        );
        assert!(
            !regex::Regex::new(r"mkc_[a-f0-9]{64}")
                .unwrap()
                .is_match(&log),
            "project token reached logs"
        );
        Output {
            code: output.status.code().unwrap_or(-1),
            log,
        }
    }
}
