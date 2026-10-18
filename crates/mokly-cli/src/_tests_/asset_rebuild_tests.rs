//! Stale opaque delivery coalesces a rebuild and respects shutdown.

use std::sync::Arc;

use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_graph::error::GraphError;
use mokly_server::diagnostics::Diagnostics;
use mokly_server::error::ServerError;
use tokio::sync::mpsc;
use unimock::{MockFn, Unimock, matching};

use crate::terminal::TerminalMock;

use super::ServeLines;

#[test]
fn stale_assets_coalesce_one_regeneration_and_shutdown_does_not_request_work() {
    let (rebuild, mut requests) = mpsc::channel(1);
    let cancellation = Arc::new(ServeCancellation::default());
    let reporter = ServeLines {
        rebuild: Some(rebuild),
        cwd: "/repo".into(),
        cancellation: cancellation.clone(),
        terminal: Arc::new(Unimock::new(
            TerminalMock::stderr
                .each_call(matching!(_))
                .returns(())
                .n_times(3),
        )),
        style: Style {
            mode: Mode::Plain,
            color: false,
            ascii: false,
            columns: 80,
        },
        redactor: Arc::new(Redactor::default()),
    };
    let changed = ServerError::Render {
        source: GraphError::InputsChanged {
            path: "/repo/asset.svg".into(),
        },
    };
    reporter.failed(&changed);
    reporter.failed(&changed);
    assert_eq!(requests.try_recv(), Ok(()));
    assert!(requests.try_recv().is_err());
    reporter.failed(&ServerError::InvalidAssets);
    assert!(requests.try_recv().is_err());
    cancellation.interrupt();
    reporter.failed(&changed);
    assert!(requests.try_recv().is_err());
}

#[test]
fn snapshot_asset_failures_name_the_input_and_require_an_explicit_restart() {
    for mode in [Mode::Plain, Mode::Rich] {
        let reporter = ServeLines {
            rebuild: None,
            cwd: "/repo".into(),
            cancellation: Arc::new(ServeCancellation::default()),
            terminal: Arc::new(Unimock::new(
                TerminalMock::stderr
                    .next_call(matching!((text) if text.contains("/repo/asset.svg")
                        && text.contains("Restart Serve or use watching.")))
                    .returns(()),
            )),
            style: Style {
                mode,
                color: false,
                ascii: false,
                columns: 120,
            },
            redactor: Arc::new(Redactor::default()),
        };
        reporter.failed(&ServerError::Render {
            source: GraphError::InputsChanged {
                path: "/repo/asset.svg".into(),
            },
        });
    }
}
