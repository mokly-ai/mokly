//! Alias lookup keeps the configuration base and package fallback order.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::resolution::Resolution;
use crate::resolver::{ImportResolver, SourceResolver};

fn resolver(files: &[&str]) -> SourceResolver {
    resolver_with_files(
        &files.iter().map(|file| (*file, "{}")).collect::<Vec<_>>(),
        None,
    )
}

fn resolver_with_files(files: &[(&str, &str)], link: Option<(&str, &str)>) -> SourceResolver {
    let root = Path::new("/repo");
    let files: BTreeMap<_, _> = files
        .iter()
        .map(|(file, contents)| (root.join(file), contents.as_bytes().to_vec()))
        .collect();
    let projection = files.clone();
    let link = link.map(|(written, target)| (root.join(written), root.join(target)));
    let projected_link = link.clone();
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                let identity = linked(path, projected_link.as_ref());
                let link = projected_link
                    .as_ref()
                    .is_some_and(|(written, _)| written == path);
                let kind = if link {
                    FileKind::Directory
                } else {
                    FileKind::File
                };
                Ok(
                    (link || projection.contains_key(&identity)).then_some(Node {
                        identity,
                        lexical_kind: if link { FileKind::Symlink } else { kind },
                        kind,
                    }),
                )
            })),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                Ok(files
                    .get(&linked(path, link.as_ref()))
                    .cloned()
                    .unwrap_or_default())
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

fn linked(path: &Path, link: Option<&(PathBuf, PathBuf)>) -> PathBuf {
    if let Some((written, target)) = link
        && let Ok(suffix) = path.strip_prefix(written)
    {
        return target.join(suffix);
    }
    path.to_owned()
}

#[test]
fn workspace_style_exports_prefer_source_even_when_the_built_file_exists() {
    let resolver = resolver_with_files(
        &[
            (
                "packages/theme/package.json",
                r#"{"name":"theme","exports":{"./colors":"./dist/skin.css"}}"#,
            ),
            ("packages/theme/dist/skin.css", ".built {}"),
            ("packages/theme/src/skin.css", ".source {}"),
        ],
        Some(("node_modules/theme", "packages/theme")),
    );
    assert_eq!(
        resolver
            .resolve("styles/entry.css", "theme/colors")
            .unwrap(),
        "packages/theme/src/skin.css"
    );
}

#[test]
fn a_workspace_style_field_resolves_when_only_the_configured_sources_exist() {
    let resolver = resolver_with_files(
        &[
            (
                "packages/theme/package.json",
                r#"{"name":"theme","style":"./compiled/skin.css"}"#,
            ),
            (
                "packages/theme/tsconfig.json",
                r#"{"extends":"./layout.json"}"#,
            ),
            (
                "packages/theme/layout.json",
                r#"{"compilerOptions":{"outDir":"compiled","rootDir":"authored"}}"#,
            ),
            ("packages/theme/authored/skin.css", ".source {}"),
        ],
        Some(("node_modules/theme", "packages/theme")),
    );
    assert_eq!(
        resolver.resolve("styles/entry.css", "theme-alias").unwrap(),
        "packages/theme/authored/skin.css"
    );
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

#[test]
fn a_package_uses_its_sibling_before_the_authored_ancestor_copy() {
    for (files, expected) in [
        (
            vec![
                "node_modules/tokens/x.css",
                "node_modules/.mokly-roots/1/tokens/x.css",
            ],
            "node_modules/tokens/x.css",
        ),
        (
            vec![
                "node_modules/theme/node_modules/tokens/x.css",
                "node_modules/tokens/x.css",
            ],
            "node_modules/theme/node_modules/tokens/x.css",
        ),
        (
            vec!["node_modules/.mokly-roots/1/tokens/x.css"],
            "node_modules/.mokly-roots/1/tokens/x.css",
        ),
    ] {
        let mut resolver = resolver(&files);
        resolver.settings.dependency_aliases = [
            ("app/node_modules".into(), "node_modules".into()),
            ("node_modules".into(), "node_modules/.mokly-roots/1".into()),
        ]
        .into();
        assert_eq!(
            resolver
                .resolve("node_modules/theme/skin.css", "tokens/x.css")
                .unwrap(),
            expected
        );
    }
}
