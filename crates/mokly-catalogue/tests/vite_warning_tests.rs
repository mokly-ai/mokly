//! Vite configuration warnings report settings that the adapter replaces.

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use tempfile::TempDir;

#[path = "support/definitions.rs"]
mod definitions;
mod support;

fn prepare_warnings(settings: &str) -> Vec<Warning> {
    let directory = TempDir::new().unwrap();
    let config = format!(r#"{{"repoRoot":"..", "roots":[{{"dir":"../specs"}}], {settings}}}"#);
    support::write(directory.path(), "tools/mokly.json", &config);
    support::write(directory.path(), "tools/postcss.js", "export default {};");
    support::write(directory.path(), "consumer/package.json", "{}");
    support::write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>Home</h1>",
    );
    support::prepare(directory.path(), Some("tools/mokly.json"))
        .unwrap()
        .warnings
}

#[test]
fn explicit_replaced_settings_warn_once_per_field_with_vite() {
    let warnings = prepare_warnings(
        r#"
        "vite": true,
        "postcss": "postcss.js",
        "moduleResolution": {
            "aliases": {},
            "conditions": [],
            "mainFields": [],
            "packageRoots": ["../consumer"],
            "resolveExtensions": []
        }
        "#,
    );
    let expected = [
        "moduleResolution.aliases",
        "moduleResolution.conditions",
        "moduleResolution.mainFields",
        "moduleResolution.resolveExtensions",
        "postcss",
    ]
    .map(|field| Warning {
        code: "vite-replaced-setting",
        subject: WarningSubject::Configuration("tools/mokly.json".into()),
        message: format!(
            "setting \"{field}\" has no effect under the Vite adapter, because the Vite setup replaces it. Remove it, or move it to the Vite setup."
        ),
    });
    assert_eq!(warnings, expected);
}

#[test]
fn vite_warns_once_for_only_replaced_loader_keys_in_sorted_order() {
    let warnings = prepare_warnings(
        r#"
        "vite": {},
        "moduleResolution": {
            "loaders": {".txt": "text", ".css": "empty", ".scss": "empty", ".module.css": "empty", ".bin": "binary"}
        }
        "#,
    );
    assert_eq!(
        warnings,
        [Warning {
            code: "vite-replaced-setting",
            subject: WarningSubject::Configuration("tools/mokly.json".into()),
            message: "setting \"moduleResolution.loaders\" has no effect under the Vite adapter for keys \".bin\", \".scss\", \".txt\", because the Vite setup replaces them. Remove those keys, or move them to the Vite setup.".into(),
        }]
    );
}

#[test]
fn vite_accepts_empty_loader_maps_and_stylesheet_opt_outs_without_warnings() {
    for loaders in ["{}", r#"{".css": "empty", ".module.css": "empty"}"#] {
        let warnings = prepare_warnings(&format!(
            r#""vite": true, "moduleResolution": {{"loaders": {loaders}}}"#
        ));
        assert!(warnings.is_empty(), "{loaders}: {warnings:?}");
    }
}

#[test]
fn esbuild_does_not_warn_about_settings_that_vite_replaces() {
    for (scenario, vite) in [("vite absent", ""), ("vite false", r#""vite": false,"#)] {
        let warnings = prepare_warnings(&format!(
            r#"
            {vite}
            "postcss": "postcss.js",
            "moduleResolution": {{
                "aliases": {{"old": "new"}},
                "conditions": ["development"],
                "loaders": {{".txt": "text"}},
                "mainFields": ["module"],
                "resolveExtensions": [".ts"]
            }}
            "#,
        ));
        assert!(warnings.is_empty(), "{scenario}: {warnings:?}");
    }
}
