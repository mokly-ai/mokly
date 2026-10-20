//! Invalid PostCSS paths use the catalogue text before process or file work.

use std::path::{Path, PathBuf};

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::config_postcss;
use crate::config_types::{Config, ResolvedConfig};
use crate::config_validation;
use crate::diagnostic::Code;
use crate::error::CatalogueError;

fn config(path: &str) -> ResolvedConfig {
    ResolvedConfig {
        input: Config {
            postcss: Some(path.into()),
            ..Default::default()
        },
        file: "/repo/nested/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    }
}

fn assert_message(error: CatalogueError, expected: String) {
    let CatalogueError::Config(issue) = error else {
        panic!("{error}")
    };
    assert_eq!(issue.code, Code::ConfigInvalid);
    assert_eq!(issue.message, expected);
}

#[test]
fn empty_and_non_string_postcss_values_use_the_path_diagnostic() {
    for value in [
        json!(""),
        json!(false),
        json!(42),
        json!(null),
        json!([]),
        json!({}),
    ] {
        let display = value
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| value.to_string());
        let error =
            config_validation::parse(&json!({"postcss":value}).to_string(), "mokly.config.json")
                .unwrap_err();
        assert_message(
            error,
            format!(
                "postcss must name a config-relative module inside repoRoot: {display}; choose an existing .ts, .mts, .js, .mjs or .cjs file"
            ),
        );
    }
}

#[test]
fn escaping_paths_and_unsupported_suffixes_fail_without_source_access() {
    for path in [
        "../../outside.mjs",
        "/repo/config.mjs",
        "//host/share/config.mjs",
        "C:/repo/config.mjs",
        "C:config.mjs",
        "bad\\path.mjs",
        "file:config.mjs",
    ] {
        let error = config_postcss::validate(&Unimock::new(()), &config(path)).unwrap_err();
        assert_message(
            error,
            format!(
                "postcss must name a config-relative module inside repoRoot: {path}; choose an existing .ts, .mts, .js, .mjs or .cjs file"
            ),
        );
    }
    let error = config_postcss::validate(&Unimock::new(()), &config("postcss.json")).unwrap_err();
    assert_message(error, "postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: postcss.json".into());
}

#[test]
fn missing_non_file_and_physical_escape_have_the_catalogued_diagnostics() {
    for (node, escaped) in [
        (None, false),
        (
            Some(Node {
                identity: "/repo/postcss.mjs".into(),
                kind: FileKind::Directory,
                lexical_kind: FileKind::Directory,
            }),
            false,
        ),
        (
            Some(Node {
                identity: "/outside/postcss.mjs".into(),
                kind: FileKind::File,
                lexical_kind: FileKind::Symlink,
            }),
            true,
        ),
    ] {
        let tree = Unimock::new(
            SourceTreeMock::project
                .next_call(matching!((path) if *path == Path::new("/repo/postcss.mjs")))
                .returns(Ok(node)),
        );
        let error = config_postcss::validate(&tree, &config("../postcss.mjs")).unwrap_err();
        assert_message(error, if escaped {
            "postcss must name a config-relative module inside repoRoot: ../postcss.mjs; choose an existing .ts, .mts, .js, .mjs or .cjs file"
        } else {
            "postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: ../postcss.mjs"
        }.into());
    }
}

#[test]
fn every_supported_suffix_keeps_both_logical_and_physical_inputs() {
    for suffix in ["ts", "mts", "js", "mjs", "cjs"] {
        let path = format!("../postcss.{suffix}");
        let tree = Unimock::new(SourceTreeMock::project.each_call(matching!(_)).answers(
            &|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    kind: FileKind::File,
                    lexical_kind: FileKind::File,
                }))
            },
        ));
        let paths = config_postcss::validate(&tree, &config(&path)).unwrap();
        assert_eq!(
            paths,
            [
                format!("/repo/postcss.{suffix}"),
                format!("/repo/postcss.{suffix}")
            ]
            .map(PathBuf::from)
        );
    }
}
