//! A second OS process runs the real API on the parent's migrated Postgres schema.

use std::env;
use std::fs;
use std::net::SocketAddr;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use reqwest::Method;
use reqwest::blocking::Client;
use tempfile::TempDir;

use crate::contract_client::ContractRequest;

use super::harness::{APP, Harness};

const ADDRESS_FILE: &str = "address";
const PENDING_ADDRESS_FILE: &str = "address.tmp";

pub(super) struct Replica {
    client: Client,
    origin: Option<String>,
    cookie: String,
    csrf: String,
    process: Child,
    root: TempDir,
}

impl Replica {
    pub(super) fn start(harness: &Harness) -> Self {
        let root = tempfile::tempdir().unwrap();
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap();
        let log = fs::File::create(root.path().join("process.log")).unwrap();
        let process = Command::new(env::current_exe().unwrap())
            .args([
                "--exact",
                "github::replica::replica_process_tests::serve_replica_process",
                "--nocapture",
            ])
            .env("MKC_BUILD_REPLICA_DATABASE", harness._schema.scoped_url())
            .env("MKC_BUILD_REPLICA_DIRECTORY", root.path())
            .stdout(Stdio::from(log.try_clone().unwrap()))
            .stderr(Stdio::from(log))
            .spawn()
            .unwrap();
        let mut replica = Self {
            client,
            origin: None,
            cookie: harness.cookie.clone(),
            csrf: harness.csrf.clone(),
            process,
            root,
        };
        let address_path = replica.root.path().join(ADDRESS_FILE);
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            replica.assert_running();
            if replica.origin.is_none() && address_path.exists() {
                let address: SocketAddr =
                    fs::read_to_string(&address_path).unwrap().parse().unwrap();
                replica.origin = Some(format!("http://{address}"));
            }
            if replica.origin.is_some()
                && replica.request(Method::GET, "/v1/session").send().is_ok()
            {
                break;
            }
            assert!(Instant::now() < deadline, "replica did not start");
            thread::sleep(Duration::from_millis(25));
        }
        replica.assert_running();
        replica
    }

    pub(super) fn request(&self, method: Method, path: &str) -> ContractRequest {
        ContractRequest::new(
            &self.client,
            method,
            format!("{}{path}", self.origin.as_ref().unwrap()),
        )
        .header("Origin", APP)
        .header("Cookie", &self.cookie)
        .header("X-CSRF-Token", &self.csrf)
    }

    fn assert_running(&mut self) {
        assert!(
            self.process.try_wait().unwrap().is_none(),
            "replica exited: {}",
            fs::read_to_string(self.root.path().join("process.log")).unwrap()
        );
    }
}

impl Drop for Replica {
    fn drop(&mut self) {
        fs::write(self.root.path().join("stop"), "stop").unwrap();
        let deadline = Instant::now() + Duration::from_secs(15);
        while self.process.try_wait().unwrap().is_none() {
            if Instant::now() >= deadline {
                self.process.kill().unwrap();
                self.process.wait().unwrap();
                break;
            }
            thread::sleep(Duration::from_millis(25));
        }
    }
}

#[path = "../support/_tests_/replica_tests.rs"]
mod replica_process_tests;
