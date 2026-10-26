//! One strict static build of a copy of the example catalogue.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use mokly_html::parse;
use mokly_html::tree::Node;
use mokly_test_support::example;
use mokly_test_support::process::Mokly;
use mokly_test_support::readers;
use serde_json::Value;
use tempfile::TempDir;

/// One rendered view document of a screen or a component.
pub(super) struct View {
    pub(super) path: String,
    pub(super) kind: &'static str,
    pub(super) viewport: String,
    pub(super) scheme: String,
    /// The view's file below the generated root, as relative links name it.
    pub(super) route: String,
    pub(super) document: Vec<Node>,
}

/// The built example: its index, every visual entry detail, and every view document.
pub(super) struct Catalogue {
    pub(super) index: Value,
    pub(super) details: BTreeMap<String, Value>,
    pub(super) views: Vec<View>,
    _copy: TempDir,
}

/// The view file of `path` for `viewport` and `scheme`.
pub(super) fn route(path: &str, viewport: &str, scheme: &str) -> String {
    let dark = if scheme == "dark" { ".dark" } else { "" };
    format!("{path}/index.{viewport}{dark}.html")
}

/// Build a copy of the example, and read every visual entry and view.
///
/// The copy holds the output, because a build writes only below the example's `repoRoot`.
pub(super) fn build() -> Catalogue {
    let copy = example::copy();
    let output = copy.path().join("out");
    let out = format!("--out={}", output.display());
    let result = Mokly::new(env!("CARGO_BIN_EXE_mokly"))
        .command(
            copy.path(),
            &[
                "build",
                "--config",
                "examples/basic/mokly.config.json",
                "--no-changes",
                "--strict",
                &out,
            ],
            "plain",
        )
        .run();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    let viewer = output.join("mokly-viewer");
    let index = readers::index(&fs::read(viewer.join("index.json")).unwrap());
    let mut details = BTreeMap::new();
    let mut views = Vec::new();
    for (list, kind) in [("screens", "screen"), ("components", "component")] {
        for entry in index[list].as_array().unwrap() {
            let path = entry["path"].as_str().unwrap();
            let detail =
                readers::detail(&fs::read(viewer.join(format!("entries/{path}.json"))).unwrap());
            details.insert(path.to_owned(), detail);
            for view in entry["views"].as_array().unwrap() {
                let viewport = view["viewport"].as_str().unwrap();
                let scheme = view["colorScheme"].as_str().unwrap();
                let route = route(path, viewport, scheme);
                views.push(View {
                    document: document(&output, &route),
                    path: path.to_owned(),
                    kind,
                    viewport: viewport.to_owned(),
                    scheme: scheme.to_owned(),
                    route,
                });
            }
        }
    }
    views.sort_by(|a, b| a.route.cmp(&b.route));
    Catalogue {
        index,
        details,
        views,
        _copy: copy,
    }
}

fn document(output: &Path, route: &str) -> Vec<Node> {
    let html = fs::read_to_string(output.join("static/mokly-generated").join(route)).unwrap();
    parse::document(&html)
}

impl Catalogue {
    /// The views of design entries.
    pub(super) fn design_views(&self) -> impl Iterator<Item = &View> {
        self.views
            .iter()
            .filter(|view| view.path.starts_with("design/"))
    }

    /// The entries of the index lists `lists`.
    pub(super) fn entries(&self, lists: &[&str]) -> Vec<&Value> {
        lists
            .iter()
            .flat_map(|list| self.index[*list].as_array().unwrap())
            .collect()
    }

    /// The ready usage instances of every view of the entry `path`, with each view's viewport.
    pub(super) fn usage(&self, path: &str) -> Vec<(&str, Option<&Vec<Value>>)> {
        self.details[path]["views"]
            .as_array()
            .unwrap()
            .iter()
            .map(|view| {
                let ready = view["usage"]["status"] == "ready";
                let instances = if ready {
                    view["usage"]["instances"].as_array()
                } else {
                    None
                };
                (view["viewport"].as_str().unwrap(), instances)
            })
            .collect()
    }

    /// The design screen and component entries.
    pub(super) fn design_entries(&self) -> Vec<&Value> {
        self.entries(&["screens", "components"])
            .into_iter()
            .filter(|entry| entry["path"].as_str().unwrap().starts_with("design/"))
            .collect()
    }
}
