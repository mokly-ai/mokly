//! Child-process API entry point used by the two-replica integration scenario.

use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mkc_api::application::{ApplicationFactory, ConfiguredApplicationFactory};
use mkc_api::billing_providers::SystemBillingProviderFactory;
use mkc_api::github_providers::SystemGitHubProviderFactory;
use mkc_github_double::server::RecordedGitHub;
use sandbox_interface::SandboxLifecycleMock;
use tokio::runtime::Runtime;
use unimock::{MockFn, Unimock, matching};

use crate::test_server::BoundListener;

use super::super::build_provider::{RecordedBuildProviders, RunMode};
use super::super::harness_settings::settings_url;
use super::{ADDRESS_FILE, PENDING_ADDRESS_FILE};

/// Child entry point selected by the parent's test binary invocation.
#[test]
fn serve_replica_process() {
    let Ok(database) = env::var("MKC_BUILD_REPLICA_DATABASE") else {
        return;
    };
    let root = PathBuf::from(env::var_os("MKC_BUILD_REPLICA_DIRECTORY").unwrap());
    let listener = BoundListener::bind();
    let github = RecordedGitHub::start("127.0.0.1:0".parse().unwrap()).unwrap();
    {
        let mut mode = github.mode.lock().unwrap();
        mode.exact_branch_reads = true;
        mode.head_sha = Some("f".repeat(40));
    }
    let backend = Unimock::new(
        SandboxLifecycleMock::list_managed_sandboxes
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Vec::new())),
    );
    let app = ConfiguredApplicationFactory {
        builds: Arc::new(RecordedBuildProviders {
            mode: RunMode::Wait,
            runs: Arc::new(Mutex::new(Vec::new())),
            backend: backend.clone(),
            publish_signals: None,
        }),
        github: Arc::new(SystemGitHubProviderFactory),
        billing: Arc::new(SystemBillingProviderFactory),
        runtime: Arc::new(mkc_auth::runtime::SystemRuntime),
        ..Default::default()
    }
    .create(settings_url(
        &database,
        "build-replica",
        listener.address,
        true,
        &github.origin,
    ))
    .unwrap();
    fs::write(
        root.join(PENDING_ADDRESS_FILE),
        listener.address.to_string(),
    )
    .unwrap();
    fs::rename(root.join(PENDING_ADDRESS_FILE), root.join(ADDRESS_FILE)).unwrap();
    let runtime = Runtime::new().unwrap();
    runtime.block_on(async {
        let listener = listener.into_tokio();
        tokio::select! {
            result = app.serve_on(listener) => result.unwrap(),
            _ = async {
                while !root.join("stop").exists() {
                    tokio::time::sleep(Duration::from_millis(25)).await;
                }
            } => {}
        }
    });
    runtime.shutdown_timeout(Duration::from_secs(10));
}
