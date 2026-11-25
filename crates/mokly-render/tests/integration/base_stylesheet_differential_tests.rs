//! Shared and isolated historical compilations deliver identical CSS, assets, and documents.

use std::collections::BTreeMap;
use std::fs;

use mokly_graph::types::RenderGeneration;

use super::base_stylesheet_support::{CSS, Fixture, generation};

const CHANGED: &str = ".changed {\n  --selection: changed;\n}\n";

pub(super) fn assert_base(fixture: &Fixture, expected: &str, misses: &[&str]) {
    let (isolated, isolated_misses) = generation(&fixture.base_runtime(false), &fixture.head);
    let (shared, shared_misses) = generation(&fixture.base_runtime(true), &fixture.head);
    assert_eq!(isolated_misses, ["no-record"]);
    assert_eq!(shared_misses, misses);
    assert_eq!(
        shared.resource("styles/main.css").unwrap().unwrap(),
        expected.as_bytes()
    );
    assert_eq!(resources(shared.as_ref()), resources(isolated.as_ref()));
    assert_eq!(documents(shared.as_ref()), documents(isolated.as_ref()));
}

fn resources(generation: &dyn RenderGeneration) -> BTreeMap<String, Vec<u8>> {
    generation
        .resource_routes()
        .into_iter()
        .map(|route| {
            let bytes = generation.resource(&route).unwrap().unwrap();
            (route, bytes)
        })
        .collect()
}

fn documents(generation: &dyn RenderGeneration) -> BTreeMap<String, Vec<u8>> {
    generation
        .plans()
        .keys()
        .map(|route| {
            (
                route.clone(),
                generation.render(route).unwrap().bytes.clone(),
            )
        })
        .collect()
}

#[test]
fn equal_plain_css_preserves_every_historical_resource_and_document() {
    let fixture = Fixture::new();
    let head = fixture.head.generation(fixture.head.prepare().unwrap());
    assert_eq!(
        head.resource("styles/main.css").unwrap().unwrap(),
        CSS.as_bytes()
    );
    assert_base(&fixture, CSS, &[]);
}

#[test]
fn changed_css_rejects_the_head_record() {
    let fixture = Fixture::new();
    fixture.head.write("tokens.css", CHANGED);
    let head = fixture.head.generation(fixture.head.prepare().unwrap());
    assert_eq!(
        head.resource("styles/main.css").unwrap().unwrap(),
        CHANGED.as_bytes()
    );
    assert_base(&fixture, CSS, &["stamp-mismatch"]);
}

#[test]
fn changed_import_target_rejects_the_head_record() {
    let fixture = Fixture::with_files(&[("other.css", CHANGED)]);
    fixture.head.write("main.css", "@import './other.css';\n");
    let head = fixture.head.generation(fixture.head.prepare().unwrap());
    assert_eq!(
        head.resource("styles/main.css").unwrap().unwrap(),
        CHANGED.as_bytes()
    );
    assert_base(&fixture, CSS, &["stamp-mismatch"]);
}

#[test]
fn changed_url_asset_preserves_the_base_asset_bytes() {
    let fixture = Fixture::with_files(&[
        ("tokens.css", ".asset { background: url('./icon.svg'); }\n"),
        ("icon.svg", "<svg>base</svg>"),
    ]);
    fixture.head.write("icon.svg", "<svg>head</svg>");
    let head = fixture.head.generation(fixture.head.prepare().unwrap());
    assert_eq!(
        head.resource("assets/icon.svg").unwrap().unwrap(),
        b"<svg>head</svg>"
    );
    let expected = ".asset {\n  background: url(\"../assets/icon.svg\");\n}\n";
    assert_base(&fixture, expected, &["stamp-mismatch"]);
    let (base, _) = generation(&fixture.base_runtime(true), &fixture.head);
    assert_eq!(
        base.resource("assets/icon.svg").unwrap().unwrap(),
        b"<svg>base</svg>"
    );
}

#[test]
fn an_earlier_absent_extension_candidate_prevents_head_reuse() {
    let fixture = Fixture::with_files(&[
        (
            "mokly.config.json",
            r#"{"roots":[{"dir":"specs","files":["**/*.screen.html"]}],"moduleResolution":{"resolveExtensions":[".preferred.css",".css"]},"stylesheets":[{"match":"**","stylesheets":["main.css"]}]}"#,
        ),
        ("main.css", "@import './selected';\n"),
        ("selected.preferred.css", CSS),
        ("selected.css", CHANGED),
    ]);
    fs::remove_file(fixture.head.root().join("selected.preferred.css")).unwrap();
    let head = fixture.head.generation(fixture.head.prepare().unwrap());
    assert_eq!(
        head.resource("styles/main.css").unwrap().unwrap(),
        CHANGED.as_bytes()
    );
    assert_base(&fixture, CSS, &["stamp-mismatch"]);
}

#[test]
fn changed_package_entries_and_versions_reject_cached_resolution() {
    for field in ["style", "exports"] {
        let original = match field {
            "exports" => {
                r#"{"name":"fixture-theme","version":"1.0.0","exports":{".":"./before.css"}}"#
            }
            _ => r#"{"name":"fixture-theme","version":"1.0.0","style":"./before.css"}"#,
        };
        let edited = match field {
            "exports" => {
                r#"{"name":"fixture-theme","version":"1.0.0","exports":{".":"./after.css"}}"#
            }
            _ => r#"{"name":"fixture-theme","version":"1.0.0","style":"./after.css"}"#,
        };
        let fixture = Fixture::with_files(&[
            ("main.css", "@import './styles/entry.css';\n"),
            ("styles/entry.css", "@import 'fixture-theme';\n"),
            ("styles/node_modules/fixture-theme/package.json", original),
            ("styles/node_modules/fixture-theme/before.css", CSS),
            ("styles/node_modules/fixture-theme/after.css", CHANGED),
        ]);
        let head = fixture.head.generation(fixture.head.prepare().unwrap());
        assert_eq!(
            head.resource("styles/main.css").unwrap().unwrap(),
            CSS.as_bytes(),
            "{field}"
        );
        fixture
            .head
            .write("styles/node_modules/fixture-theme/package.json", edited);
        assert_base(&fixture, CHANGED, &["stamp-mismatch"]);
    }
}
