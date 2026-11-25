//! Explicit imported-asset metadata joins graph delivery before document validation.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_css::types::OpaqueAsset;
use mokly_graph::delivery_inputs::{DeliveryInputs, ImportedAsset};
use mokly_graph::error::GraphError;
use mokly_html::diagnostic_code::Code;
use mokly_model::material::digest;
use tempfile::TempDir;

mod support;

fn fixture(body: &str, stylesheet: bool) -> TempDir {
    let directory = TempDir::new().unwrap();
    let root = directory.path();
    fs::create_dir_all(root.join("specs/nested")).unwrap();
    fs::create_dir(root.join("media")).unwrap();
    for name in ["home", "nested/home"] {
        fs::write(
            root.join(format!("specs/{name}.screen.html")),
            format!("---\ntitle: Imported assets\n---\n{body}"),
        )
        .unwrap();
    }
    fs::write(root.join("media/logo.png"), [0, 255, 128, 10]).unwrap();
    fs::write(root.join("media/logo.svg"), b"<svg/>").unwrap();
    fs::write(root.join("media/unused.wav"), b"undecoded media").unwrap();
    fs::write(
        root.join("theme.css"),
        ".logo{background:url('./media/logo.png')}",
    )
    .unwrap();
    let config = if stylesheet {
        serde_json::json!({"stylesheets":[{"match":"**","stylesheets":["theme.css"]}]})
    } else {
        serde_json::json!({})
    };
    fs::write(root.join("mokly.config.json"), config.to_string()).unwrap();
    directory
}

fn inputs(root: &Path) -> DeliveryInputs {
    DeliveryInputs {
        imported_assets: ["media/logo.png", "media/logo.svg", "media/unused.wav"]
            .into_iter()
            .map(|path| ImportedAsset {
                module: "specs/example.mjs".into(),
                asset: OpaqueAsset {
                    path: path.into(),
                    // A temporary folder can lie behind a symbolic link, such as /var on
                    // macOS, and asset delivery opens only canonical sources.
                    source: fs::canonicalize(root.join(path)).unwrap(),
                    digest: digest(&fs::read(root.join(path)).unwrap()),
                    aliases: vec![],
                },
            })
            .collect(),
        ..Default::default()
    }
}

#[test]
fn imported_assets_share_css_routes_deliver_unused_bytes_and_follow_final_references() {
    let directory = fixture(
        concat!(
            "<img src='mokly-asset:[media/logo.png]?scale=2#icon'>",
            "<img srcset='mokly-asset:[media/logo.svg] 1x, mokly-asset:[media/logo.png] 2x'>",
            "<p data-src='mokly-asset:[media/unused.wav]'>asset</p>"
        ),
        true,
    );
    let root = directory.path();
    let (generation, _) = support::prepare_with_inputs(root, 1024 * 1024, 1, inputs(root));
    let generation = generation.unwrap();
    assert_eq!(
        generation.resource_routes(),
        vec![
            "assets/media/logo.png",
            "assets/media/logo.svg",
            "assets/media/unused.wav",
            "styles/theme.css",
        ]
    );
    for (route, prefix) in [
        ("home/index.mobile.html", "../"),
        ("nested/home/index.mobile.html", "../../"),
    ] {
        let document = generation.render(route).unwrap();
        let html = String::from_utf8(document.bytes.clone()).unwrap();
        assert!(html.contains(&format!(
            "src=\"{prefix}assets/media/logo.png?scale=2#icon\""
        )));
        assert!(html.contains(&format!(
            "srcset=\"{prefix}assets/media/logo.svg 1x, {prefix}assets/media/logo.png 2x\""
        )));
        assert!(html.contains(&format!("data-src=\"{prefix}assets/media/unused.wav\"")));
        let closure = generation.closure(route).unwrap();
        let references: Vec<_> = closure
            .evidence
            .iter()
            .map(|item| item.path.as_str())
            .collect();
        assert_eq!(
            references,
            vec![
                "static/mokly-generated/assets/media/logo.png",
                "static/mokly-generated/assets/media/logo.svg",
                "static/mokly-generated/styles/theme.css"
            ]
        );
    }
    for (route, expected) in [
        ("assets/media/logo.png", vec![0, 255, 128, 10]),
        ("assets/media/logo.svg", b"<svg/>".to_vec()),
        ("assets/media/unused.wav", b"undecoded media".to_vec()),
    ] {
        assert_eq!(generation.resource(route).unwrap(), Some(expected.clone()));
        assert_eq!(
            generation
                .resource_digest(&format!("static/mokly-generated/{route}"))
                .unwrap(),
            Some(digest(&expected))
        );
    }
}

#[test]
fn asset_membership_preserves_cached_documents_and_sources_remain_protected() {
    let directory = fixture(
        "<p data-src='mokly-asset:[media/logo.svg]'>Asset</p>",
        false,
    );
    let root = directory.path();
    let (before, cache) = support::prepare(root, 1024 * 1024, 1);
    let before = before.unwrap();
    let route = "home/index.mobile.html";
    let before_document = before.render(route).unwrap();
    let (after, _) = support::prepare_with_cache(root, cache, 1, inputs(root));
    let after = after.unwrap();
    assert_eq!(before.plans()[route].key, after.plans()[route].key);
    assert!(
        String::from_utf8(before_document.bytes.clone())
            .unwrap()
            .contains("data-src=\"../assets/media/logo.svg\"")
    );
    let after_document = after.render(route).unwrap();
    assert!(Arc::ptr_eq(&before_document, &after_document));
    assert!(
        String::from_utf8(after_document.bytes.clone())
            .unwrap()
            .contains("data-src=\"../assets/media/logo.svg\"")
    );
    assert!(
        after
            .catalogue()
            .model
            .sources
            .contains(&"media/logo.svg".into())
    );
    fs::write(
        root.join("specs/home.screen.html"),
        "---\ntitle: Assets\n---\n<img src='../../media/logo.svg'>",
    )
    .unwrap();
    let (protected, _) = support::prepare_with_inputs(root, 1024 * 1024, 1, inputs(root));
    let error = protected.unwrap().render(route).unwrap_err().to_string();
    assert!(error.contains("protected target"), "{error}");
}

