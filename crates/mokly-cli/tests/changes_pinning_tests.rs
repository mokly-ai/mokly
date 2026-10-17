//! Rendering can move a ref without changing the comparison's pinned base.

use std::fs;
use std::path::Path;

mod changes_support;
use changes_support::{base, git, run, write};

#[test]
fn comparison_keeps_the_commit_selected_before_current_render_callbacks() {
    let root = base(&[(
        "specs/home.page.html",
        "---\ntitle: Home\n---\n<!doctype html><html><head><title>Home</title></head><body>Before</body></html>",
    )]);
    git(root.path(), &["checkout", "-b", "head"]);
    fs::remove_file(root.path().join("specs/home.page.html")).unwrap();
    write(
        root.path(),
        "specs/home.mockup.ts",
        r#"
import {execFileSync} from 'node:child_process';
import {definePage} from '@mokly/mokly';
export default definePage({title:'Home',description:'',relatedDocs:[],render(){
  execFileSync('git',['update-ref','refs/heads/fixture-base','HEAD']);
  return '<!doctype html><html><head><title>Home</title></head><body>After</body></html>';
}});
"#,
    );
    git(root.path(), &["add", "."]);
    git(
        root.path(),
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.test",
            "commit",
            "-m",
            "head",
        ],
    );
    let modules = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../node_modules");
    #[cfg(unix)]
    std::os::unix::fs::symlink(modules, root.path().join("node_modules")).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(modules, root.path().join("node_modules")).unwrap();
    let result = run(root.path(), &["build"]);
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(
        String::from_utf8_lossy(&result.stdout).contains("Changes ready · 1 change"),
        "{}",
        String::from_utf8_lossy(&result.stdout)
    );
    git(
        root.path(),
        &["diff", "--exit-code", "fixture-base", "HEAD"],
    );
}

#[test]
fn base_lookup_emits_one_span_before_rendering_on_success_or_failure() {
    for (reference, status) in [("fixture-base", "ok"), ("missing-ref", "error")] {
        let root = base(&[(
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<h1>Home</h1>",
        )]);
        let result = run(
            root.path(),
            &["build", "--base", reference, "--debug-timings"],
        );
        assert_eq!(result.status.success(), status == "ok");
        let stderr = String::from_utf8(result.stderr).unwrap();
        let records: Vec<serde_json::Value> = stderr
            .lines()
            .filter_map(|line| line.strip_prefix("[mokly:timing] "))
            .map(|json| serde_json::from_str(json).unwrap())
            .collect();
        let lookup: Vec<_> = records
            .iter()
            .enumerate()
            .filter(|(_, record)| record["stage"] == "review.base-commit")
            .collect();
        assert_eq!(lookup.len(), 2, "{stderr}");
        assert_eq!(lookup[0].1["event"], "start");
        assert_eq!(lookup[1].1["event"], "end");
        assert_eq!(lookup[0].1["id"], lookup[1].1["id"]);
        assert_eq!(lookup[1].1["status"], status);
        let rendering: Vec<_> = records
            .iter()
            .enumerate()
            .filter(|(_, record)| record["stage"] == "render.document")
            .collect();
        if status == "ok" {
            assert!(!rendering.is_empty(), "{stderr}");
            assert!(rendering.iter().all(|(index, _)| *index > lookup[1].0));
        } else {
            assert!(rendering.is_empty(), "{stderr}");
            assert_eq!(stderr.matches("[mokly/git-failed]").count(), 1);
        }
    }
}
