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
            dependency_roots: vec![
                "node_modules/.mokly-roots/1".into(),
                "node_modules/.mokly-roots/2".into(),
            ],
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
        "node_modules/.mokly-roots/1/theme/skin.css",
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
fn alias_fallback_uses_selected_dependency_roots_in_order() {
    for (files, expected) in [
        (
            vec![
                "node_modules/.mokly-roots/1/theme/skin.css",
                "node_modules/.mokly-roots/2/theme/skin.css",
            ],
            "node_modules/.mokly-roots/1/theme/skin.css",
        ),
        (
            vec!["node_modules/.mokly-roots/2/theme/skin.css"],
            "node_modules/.mokly-roots/2/theme/skin.css",
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

#[test]
fn aliases_apply_one_substitution_instead_of_following_a_chain() {
    let mut resolver = resolver(&[
        "apps/web/node_modules/b/skin.css",
        "apps/web/node_modules/c/skin.css",
    ]);
    resolver.settings.aliases =
        BTreeMap::from([("a".into(), "b".into()), ("b".into(), "c".into())]);
    assert_eq!(
        resolver.resolve("styles/entry.css", "a/skin.css").unwrap(),
        "apps/web/node_modules/b/skin.css"
    );
}

#[test]
fn a_self_extending_alias_uses_the_longest_key_once() {
    let mut resolver = resolver(&["apps/web/node_modules/@acme/ui/design/src/tokens.css"]);
    resolver.settings.aliases = BTreeMap::from([
        ("@acme/ui".into(), "wrong".into()),
        ("@acme/ui/design".into(), "@acme/ui/design/src".into()),
    ]);
    assert_eq!(
        resolver
            .resolve("styles/entry.css", "@acme/ui/design/tokens.css")
            .unwrap(),
        "apps/web/node_modules/@acme/ui/design/src/tokens.css"
    );
}

#[test]
fn plain_bare_imports_try_the_stylesheet_directory_before_packages() {
    let resolver = SourceResolver {
        tree: Arc::new(Unimock::new(
            SourceTreeMock::project
                .next_call(matching!(_))
                .returns(Ok(Some(Node {
                    identity: PathBuf::from("/repo").join("styles/theme/skin.css"),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))),
        )),
        repo_root: "/repo".into(),
        settings: Resolution::default(),
    };
    assert_eq!(
        resolver
            .resolve("styles/entry.css", "theme/skin.css")
            .unwrap(),
        "styles/theme/skin.css"
    );
}
