//! Display normalization, permanent attempt sequences and retained log windows.

use chrono::Utc;
use mkc_store_interface::build_log::NewBuildLogChunk;
use mkc_store_interface::build_state::{BuildState, BuildStep, BuildStream};
use reqwest::Method;

use super::super::harness::Harness;
use super::support::{finish, read, refusal, schedule, start};

#[test]
fn log_windows_normalize_text_complete_only_at_the_end_and_keep_attempt_sequences() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let id = schedule(&app, &project, "logs", 1, None, Utc::now());
    assert_eq!(
        read(&app, project.id, &format!("builds/{id}/log"))["complete"],
        false
    );
    let running = start(&app, project.id, id);
    app.queries(&mut |q| {
        for bytes in [
            b"\x1b[31mhello\x1b[0m\r\nworld\r\t\x00\xff".to_vec(),
            b"second\n".to_vec(),
        ] {
            q.append_build_log(
                id,
                &NewBuildLogChunk {
                    attempt_operation_id: running.attempt_operation_id.unwrap(),
                    step: Some(BuildStep::Publish),
                    stream: BuildStream::Stderr,
                    bytes,
                    created_at: Utc::now(),
                },
            )
            .unwrap();
        }
    });
    finish(&app, project.id, id, BuildState::Failed);
    let first = read(&app, project.id, &format!("builds/{id}/log?limit=1"));
    assert_eq!(first["chunks"][0]["text"], "hello\nworld\n\t�");
    assert_eq!(first["chunks"][0]["attempt"], 1);
    assert_eq!(first["nextAfter"], 1);
    assert_eq!(first["complete"], false);
    let last = read(&app, project.id, &format!("builds/{id}/log?after=1"));
    assert_eq!(last["chunks"][0]["text"], "second\n");
    assert_eq!(last["nextAfter"], 2);
    assert_eq!(last["complete"], true);
    let empty = read(&app, project.id, &format!("builds/{id}/log?after=2"));
    assert_eq!(empty["nextAfter"], 2);
    assert_eq!(empty["complete"], true);
    for query in [
        "after=-1",
        "after=abc",
        "after=1.5",
        "after=9223372036854775808",
        "after=",
        "after=0&after=1",
        "limit=0",
        "limit=101",
        "limit=abc",
        "other=1",
    ] {
        refusal(
            app.request(
                Method::GET,
                &format!("/v1/projects/{}/builds/{id}/log?{query}", project.id),
            )
            .send()
            .unwrap(),
            400,
            "validation-failed",
        );
    }
    let retry_id = schedule(&app, &project, "retry-logs", 2, None, Utc::now());
    let attempt = start(&app, project.id, retry_id);
    app.queries(&mut |q| {
        q.append_build_log(
            retry_id,
            &NewBuildLogChunk {
                attempt_operation_id: attempt.attempt_operation_id.unwrap(),
                step: None,
                stream: BuildStream::System,
                bytes: b"old attempt".to_vec(),
                created_at: Utc::now(),
            },
        )
        .unwrap();
    });
    finish(&app, project.id, retry_id, BuildState::Queued);
    let attempt = start(&app, project.id, retry_id);
    app.queries(&mut |q| {
        q.append_build_log(
            retry_id,
            &NewBuildLogChunk {
                attempt_operation_id: attempt.attempt_operation_id.unwrap(),
                step: None,
                stream: BuildStream::System,
                bytes: b"new attempt".to_vec(),
                created_at: Utc::now(),
            },
        )
        .unwrap();
    });
    let retried = read(&app, project.id, &format!("builds/{retry_id}/log?after=1"));
    assert_eq!(retried["chunks"].as_array().unwrap().len(), 1);
    assert_eq!(retried["chunks"][0]["attempt"], 2);
    assert_eq!(retried["chunks"][0]["sequence"], 2);
}

#[test]
fn log_retention_reports_elision_and_enforces_the_normalized_text_window() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let id = schedule(&app, &project, "bounded-log", 1, None, Utc::now());
    let running = start(&app, project.id, id);
    app.queries(&mut |q| {
        for _ in 0..20 {
            q.append_build_log(
                id,
                &NewBuildLogChunk {
                    attempt_operation_id: running.attempt_operation_id.unwrap(),
                    step: None,
                    stream: BuildStream::Stdout,
                    bytes: vec![0xff; 65_536],
                    created_at: Utc::now(),
                },
            )
            .unwrap();
        }
    });
    finish(&app, project.id, id, BuildState::Failed);
    let mut after = 0;
    let mut sequences = Vec::new();
    loop {
        let window = read(&app, project.id, &format!("builds/{id}/log?after={after}"));
        assert_eq!(window["elision"]["afterSequence"], 4);
        assert_eq!(window["elision"]["bytes"], 4 * 65_536);
        let chunks = window["chunks"].as_array().unwrap();
        assert!(
            chunks
                .iter()
                .map(|c| c["text"].as_str().unwrap().len())
                .sum::<usize>()
                <= 262_144
        );
        sequences.extend(chunks.iter().map(|c| c["sequence"].as_i64().unwrap()));
        after = window["nextAfter"].as_i64().unwrap();
        if window["complete"] == true {
            break;
        }
    }
    assert_eq!(sequences, (1..=4).chain(9..=20).collect::<Vec<_>>());
}
