//! Stylesheet rules use one compiled POSIX matcher set for every view.

use std::collections::BTreeMap;
use std::fs;

use mokly_graph::delivery_inputs::DeliveryInputs;

use tempfile::TempDir;

mod support;

#[test]
fn single_stars_stop_at_separators_and_double_stars_match_nested_entries() {
    let root = TempDir::new().unwrap();
    fs::create_dir_all(root.path().join("specs/account/settings")).unwrap();
    fs::create_dir_all(root.path().join("css")).unwrap();
    fs::write(root.path().join("mokly.config.json"), r#"{"stylesheets":[{"match":"account/*","stylesheets":["css/root.css"]},{"match":"account/*/index.html","stylesheets":["css/account.css"]},{"match":"**","stylesheets":["css/fallback.css"]}]}"#).unwrap();
    for path in [
        "specs/account/index.screen.html",
        "specs/account/home.screen.html",
        "specs/account/settings/profile.screen.html",
    ] {
        fs::write(
            root.path().join(path),
            "---\ntitle: Entry\n---\n<p>Entry</p>",
        )
        .unwrap();
    }
    for path in ["css/root.css", "css/account.css", "css/fallback.css"] {
        fs::write(root.path().join(path), "p { color: red }").unwrap();
    }
    let generation = support::prepare(root.path(), 8 * 1024 * 1024, 2).0.unwrap();
    for (route, chosen) in [
        ("account/index.mobile.html", "root.css"),
        ("account/home/index.mobile.html", "account.css"),
        ("account/settings/profile/index.mobile.html", "fallback.css"),
    ] {
        let plan = &generation.plans()[route];
        assert_eq!(plan.stylesheets.len(), 1);
        assert!(plan.stylesheets[0].ends_with(chosen));
        let html = String::from_utf8(generation.render(route).unwrap().bytes.clone()).unwrap();
        assert!(html.contains(&plan.stylesheets[0]));
    }
}

#[test]
fn parent_segments_inside_the_repository_share_normalized_stylesheet_routes() {
    let root = TempDir::new().unwrap();
    for directory in ["nested", "specs", "css"] {
        fs::create_dir(root.path().join(directory)).unwrap();
    }
    fs::write(root.path().join("nested/mokly.config.json"), r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"colorSchemes":["light","dark"],"stylesheets":[{"match":"**","stylesheets":["../css/base.css"],"lightStylesheets":["../css/./light.css"],"darkStylesheets":["../css/../css/dark.css"]}]}"#).unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<ui-card></ui-card>",
    )
    .unwrap();
    fs::write(
        root.path().join("specs/card.component.html"),
        "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nprops: {}\n---\n<p>Card</p>",
    )
    .unwrap();
    for file in ["base", "light", "dark", "component"] {
        fs::write(
            root.path().join(format!("css/{file}.css")),
            "p { color: red }",
        )
        .unwrap();
    }
    let generation = support::prepare_with_inputs(
        &root.path().join("nested"),
        8 * 1024 * 1024,
        2,
        DeliveryInputs {
            component_stylesheets: BTreeMap::from([(
                "card".into(),
                vec!["../css/component.css".into()],
            )]),
            ..Default::default()
        },
    )
    .0
    .unwrap();
    for (route, scheme) in [
        ("home/index.mobile.html", "light"),
        ("home/index.mobile.dark.html", "dark"),
    ] {
        let plan = &generation.plans()[route];
        assert_eq!(
            plan.stylesheets,
            ["base", "component", scheme].map(|file| format!("../styles/css/{file}.css"))
        );
        let html = String::from_utf8(generation.render(route).unwrap().bytes.clone()).unwrap();
        for link in &plan.stylesheets {
            assert!(html.contains(link), "{html}");
        }
    }
    for file in ["base", "light", "dark", "component"] {
        assert!(
            generation
                .resource_routes()
                .contains(&format!("styles/css/{file}.css"))
        );
    }
}
