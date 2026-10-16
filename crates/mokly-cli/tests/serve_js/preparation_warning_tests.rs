//! Preparation warnings flush before failure and keep their identities through repair.

use std::fs;

use super::support::{Serve, write};

fn source(label: &str, props: &str, invalid: bool) -> String {
    format!(
        "---\ntitle: Home\nprops: {{{props}}}\n---\n<h1>{label}</h1>{}",
        if invalid {
            "<ui-missing></ui-missing>"
        } else {
            ""
        }
    )
}

fn count(serve: &Serve, prop: &str) -> usize {
    let needle = format!("prop \"{prop}\" is not read by the body");
    serve
        .lines
        .lock()
        .unwrap()
        .iter()
        .filter(|line| line.contains(&needle))
        .count()
}

fn edit(serve: &Serve, text: &str) {
    write(&serve.path("specs/edit.tmp"), text);
    fs::rename(
        serve.path("specs/edit.tmp"),
        serve.path("specs/home.screen.html"),
    )
    .unwrap();
}

#[tokio::test]
async fn html_preparation_failure_flushes_once_and_repair_prints_only_new_warnings() {
    for mode in ["plain", "rich"] {
        let mut serve = Serve::options("", "1", mode, &|root, package| {
            fs::remove_file(root.join("specs/home.mockup.tsx")).unwrap();
            write(
                &root.join("specs/home.screen.html"),
                &source("Initial", "alpha: old", false),
            );
            write(
                &package.join("dist/sidecar.js"),
                "process.stderr.write('unexpected-sidecar\\n');process.exit(23);",
            );
        })
        .await;
        serve.listening().await;
        let initial = serve.ready(0, "Initial").await;
        serve.wait_line(0, "prop \"alpha\"").await;
        assert_eq!(count(&serve, "alpha"), 1);
        if mode == "rich" {
            let lines = serve.lines.lock().unwrap();
            assert!(
                lines
                    .iter()
                    .position(|line| line.contains("prop \"alpha\""))
                    .unwrap()
                    < lines
                        .iter()
                        .position(|line| line.contains("Catalogue ready"))
                        .unwrap()
            );
        }
        let marker = serve.log_count();
        edit(&serve, &source("Invalid", "alpha: old, beta: unused", true));
        serve.wait_line(marker, "html-element").await;
        if mode == "rich" {
            serve.wait_line(marker, "The last good catalogue").await;
        }
        assert_eq!(serve.index().await, initial);
        assert!(serve.html().await.contains("Initial"));
        assert_eq!(count(&serve, "alpha"), 2);
        assert_eq!(count(&serve, "beta"), 1);
        {
            let lines = serve.lines.lock().unwrap();
            let failure = lines
                .iter()
                .enumerate()
                .skip(marker)
                .find(|(_, line)| {
                    if mode == "rich" {
                        line.contains('✖')
                    } else {
                        line.starts_with("[mokly/build-invalid]")
                    }
                })
                .unwrap()
                .0;
            for prop in ["alpha", "beta"] {
                let warning = lines
                    .iter()
                    .enumerate()
                    .skip(marker)
                    .find(|(_, line)| line.contains(&format!("prop \"{prop}\"")))
                    .unwrap();
                assert!(warning.0 < failure);
                let prefix = if mode == "plain" {
                    "[mokly/warning]"
                } else {
                    "  !"
                };
                assert_eq!(
                    warning.1.trim_end_matches('\r'),
                    format!("{prefix} entry \"home\": prop \"{prop}\" is not read by the body")
                );
            }
        }
        edit(
            &serve,
            &source("Repaired", "alpha: old, beta: unused, gamma: new", false),
        );
        serve
            .ready(initial["revision"].as_u64().unwrap(), "Repaired")
            .await;
        serve.wait_line(marker, "prop \"gamma\"").await;
        assert_eq!(count(&serve, "alpha"), 2);
        assert_eq!(count(&serve, "beta"), 1);
        assert_eq!(count(&serve, "gamma"), 1);
        // SAFETY: this test owns the live child PID.
        assert_eq!(
            unsafe { libc::kill(serve.child.id().unwrap() as i32, libc::SIGTERM) },
            0
        );
        serve.closed().await;
        assert!(
            !serve
                .lines
                .lock()
                .unwrap()
                .iter()
                .any(|line| line.contains("unexpected-sidecar"))
        );
        assert_eq!(serve.compiles(), 0);
        assert_eq!(serve.evaluations(), 0);
        assert_eq!(count(&serve, "alpha"), 2);
        assert_eq!(count(&serve, "beta"), 1);
        assert_eq!(count(&serve, "gamma"), 1);
    }
}
