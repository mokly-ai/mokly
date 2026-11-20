//! Separate API and loopback publication-release listeners for one browser test.

use std::fs;
use std::mem::take;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, post};
use clap::Parser;
use mkc_api::application::{ApplicationFactory, ConfiguredApplicationFactory};
use mkc_config::builds::BuildSettings;
use mkc_config::settings::{ConfigProvider, EnvironmentConfig, ProcessEnvironment};
use sandbox_interface::SandboxBackendMock;
use tokio::net::TcpListener;
use tokio::runtime::Runtime;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use super::build_provider::{PublishSignals, RecordedBuildProviders, RunMode};

#[derive(Parser)]
struct Arguments {
    #[arg(long)]
    control_address_file: PathBuf,
}

pub(super) fn run() {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter("info")
        .init();
    let arguments = Arguments::parse();
    let mut settings = EnvironmentConfig {
        environment: Arc::new(ProcessEnvironment),
    }
    .load()
    .unwrap();
    settings.builds = Some(BuildSettings {
        api_key: "unused-browser-fixture-key".into(),
        template: "unused-browser-fixture-template".into(),
        deployment_id: "browser-fixture".into(),
        denied_destinations: Vec::new(),
        per_process: 4,
    });
    let signals = Arc::new(Mutex::new(Default::default()));
    let backend = Unimock::new(
        SandboxBackendMock::list_managed_sandboxes
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Vec::new())),
    );
    let factory = ConfiguredApplicationFactory {
        builds: Arc::new(RecordedBuildProviders {
            mode: RunMode::Publish,
            runs: Arc::new(Mutex::new(Vec::new())),
            backend,
            publish_signals: Some(signals.clone()),
        }),
        ..Default::default()
    };
    let bind = settings.bind;
    let app = factory.create(settings).unwrap();
    Runtime::new().unwrap().block_on(async move {
        let listener = TcpListener::bind(bind).await.unwrap();
        let control = TcpListener::bind("127.0.0.1:0").await.unwrap();
        fs::write(
            arguments.control_address_file,
            format!("http://{}", control.local_addr().unwrap()),
        )
        .unwrap();
        let router = Router::new()
            .route("/publish", delete(release_all))
            .route("/publish/{build}", post(release))
            .with_state(signals);
        tokio::select! {
            result = app.serve_on(listener) => result.unwrap(),
            result = axum::serve(control, router) => result.unwrap(),
        }
    });
}

async fn release_all(State(signals): State<PublishSignals>) -> StatusCode {
    for signal in take(&mut *signals.lock().unwrap()).into_values() {
        signal.notify_one();
    }
    StatusCode::NO_CONTENT
}

async fn release(State(signals): State<PublishSignals>, Path(build): Path<Uuid>) -> StatusCode {
    let signal = signals.lock().unwrap().remove(&build);
    match signal {
        Some(signal) => {
            signal.notify_one();
            StatusCode::NO_CONTENT
        }
        None => StatusCode::NOT_FOUND,
    }
}
