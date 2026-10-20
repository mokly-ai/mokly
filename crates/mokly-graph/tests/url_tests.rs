//! Scheme detection does not reject query or fragment colons in composed documents.

use std::collections::BTreeSet;
use std::fs;

use mokly_model::material::digest;
use tempfile::TempDir;

mod support;

#[test]
fn composed_resource_urls_reject_escapes_encoded_separators_and_invalid_encoding() {
    for (reference, reason) in [
        ("../../../outside.svg", "unsafe or escaping URL"),
        (
            "../../assets%2Fpixel.svg",
            "encoded separator or unsafe path",
        ),
        ("../../assets/%ZZ.svg", "malformed URL encoding"),
    ] {
        let root = TempDir::new().unwrap();
        fs::create_dir(root.path().join("specs")).unwrap();
        fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
        fs::write(
            root.path().join("specs/home.screen.html"),
            "---\ntitle: Home\n---\n<ui-image></ui-image>",
        )
        .unwrap();
        fs::write(root.path().join("specs/image.component.html"), format!("---\ntitle: Image\nelement: ui-image\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\n---\n<img src=\"{reference}\">" )).unwrap();
        let generation = support::prepare(root.path(), 1024 * 1024, 1).0.unwrap();
        let error = generation
            .closure("home/index.mobile.html")
            .unwrap_err()
            .to_string();
        assert!(error.contains("home/index.mobile.html"), "{error}");
        assert!(error.contains(reference), "{error}");
        assert!(error.contains(reason), "{error}");
    }
}

#[test]
fn query_and_fragment_colons_survive_rendering_and_the_public_closure() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::create_dir(root.path().join("assets")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(root.path().join("assets/pixel.svg"), "<svg></svg>").unwrap();
    fs::write(root.path().join("specs/home.screen.html"), "---\ntitle: Home\n---\n<h3 id=\"x:y\">X</h3><a href=\"#x:y\">Fragment</a><a href=\"?t=10:30\">Query</a><img src=\"../../assets/pixel.svg?t=10:30\"><a href=\"https://example.com:8443/path?q=x:y#z:w\">External</a>").unwrap();
    let generation = support::prepare(root.path(), 8 * 1024 * 1024, 1).0.unwrap();
    generation.render_all().unwrap();
    let artifact = generation.render("home/index.mobile.html").unwrap();
    let html = String::from_utf8_lossy(&artifact.bytes);
    assert!(html.contains("href=\"#x:y\""));
    assert!(html.contains("href=\"?t=10:30\""));
    assert!(html.contains("src=\"../../assets/pixel.svg?t=10:30\""));
    assert_eq!(
        generation.closure("home/index.mobile.html").unwrap().files,
        BTreeSet::from(["assets/pixel.svg".into()])
    );
}

#[test]
fn embedded_catalogue_documents_have_the_same_bytes_and_digest_as_their_views() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    for (name, target) in [("host", "child"), ("child", "host")] {
        fs::write(
            root.path().join(format!("specs/{name}.screen.html")),
            format!(
                "---\ntitle: {name}\n---\n<h1>{name}</h1><iframe src=\"../{target}/index.mobile.html\"></iframe>"
            ),
        )
        .unwrap();
    }
    let generation = support::prepare(root.path(), 0, 1).0.unwrap();
    generation.render_all().unwrap();
    for name in ["host", "child"] {
        let route = format!("{name}/index.mobile.html");
        let resource = format!("static/mokly-generated/{route}");
        let document = generation.render(&route).unwrap();
        assert_eq!(
            generation.resource_bytes(&resource).unwrap(),
            Some(document.bytes.clone())
        );
        assert_eq!(
            generation.resource_digest(&resource).unwrap(),
            Some(digest(&document.bytes))
        );
        assert!(generation.closure(&route).unwrap().files.is_empty());
    }
    assert!(
        generation
            .resource_bytes("static/mokly-generated/missing/index.mobile.html")
            .unwrap()
            .is_none()
    );
}
