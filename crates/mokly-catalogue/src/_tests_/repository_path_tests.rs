//! Config-relative values name one repository path under every spelling.

use crate::config_types::{Config, ResolvedConfig};

fn config(file: &str, input: Config) -> ResolvedConfig {
    ResolvedConfig {
        input,
        file: file.into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    }
}

#[test]
fn a_nested_configuration_resolves_every_spelling_to_one_repository_path() {
    let config = config("/repo/tools/mokly.config.json", Config::default());
    for (value, expected) in [
        ("../x", Some("x")),
        ("a/../x", Some("tools/x")),
        ("a/./x", Some("tools/a/x")),
        ("a//x", Some("tools/a/x")),
        ("./x", Some("tools/x")),
        ("x/", Some("tools/x")),
        (".", Some("tools")),
        ("..", Some("")),
        ("../../outside", None),
    ] {
        assert_eq!(
            config.repository_path(value).as_deref(),
            expected,
            "{value}"
        );
    }
}

#[test]
fn a_root_configuration_removes_dot_and_empty_segments() {
    let config = config("/repo/mokly.config.json", Config::default());
    for (value, expected) in [
        ("app/../renderer.tsx", "renderer.tsx"),
        ("lib/./renderer.tsx", "lib/renderer.tsx"),
        ("lib//renderer.tsx", "lib/renderer.tsx"),
        ("./renderer.tsx", "renderer.tsx"),
    ] {
        assert_eq!(
            config.repository_path(value).as_deref(),
            Some(expected),
            "{value}"
        );
    }
}

#[test]
fn the_renderer_and_postcss_accessors_resolve_their_fields() {
    let resolved = config(
        "/repo/app/mokly.config.json",
        Config {
            renderer: Some("../renderer.tsx".into()),
            postcss: Some("../tools/../postcss.mjs".into()),
            ..Default::default()
        },
    );
    assert_eq!(resolved.renderer().as_deref(), Some("renderer.tsx"));
    assert_eq!(resolved.postcss().as_deref(), Some("postcss.mjs"));
    let unset = config("/repo/app/mokly.config.json", Config::default());
    assert_eq!((unset.renderer(), unset.postcss()), (None, None));
}
