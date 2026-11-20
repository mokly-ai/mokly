//! Optional watch mapping preserves cancellation and required source projection errors.

use std::collections::{BTreeMap, BTreeSet};
use std::io;
use std::path::Path;
use std::sync::Arc;

use mokly_css::error::{CssError, InternalError};
use mokly_css::resolution::Resolution;
use mokly_sidecar::methods::ModuleResolution;
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::side::SideInputs;
use crate::stylesheet_compiler::{CapturingCompiler, RootCompiler};

fn side() -> SideInputs {
    SideInputs {
        source_root: "/repo".into(),
        repository_roots: vec!["/repo".into()],
        module_resolution: ModuleResolution::default(),
        configuration_directory: String::new(),
        context: "head".into(),
        dependency_aliases: BTreeMap::from([("node_modules".into(), "node_modules".into())]),
        dependency_roots: vec!["/repo/node_modules".into()],
    }
}

#[test]
fn both_optional_watch_mapping_stages_preserve_cancellation() {
    for input in ["node_modules/theme/tokens.css", "tokens.css"] {
        let sources = Arc::new(Unimock::new(
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, path| Err(SourceError::Cancelled { path: path.into() })),
        ));
        let compiler: &dyn RootCompiler = &CapturingCompiler {
            tree: Arc::new(Unimock::new(())),
            root: "/repo".into(),
            resolution: Resolution::default(),
            postcss: None,
            watch_sources: Some(sources),
            side: side(),
        };
        let error = compiler
            .watch_files(&BTreeSet::from([input.into()]))
            .unwrap_err();
        let CssError::Internal(InternalError::Provider { source }) = error else {
            panic!("watch cancellation must retain the source error");
        };
        assert!(matches!(
            source.downcast_ref::<SourceError>(),
            Some(SourceError::Cancelled { path }) if path == &Path::new("/repo").join(input)
        ));
    }
}

#[test]
fn required_dependency_source_mapping_keeps_projection_errors() {
    let sources = Unimock::new(SourceTreeMock::project.each_call(matching!(_)).answers(
        &|_, path| {
            Err(SourceError::Io {
                operation: "project",
                path: path.into(),
                source: io::Error::from(io::ErrorKind::PermissionDenied),
            })
        },
    ));
    let error = side()
        .physical_source(
            "node_modules/theme/tokens.css",
            &sources,
            Path::new("/repo"),
        )
        .unwrap_err();
    assert!(matches!(
        error,
        SourceError::Io { source, .. } if source.kind() == io::ErrorKind::PermissionDenied
    ));
}

#[test]
fn escaped_local_candidates_keep_only_the_written_repair_path() {
    let sources = Arc::new(Unimock::new(
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, _| {
                Ok(Some(Node {
                    identity: "/deps/theme/escaped.css".into(),
                    kind: FileKind::File,
                    lexical_kind: FileKind::Symlink,
                }))
            }),
    ));
    let compiler: &dyn RootCompiler = &CapturingCompiler {
        tree: Arc::new(Unimock::new(())),
        root: "/repo".into(),
        resolution: Resolution::default(),
        postcss: None,
        watch_sources: Some(sources),
        side: side(),
    };
    let inputs = compiler
        .watch_files(&BTreeSet::from(["tokens.preferred.css".into()]))
        .unwrap();
    assert_eq!(
        inputs.files,
        BTreeSet::from(["tokens.preferred.css".into()])
    );
    assert_eq!(inputs.dependency_roots, BTreeMap::new());
}
