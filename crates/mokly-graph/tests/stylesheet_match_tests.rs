//! Stylesheet rules use one compiled POSIX matcher set for every view.

use std::fs;

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
