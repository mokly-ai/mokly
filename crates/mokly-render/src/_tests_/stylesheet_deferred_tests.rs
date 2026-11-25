//! The production plain-CSS fork buffers real SideTree reads, including partial failures.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_css::error::{CssError, TransformFailure};
use mokly_css::resolution::Resolution;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::dependency_usage::{DependencyUsage, UsedDependencies};
use crate::side::SideInputs;
use crate::sources::SideTree;
use crate::stylesheet_compiler::{CapturingCompiler, RootCompiler};

#[test]
fn plain_forks_defer_real_dependency_reads_on_success_and_partial_failure() {
    for (css, expected_error) in [
        (".x {}", None),
        (
            ".x {} @import './later.css';",
            Some(TransformFailure::LateImport),
        ),
    ] {
        let usage = Arc::new(UsedDependencies::default());
        let sources = Arc::new(SideTree {
            _base: None,
            sources: Arc::new(Unimock::new(())),
            dependencies: Arc::new(Unimock::new((
                SourceTreeMock::project.each_call(matching!(_)).answers(&|_, path| {
                    let kind = if path.extension().is_some() { FileKind::File } else { FileKind::Directory };
                    Ok(Some(Node { identity: path.into(), lexical_kind: kind, kind }))
                }),
                SourceTreeMock::read.some_call(matching!((path) if *path == Path::new("/deps/node_modules/theme/skin.css"))).returns(Ok(css.as_bytes().to_vec())),
            ))),
            usage: usage.clone(),
            aliases: BTreeMap::from([("node_modules".into(), "node_modules".into())]),
            root: "/repo".into(),
            dependency_roots: vec!["/deps/node_modules".into()],
            repository_roots: vec![],
        });
        let compiler = CapturingCompiler {
            tree: sources.clone(),
            root: "/repo".into(),
            resolution: Resolution::default(),
            postcss: None,
            watch_sources: None,
            side: SideInputs {
                source_root: "/repo".into(),
                repository_roots: vec![],
                module_resolution: Default::default(),
                configuration_directory: ".".into(),
                context: "test".into(),
                dependency_aliases: Default::default(),
                vite_inputs: None,
                dependency_roots: vec![],
            },
            deferred_sources: Some(sources),
        };
        let deferred = compiler.deferred();
        assert!(
            deferred.is_some(),
            "plain CSS must expose an isolated compiler"
        );
        let deferred = deferred.unwrap();
        let root = mokly_css::types::StylesheetRoot {
            path: "node_modules/theme/skin.css".into(),
            stylesheets: vec!["node_modules/theme/skin.css".into()],
            excluded: Default::default(),
            local_css: true,
        };
        let result = deferred.compiler.compile(&root);
        let error = match result {
            Ok(_) => None,
            Err(CssError::Transform { kind, .. }) => Some(kind),
            Err(error) => panic!("unexpected CSS error: {error}"),
        };
        assert_eq!(error, expected_error);
        assert_eq!(usage.directories(), Vec::<String>::new());
        deferred.usage.replay();
        assert_eq!(usage.directories(), ["node_modules"]);
        assert_eq!(usage.unmapped_directories(), Vec::<String>::new());
    }
}
