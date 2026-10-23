//! Serve dependency warnings follow each accepted generation and cached stylesheet result.

use std::fs;
use std::path::Path;
use std::process::Command;

use super::support::{Serve, write};

fn git(root: &Path, args: &[&str]) {
    let result = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
}

#[tokio::test]
async fn html_dependency_warnings_follow_removed_and_reused_package_stylesheets() {
    let mut serve = Serve::options("", "1", "rich", &|root, _| {
        fs::remove_file(root.join("specs/home.mockup.tsx")).unwrap();
        fs::remove_file(root.join("node_modules")).unwrap();
        fs::create_dir_all(root.join("node_modules/theme")).unwrap();
        write(&root.join("node_modules/theme/theme.css"), ".theme{color:blue}");
        write(&root.join("mokly.config.json"), r#"{"review":{"base":"HEAD"},"stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#);
        write(&root.join("style.css"), "@import 'theme/theme.css';");
        write(&root.join("package-lock.json"), "{\"lockfileVersion\":3}");
        write(&root.join(".gitignore"), "node_modules/\n.fixture-sidecar/\n");
        write(&root.join("specs/home.screen.html"), "---\ntitle: Home\n---\n<p class=theme>Home</p>");
        git(root, &["init", "-q"]);
        git(root, &["config", "user.name", "Fixture"]);
        git(root, &["config", "user.email", "fixture@mokly.invalid"]);
        git(root, &["add", "-A"]);
        git(root, &["commit", "-qm", "base"]);
    }).await;
    serve.listening().await;
    serve.wait_line(0, "Changes ready").await;
    for (file, text, warns) in [
        ("style.css", ".theme{color:blue}", false),
        ("style.css", "@import 'theme/theme.css';", true),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p class=theme>Cached</p>",
            true,
        ),
    ] {
        let start = serve.log_count();
        write(
            &serve.path("package-lock.json"),
            "{\"lockfileVersion\":3,\"name\":\"changed\"}",
        );
        write(&serve.path(file), text);
        serve.wait_line(start, "Changes ready").await;
        let lines = serve
            .lines
            .lock()
            .unwrap()
            .iter()
            .skip(start)
            .cloned()
            .collect::<Vec<_>>();
        assert_eq!(
            lines
                .iter()
                .any(|line| line.contains("Base dependencies differ.")),
            warns,
            "{lines:?}"
        );
    }
    serve.stop().await;
}
