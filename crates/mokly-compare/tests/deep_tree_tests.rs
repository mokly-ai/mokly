//! Two Git commits compare deeply nested pages on an ordinary caller stack.

use std::process::Command;
use std::thread;

use mokly_model::canonical;
use mokly_model::review::{EntryChangeReason, ReviewState};

#[expect(dead_code, reason = "deep fixtures only edit and move pages")]
mod engine_support;

use engine_support::Fixture;

fn page(leaf: &str) -> String {
    format!(
        "---\ntitle: Deep\n---\n<!doctype html><html><head><style>span{{color:red}}</style></head><body>{}<p>Shared first</p><p>Shared second</p><p>{leaf}</p>{}</body></html>",
        "<span>".repeat(20_000),
        "</span>".repeat(20_000),
    )
}

#[test]
fn deep_two_commit_changes_preserve_material_and_move_results() {
    thread::spawn(|| {
        let fixture = Fixture::new(&[
            ("specs/changed.page.html", &page("Before")),
            ("specs/old.page.html", &page("Move before")),
        ]);
        fixture.edit("specs/changed.page.html", &page("After"));
        fixture.relocate("specs/old.page.html", "specs/moved.page.html");
        fixture.edit("specs/moved.page.html", &page("Move after"));
        for args in [
            vec!["add", "."],
            vec![
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@example.test",
                "commit",
                "-m",
                "fixture head",
            ],
        ] {
            let status = Command::new("git")
                .current_dir(fixture.directory.path())
                .args(args)
                .env("GIT_CONFIG_NOSYSTEM", "1")
                .env(
                    "GIT_CONFIG_GLOBAL",
                    if cfg!(windows) { "NUL" } else { "/dev/null" },
                )
                .status()
                .unwrap();
            assert!(status.success());
        }
        let result = fixture.compare().unwrap();
        assert_eq!(result.review.base_commit, fixture.commit.to_string());
        assert_eq!(result.counts.changes, 2);
        assert_eq!(result.counts.moved, 1);
        assert_eq!(result.snapshot.changed_entries, ["changed", "moved"]);
        for path in ["changed", "moved"] {
            let entry = result
                .entries
                .iter()
                .find(|entry| entry.path == path)
                .unwrap();
            assert_eq!(entry.state, ReviewState::Changed);
            assert_eq!(entry.documents.len(), 1);
            assert_eq!(entry.documents[0].state, ReviewState::Changed);
            assert!(entry.reasons.contains(&EntryChangeReason::Material));
            assert_eq!(
                entry.previous_path.as_deref(),
                (path == "moved").then_some("old")
            );
        }
        let review = canonical::to_string(&result.review).unwrap();
        assert_eq!(
            canonical::to_string(&mokly_model::readers::review(&review).unwrap()).unwrap(),
            review
        );
        let snapshot = canonical::to_string(&result.snapshot).unwrap();
        assert_eq!(
            canonical::to_string(&mokly_model::readers::change_snapshot(&snapshot).unwrap())
                .unwrap(),
            snapshot
        );
    })
    .join()
    .unwrap();
}
