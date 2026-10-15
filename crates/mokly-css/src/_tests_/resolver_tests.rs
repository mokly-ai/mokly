//! Alias lookup keeps the configuration base and package fallback order.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::resolution::Resolution;
use crate::resolver::{ImportResolver, SourceResolver};

fn resolver(files: &[&str]) -> SourceResolver {
    let files: BTreeMap<_, _> = files
        .iter()
        .map(|file| (PathBuf::from("/repo").join(file), b"{}".to_vec()))
        .collect();
    let projection = files.clone();
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                Ok(projection.contains_key(path).then(|| Node {
                    identity: path.into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))
            })),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                Ok(files.get(path).cloned().unwrap_or_default())
            })),
    )));
    SourceResolver {
        tree,
        repo_root: "/repo".into(),
        settings: Resolution {
            config_directory: "apps/web".into(),
            aliases: BTreeMap::from([("theme-alias".into(), "theme".into())]),
            package_roots: vec!["vendor".into()],
            dependency_roots: vec!["node_modules/.mokly-roots/1".into()],
            ..Default::default()
        },
    }
}

#[test]
fn aliases_use_the_configuration_package_and_plain_imports_use_the_importer() {
    let resolver = resolver(&[
        "apps/web/theme/skin.css",
        "apps/web/node_modules/theme/skin.css",
        "styles/node_modules/theme/skin.css",
        "vendor/node_modules/theme/skin.css",
    ]);
    assert_eq!(
        resolver
            .resolve("styles/entry.css", "theme-alias/skin.css")
            .unwrap(),
        "apps/web/node_modules/theme/skin.css"
    );
    assert_eq!(
        resolver
            .resolve("styles/entry.css", "theme/skin.css")
            .unwrap(),
        "styles/node_modules/theme/skin.css"
    );
}

#[test]
fn alias_fallback_uses_package_roots_before_selected_dependency_roots() {
    for (files, expected) in [
        (
            vec![
                "vendor/node_modules/theme/skin.css",
                "node_modules/.mokly-roots/1/theme/skin.css",
            ],
            "vendor/node_modules/theme/skin.css",
        ),
        (
            vec!["node_modules/.mokly-roots/1/theme/skin.css"],
            "node_modules/.mokly-roots/1/theme/skin.css",
        ),
    ] {
        assert_eq!(
            resolver(&files)
                .resolve("styles/entry.css", "theme-alias/skin.css")
                .unwrap(),
            expected
        );
    }
}