#[test]
fn a_hand_written_asset_token_without_an_import_fails_as_a_missing_target() {
    let directory = fixture("<img src='mokly-asset:[media/logo.png]'>", false);
    let (generation, _) = support::prepare(directory.path(), 1024 * 1024, 1);
    let error = generation
        .unwrap()
        .render("home/index.mobile.html")
        .unwrap_err();
    assert!(matches!(&error, GraphError::Attempt { .. }), "{error}");
    let GraphError::Attempt { failures, .. } = error else {
        panic!("wrong error type")
    };
    let [
        GraphError::Invalid {
            code,
            route,
            message,
        },
    ] = failures.as_slice()
    else {
        panic!("wrong closure error: {failures:?}")
    };
    assert_eq!(*code, Code::BuildInvalid);
    assert_eq!(route, "home/index.mobile.html");
    assert_eq!(
        message,
        "document links and resources are invalid:\n- home/index.mobile.html: missing target ../assets/media/logo.png"
    );
}

#[test]
fn page_render_rejects_a_base_that_redirects_an_imported_asset() {
    let directory = fixture("<p>Asset</p>", false);
    let root = directory.path();
    fs::write(
        root.join("specs/asset-page.page.html"),
        concat!(
            "---\ntitle: Asset page\n---\n",
            "<!doctype html><html><head><base href='elsewhere/'></head>",
            "<body><img src='mokly-asset:[media/logo.png]'></body></html>",
        ),
    )
    .unwrap();
    let (generation, _) = support::prepare_with_inputs(root, 1024 * 1024, 1, inputs(root));
    let result = generation.unwrap().render("asset-page/index.html");
    let GraphError::Document { source, .. } = result.unwrap_err() else {
        panic!("expected a page render failure");
    };
    let GraphError::Attempt { failures, .. } = source.as_ref() else {
        panic!("expected a render attempt failure, got {source}");
    };
    assert!(
        matches!(
            failures.as_slice(),
            [GraphError::Invalid { code: Code::BuildInvalid, route, .. }]
                if route == "asset-page/index.html"
        ),
        "{failures:?}"
    );
}

#[test]
fn nonportable_imported_assets_report_build_invalid_and_the_first_importing_module() {
    let directory = fixture("<p>Asset</p>", false);
    let mut delivery = inputs(directory.path());
    let mut imported = delivery.imported_assets.remove(0);
    imported.asset.path = "media/bad name.png".into();
    imported.module = "specs/z.mjs".into();
    let mut first = imported.clone();
    first.module = "specs/a.mjs".into();
    delivery.imported_assets = vec![imported, first];
    let (result, _) = support::prepare_with_inputs(directory.path(), 1024 * 1024, 1, delivery);
    assert!(matches!(
        &result,
        Err(GraphError::Invalid {
            code: Code::BuildInvalid,
            ..
        })
    ));
    let GraphError::Invalid {
        code,
        route,
        message,
    } = result.err().unwrap()
    else {
        panic!("wrong error type")
    };
    assert_eq!(code, Code::BuildInvalid);
    assert_eq!(route, "media/bad name.png");
    assert_eq!(
        message,
        "asset route is not portable: media/bad name.png, imported by specs/a.mjs; rename every path segment to be URL-safe (letters, digits, dot, underscore, tilde or hyphen; @scope only after node_modules; no spaces or device names)"
    );
}

#[test]
fn comparison_generations_keep_their_own_asset_bytes_and_digests() {
    let base = fixture("<img src='mokly-asset:[media/logo.png]'>", false);
    let head = fixture("<img src='mokly-asset:[media/logo.png]'>", false);
    fs::write(head.path().join("media/logo.png"), [1, 255, 128, 10]).unwrap();
    let (before, _) =
        support::prepare_with_inputs(base.path(), 1024 * 1024, 1, inputs(base.path()));
    let (after, _) = support::prepare_with_inputs(head.path(), 1024 * 1024, 1, inputs(head.path()));
    let before = before.unwrap();
    let after = after.unwrap();
    let route = "static/mokly-generated/assets/media/logo.png";
    assert_eq!(
        before.resource_bytes(route).unwrap(),
        Some(vec![0, 255, 128, 10])
    );
    assert_eq!(
        after.resource_bytes(route).unwrap(),
        Some(vec![1, 255, 128, 10])
    );
    assert_ne!(
        before.resource_digest(route).unwrap(),
        after.resource_digest(route).unwrap()
    );
    assert_eq!(
        before.closure("home/index.mobile.html").unwrap().evidence[0].path,
        route
    );
    assert_eq!(
        after.closure("home/index.mobile.html").unwrap().evidence[0].path,
        route
    );
}
