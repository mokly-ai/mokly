//! The real upload coordinator and rich reporter agree across nonempty and empty re-plans.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_git::command::CancellationMock;
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::repository::Repository;
use mokly_model::output::upload::{BuildInventory, Publication};
use mokly_model::output::validation::digest;
use mokly_publish::exchange::{Client, Exchange};
use mokly_publish::http::{Body, HttpMock, Response, Step};
use mokly_publish::runtime::{self, ClockMock};
use mokly_publish::settings::Settings;
use mokly_publish::snapshot::Prepared;
use mokly_sidecar::process_clock::SystemClock;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::terminal::TerminalMock;

use super::{Lines, State};

fn prepared() -> Prepared {
    let publication = Publication {
        mokly_version: "0.14.0".into(),
        repository: Repository::parse("example.com/team/site").unwrap(),
        branch: "feature".into(),
        head_sha: "a".repeat(40),
        pull_request: None,
    };
    let metadata = publication
        .metadata(&BuildInventory {
            config_path: "mokly.config.json".into(),
            exported_at: "2026-09-26T12:00:00.000Z".into(),
            comparison: None,
        })
        .unwrap();
    let files = [
        ("index.html", "shell"),
        ("404.html", "shell"),
        ("static/one.txt", "one"),
        ("static/copy.txt", "one"),
        ("static/two.txt", "two"),
    ]
    .into_iter()
    .map(|(path, bytes)| File {
        path: path.into(),
        bytes: bytes.as_bytes().to_vec().into(),
    })
    .collect();
    Prepared::new(&Artifact::finalize("/private/site".into(), files, Some(metadata)).unwrap())
        .unwrap()
}

fn response(status: u16) -> Response {
    Response {
        status,
        content_type: Some("application/json".into()),
        retry_after: None,
        body: Body::Bytes(Vec::new().into()),
    }
}

fn plan(missing: BTreeSet<String>) -> Response {
    Response { body: Body::Bytes(serde_json::to_vec(&json!({
        "schemaVersion":1, "upload":{"id":"round","expiresAt":"2099-01-01T00:00:00.000Z"},
        "missing":missing, "blobUrl":"https://example.com/blobs/{sha256}", "completeUrl":"https://example.com/complete"
    })).unwrap().into()), ..response(200) }
}

fn reporter(lines: Arc<Mutex<Vec<String>>>) -> Arc<Lines> {
    let terminal = Arc::new(Unimock::new(
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                lines.lock().unwrap().push(text.into())
            })),
    ));
    let (stop, _) = mpsc::channel();
    Arc::new(Lines {
        clock: Arc::new(SystemClock::new()),
        cwd: "/repo".into(),
        style: Style {
            mode: Mode::Rich,
            color: false,
            ascii: true,
            columns: 200,
        },
        redactor: Arc::new(Redactor::collect(&[], None)),
        terminal,
        state: Arc::new(Mutex::new(State::default())),
        stop,
        timer: Mutex::new(None),
        animate: true,
    })
}

#[tokio::test]
async fn real_exchange_restarts_rich_progress_for_a_different_nonempty_missing_set() {
    exercise(false).await;
}

#[tokio::test]
async fn real_exchange_restores_the_rich_base_label_for_an_empty_replan() {
    exercise(true).await;
}

async fn exercise(empty: bool) {
    let first = plan([digest(b"one"), digest(b"two")].into());
    let second = plan(if empty {
        BTreeSet::new()
    } else {
        [digest(b"shell")].into()
    });
    let first_calls = (
        HttpMock::send
            .next_call(matching!((request,_) if request.step == Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let value = first.clone();
                Box::pin(async { Ok(value) })
            })),
        HttpMock::send
            .next_call(matching!((request,_) if request.step == Step::Blob))
            .answers(&|_, _, _| Box::pin(async { Ok(response(204)) }))
            .n_times(2),
        HttpMock::send
            .next_call(matching!((request,_) if request.step == Step::Complete))
            .answers(&|_, _, _| Box::pin(async { Ok(response(409)) })),
        HttpMock::send
            .next_call(matching!((request,_) if request.step == Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let value = second.clone();
                Box::pin(async { Ok(value) })
            })),
    );
    let last_call = HttpMock::send
        .next_call(matching!((request,_) if request.step == Step::Complete))
        .answers(&|_, _, _| Box::pin(async { Ok(response(201)) }));
    let http = if empty {
        Unimock::new((first_calls, last_call))
    } else {
        Unimock::new((
            first_calls,
            HttpMock::send
                .next_call(matching!((request,_) if request.step == Step::Blob))
                .answers(&|_, _, _| Box::pin(async { Ok(response(204)) })),
            last_call,
        ))
    };
    let captured = Arc::new(Mutex::new(Vec::new()));
    let output = reporter(captured.clone());
    let client: &dyn Exchange = &Client {
        http: Arc::new(http),
        clock: Arc::new(Unimock::new(
            ClockMock::now
                .each_call(matching!())
                .returns(1_790_424_000_000_i64),
        )),
        reporter: output.clone(),
    };
    let cancellation = Unimock::new((
        CancellationMock::is_cancelled
            .each_call(matching!())
            .returns(false),
        runtime::CancellationMock::cancelled
            .each_call(matching!())
            .answers(&|_| Box::pin(std::future::pending())),
    ));
    let receipt = client
        .publish(
            &prepared(),
            &Settings::new("https://example.com/plan", "synthetic".into(), 1).unwrap(),
            &cancellation,
        )
        .await
        .unwrap();
    {
        let lines = captured.lock().unwrap();
        let resets: Vec<_> = lines
            .iter()
            .enumerate()
            .filter(|(_, line)| line.ends_with("Uploading catalogue"))
            .map(|(index, _)| index)
            .collect();
        assert_eq!(resets.len(), 2);
        let first_start = lines
            .iter()
            .position(|line| line.contains("Uploading 1 of 4 files"))
            .unwrap();
        let first_done = lines
            .iter()
            .position(|line| line.contains("Uploading 4 of 4 files"))
            .unwrap();
        assert!(resets[0] < first_start && first_start < first_done && first_done < resets[1]);
        if empty {
            assert_eq!(resets[1] + 1, lines.len());
            assert_eq!(
                output.state.lock().unwrap().label.as_deref(),
                Some("Uploading catalogue")
            );
        } else {
            assert!(lines[resets[1] + 1].contains("Uploading 1 of 3 files"));
            assert!(lines.last().unwrap().contains("Uploading 3 of 3 files"));
        }
    }
    assert_eq!(receipt.uploaded, if empty { 4 } else { 6 });
    assert_eq!(receipt.unchanged, if empty { 2 } else { 0 });
    output.published(&receipt, Duration::ZERO);
    assert!(output.state.lock().unwrap().label.is_none());
}
