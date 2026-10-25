//! An inlining plugin cannot bypass a renderer exclusion through an intermediate file.

use std::collections::BTreeSet;
use std::path::Path;

use mokly_css::resolver::ImportResolverMock;
use mokly_sidecar::methods::ModuleResolution;
use mokly_sidecar::results::{Dependency, DependencyKind};
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::error::RenderError;
use crate::postcss_nested::{Input, validate};
use crate::side::SideInputs;

#[test]
fn nested_exclusions_fail_before_a_missing_plugin_dependency() {
    let mock = Unimock::new((
        ImportResolverMock::resolve
            .next_call(matching!("styles/entry.css", "./middle.css"))
            .returns(Ok("styles/middle.css".into())),
        SourceTreeMock::project
            .next_call(matching!(_))
            .returns(Ok(Some(Node {
                identity: "/repo/styles/middle.css".into(),
                lexical_kind: FileKind::File,
                kind: FileKind::File,
            }))),
        SourceTreeMock::read
            .next_call(matching!(_))
            .returns(Ok(b"@import '../renderer.css';".to_vec())),
        ImportResolverMock::resolve
            .next_call(matching!("styles/middle.css", "../renderer.css"))
            .returns(Ok("renderer.css".into())),
    ));
    let dependencies = ["/repo/missing", "/repo/renderer.css"].map(|path| Dependency {
        kind: DependencyKind::File,
        path: path.into(),
        plugin: Some("inliner".into()),
        glob: None,
    });
    let side = SideInputs {
        dependency_aliases: Default::default(),
        source_root: "/repo".into(),
        repository_roots: vec!["/repo".into()],
        module_resolution: ModuleResolution::default(),
        configuration_directory: String::new(),
        context: "test".into(),
        dependency_roots: Vec::new(),
    };
    let error = validate(&Input {
        tree: &mock,
        sources: &mock,
        resolver: &mock,
        root: Path::new("/repo"),
        side: &side,
        path: "styles/entry.css",
        source: "@import './middle.css';",
        excluded: &BTreeSet::from(["renderer.css".into()]),
        dependencies: &dependencies,
    })
    .unwrap_err();
    assert!(
        matches!(error, RenderError::NestedImport { intermediate, plugin, .. } if intermediate == "styles/middle.css" && plugin == "inliner")
    );
}

#[test]
fn package_exclusions_use_selected_logical_names_before_repository_names() {
    for (physical, logical) in [
        ("/repo/app/node_modules/pkg/x.css", "node_modules/pkg/x.css"),
        (
            "/repo/node_modules/pkg/x.css",
            "node_modules/.mokly-roots/1/pkg/x.css",
        ),
    ] {
        let target = logical.to_owned();
        let mock = Unimock::new((
            ImportResolverMock::resolve
                .next_call(matching!("entry.css", "./middle.css"))
                .returns(Ok("middle.css".into())),
            SourceTreeMock::project
                .next_call(matching!(_))
                .returns(Ok(Some(Node {
                    identity: "/repo/middle.css".into(),
                    kind: FileKind::File,
                    lexical_kind: FileKind::File,
                }))),
            SourceTreeMock::read
                .next_call(matching!(_))
                .returns(Ok(b"@import 'pkg/x.css';".to_vec())),
            ImportResolverMock::resolve
                .next_call(matching!("middle.css", "pkg/x.css"))
                .returns(Ok(target)),
        ));
        let side = SideInputs {
            source_root: "/repo".into(),
            repository_roots: vec!["/repo".into()],
            configuration_directory: "app".into(),
            dependency_roots: vec!["/repo/app/node_modules".into(), "/repo/node_modules".into()],
            dependency_aliases: Default::default(),
            module_resolution: ModuleResolution::default(),
            context: "test".into(),
        };
        let dependencies = [Dependency {
            kind: DependencyKind::File,
            path: physical.into(),
            plugin: Some("inliner".into()),
            glob: None,
        }];
        let error = validate(&Input {
            tree: &mock,
            sources: &mock,
            resolver: &mock,
            root: Path::new("/repo"),
            side: &side,
            path: "entry.css",
            source: "@import './middle.css';",
            excluded: &BTreeSet::from([logical.into()]),
            dependencies: &dependencies,
        })
        .unwrap_err();
        assert!(
            matches!(error, RenderError::NestedImport { excluded, intermediate, .. } if excluded == logical && intermediate == "middle.css")
        );
    }
}
