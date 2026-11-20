//! Config-relative values name one repository path under every spelling.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::config::{ConfigLoader, Loader};
use crate::config_types::{Config, ResolvedConfig};

fn config(file: &str, input: Config) -> ResolvedConfig {
    ResolvedConfig {
        input,
        file: file.into(),
        repo_root: "/repo".into(),
        modules: Default::default(),
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
fn a_loaded_configuration_resolves_module_paths_and_retains_source_aliases() {
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let (identity, kind) = if path == Path::new("/repo/app/mokly.config.json") {
                    (path.into(), FileKind::File)
                } else if path == Path::new("/repo") || path == Path::new("/repo/specs") {
                    (path.into(), FileKind::Directory)
                } else if path == Path::new("/repo/modules/renderer.tsx") {
                    ("/repo/source/renderer.tsx".into(), FileKind::File)
                } else if path == Path::new("/repo/modules/postcss.mjs") {
                    ("/repo/source/postcss.mjs".into(), FileKind::File)
                } else {
                    return Ok(None);
                };
                Ok(Some(Node {
                    identity,
                    kind,
                    lexical_kind: kind,
                }))
            }),
        SourceTreeMock::read
            .some_call(matching!((path) if *path == Path::new("/repo/app/mokly.config.json")))
            .returns(Ok(br#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"renderer":"../modules/unused/../renderer.tsx","postcss":"../modules/./postcss.mjs"}"#.to_vec())),
    )));
    let loader: &dyn ConfigLoader = &Loader { tree };
    let resolved = loader
        .load(Path::new("/repo"), Some("app/mokly.config.json"))
        .unwrap();
    assert_eq!(resolved.renderer().as_deref(), Some("source/renderer.tsx"));
    assert_eq!(resolved.postcss().as_deref(), Some("source/postcss.mjs"));
    assert_eq!(
        resolved.input.renderer.as_deref(),
        Some("../modules/unused/../renderer.tsx")
    );
    assert_eq!(
        resolved.input.postcss.as_deref(),
        Some("../modules/./postcss.mjs")
    );
    assert_eq!(
        resolved.authored_inputs,
        [
            "/repo/modules/postcss.mjs",
            "/repo/source/postcss.mjs",
            "/repo/modules/renderer.tsx",
            "/repo/source/renderer.tsx",
        ]
        .map(PathBuf::from)
    );
    let unset = config("/repo/app/mokly.config.json", Config::default());
    assert_eq!((unset.renderer(), unset.postcss()), (None, None));
}
