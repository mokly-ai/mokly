//! The static closure keeps public assets and rejects private folders and package payloads.

use std::collections::BTreeMap;
use std::path::Path;

use mokly_test_support::files::{tree, write};
use mokly_test_support::process::Finished;
use mokly_test_support::publication;
use regex::Regex;
use serde_json::json;

use super::support::mokly;

fn built(root: &Path) -> BTreeMap<String, Vec<u8>> {
    let result = mokly()
        .command(
            root,
            &["build", "--no-changes", "--out=.context/site"],
            "plain",
        )
        .run();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    tree(&root.join(".context/site"))
}

fn failing(root: &Path) -> Finished {
    mokly()
        .command(
            root,
            &["build", "--no-changes", "--out=.context/site"],
            "plain",
        )
        .run()
}

fn protected_resource(name: &str, reason: &str) -> String {
    ["desktop", "mobile"]
        .iter()
        .map(|viewport| {
            format!(
                "[mokly/build-invalid] document links and resources are invalid:\\u000a- home/index.{viewport}.html: protected target ../../{name}: {reason}\n"
            )
        })
        .collect()
}

#[test]
fn static_closure_keeps_generated_private_directory_assets_and_external_css_urls_without_stray_files()
 {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    write(
        path,
        "mokly.config.json",
        json!({ "stylesheets": [{ "match": "**", "stylesheets": ["theme.css"] }] }).to_string(),
    );
    let assets = [
        "node_modules/leaflet/dist/a.png",
        "target/b.woff",
        "node_modules/@fontsource/demo/files/font.woff2",
    ];
    for (index, name) in assets.iter().enumerate() {
        write(path, name, [0, 255, index as u8]);
    }
    let mut theme: String = assets
        .iter()
        .enumerate()
        .map(|(index, name)| format!(".image-{index}{{background:url(\"./{name}\")}}"))
        .collect::<Vec<_>>()
        .join("\n");
    theme.push_str(".external{background:url(\"//cdn.example.test/a.png\")}");
    write(path, "theme.css", theme);
    write(path, "mokly-generated/styles/stray.css", ".stray{}");
    let output = built(path);
    for (index, name) in assets.iter().enumerate() {
        let entry = output
            .iter()
            .find(|(file, _)| {
                file.starts_with("static/mokly-generated/assets/") && file.ends_with(name)
            })
            .unwrap_or_else(|| panic!("{name}"));
        assert_eq!(entry.1.as_slice(), [0, 255, index as u8]);
    }
    assert!(output.iter().any(|(name, bytes)| {
        name.ends_with(".css")
            && String::from_utf8_lossy(bytes).contains("//cdn.example.test/a.png")
    }));
    assert!(!output.contains_key("static/theme.css"));
    assert!(
        !output
            .keys()
            .any(|name| name.contains("stray.css") || name.ends_with("home.screen.html"))
    );
}

#[test]
fn imported_and_unused_html_templates_remain_private_while_their_registered_page_is_published() {
    let root = publication::fixture(true, "sha1");
    let path = root.path();
    write(
        path,
        "mokly.config.json",
        json!({ "moduleResolution": { "loaders": { ".html": "text" } } }).to_string(),
    );
    write(
        path,
        "specs/template.html",
        "<!doctype html><html><head><title>Home</title></head><body><h1>Private template content</h1></body></html>",
    );
    write(path, "specs/unused.source.html", "unused private template");
    write(
        path,
        "specs/home.mockup.ts",
        "import {definePage} from '@mokly/mokly'; import template from './template.html'; export default definePage({title:'Home',description:'',relatedDocs:[],render:()=>template});",
    );
    let output = built(path);
    assert!(output.iter().any(|(name, bytes)| {
        name.starts_with("static/mokly-generated/home/")
            && String::from_utf8_lossy(bytes).contains("Private template content")
    }));
    let private = Regex::new(r"template\.html|unused\.source\.html|home\.mockup\.ts$").unwrap();
    assert!(!output.keys().any(|name| private.is_match(name)));
    write(path, "specs/home.mockup.ts", "export const invalid = ;");
    let failed = failing(path);
    assert_eq!(failed.code, Some(1));
    assert!(failed.stderr.contains("Unexpected"));
    assert!(tree(&path.join(".context/site")) == output);
}

#[test]
fn public_closure_rejects_private_folders_and_package_payloads_while_keeping_the_last_output() {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    let previous = built(path);
    let cases: [(&str, &[&str], &str); 4] = [
        (
            "assets/node_modules/private.svg",
            &[],
            "consumer dependency tree",
        ),
        (
            "styles/node_modules/private.css",
            &[],
            "consumer dependency tree",
        ),
        (
            "consumer-package/theme.css",
            &["consumer-package"],
            "private package or output tree",
        ),
        (
            "specs/private.svg",
            &["specs"],
            "private package or output tree",
        ),
    ];
    for (name, roots, reason) in cases {
        let css = name.ends_with(".css");
        write(path, name, if css { "body{color:red}" } else { "<svg/>" });
        for package in roots {
            write(
                path,
                &format!("{package}/package.json"),
                r#"{"name":"private-package"}"#,
            );
        }
        write(
            path,
            "mokly.config.json",
            json!({ "moduleResolution": { "packageRoots": roots } }).to_string(),
        );
        let element = if css {
            format!("<link rel=\"stylesheet\" href=\"../../{name}\">")
        } else {
            format!("<img src=\"../../{name}\">")
        };
        write(
            path,
            "specs/home.screen.html",
            format!("---\ntitle: Home\n---\n{element}"),
        );
        let result = failing(path);
        assert_eq!(result.code, Some(1), "{name}");
        assert_eq!(result.stderr, protected_resource(name, reason));
        assert!(tree(&path.join(".context/site")) == previous, "{name}");
    }
    write(path, "package.json", r#"{"name":"consumer"}"#);
    write(path, "logo.svg", "<svg/>");
    write(
        path,
        "mokly.config.json",
        json!({ "moduleResolution": { "packageRoots": [".", "consumer-package"] } }).to_string(),
    );
    write(
        path,
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<img src=\"../../logo.svg\">",
    );
    let output = built(path);
    assert_eq!(output["static/logo.svg"], b"<svg/>");
    write(
        path,
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<img src=\"../../logo.svg\"><link rel=\"stylesheet\" href=\"../../consumer-package/theme.css\">",
    );
    let nested = failing(path);
    assert_eq!(nested.code, Some(1), "{}", nested.stderr);
    assert_eq!(
        nested.stderr,
        protected_resource(
            "consumer-package/theme.css",
            "private package or output tree"
        )
    );
    assert!(tree(&path.join(".context/site")) == output);
    assert!(
        !output
            .keys()
            .any(|name| name.starts_with("static/consumer-package/"))
    );
}

#[test]
fn portable_entry_names_matching_build_directories_survive_the_static_boundary() {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    let names = [
        "dist",
        "target",
        "build",
        "coverage",
        "mokly-static",
        "test-results",
        "playwright-report",
    ];
    for name in names {
        write(
            path,
            &format!("specs/{name}.screen.html"),
            format!("---\ntitle: {name}\n---\n<h1>{name}</h1>"),
        );
    }
    let output = built(path);
    for name in names {
        assert!(output.contains_key(&format!("view/{name}/index.html")));
        assert!(output.contains_key(&format!("mokly-viewer/entries/{name}.json")));
        assert!(output.contains_key(&format!("static/mokly-generated/{name}/index.desktop.html")));
    }
}
