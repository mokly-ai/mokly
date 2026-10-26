//! Invalid viewer scripts keep their location and fail before consumer rendering.

use std::fs;

use mokly_test_support::files::write;
use mokly_test_support::publication;
use regex::Regex;
use serde_json::json;

use super::support::{mokly, node};

#[test]
fn invalid_viewer_scripts_keep_their_location_and_fail_before_consumer_rendering() {
    let root = publication::fixture(true, "sha1");
    let path = root.path();
    let viewer = path.join(".context/viewer");
    let manifest =
        json!({ "schemaVersion": 1, "modules": ["shell.js", "inspector.js"] }).to_string();
    for (file, content) in [
        ("browser.manifest.json", manifest.as_str()),
        ("browser/inspector.js", "export {};"),
        ("shell.css", ""),
        ("assets/brand.svg", "<svg/>"),
        ("assets/fonts/InterVariable.woff2", ""),
    ] {
        write(&viewer, file, content);
    }
    let source = path.join("specs/home.mockup.ts");
    let original = fs::read(&source).unwrap();
    let cases: [(&[u8], &str); 3] = [
        (&[255], "not UTF-8"),
        (b"\nconst = syntax", r"shell\.js:2:7"),
        (b"import './missing.js'", r"missing\.js"),
    ];
    for (bytes, reason) in cases {
        write(&viewer, "browser/shell.js", bytes);
        let result = mokly()
            .command(path, &["build", "--no-changes"], "plain")
            .env("MOKLY_VIEWER_DIST", &viewer)
            .env("MOKLY_NODE_EXECUTABLE", node())
            .run();
        assert_eq!(result.code, Some(1));
        assert!(
            result.stderr.contains("[mokly/server-failed]"),
            "{}",
            result.stderr
        );
        assert!(result.stderr.contains("mokly-viewer/client/shell.js"));
        assert!(
            Regex::new(reason).unwrap().is_match(&result.stderr),
            "{}",
            result.stderr
        );
        assert!(
            result
                .stderr
                .contains("Build or reinstall the matching @mokly/viewer package")
        );
        assert_eq!(fs::read(&source).unwrap(), original);
        assert!(!path.join("mokly-static").exists());
    }
}
