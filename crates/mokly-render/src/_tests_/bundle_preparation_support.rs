//! In-memory source and configuration boundaries for bundle preparation tests.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedModules};
use mokly_model::material::digest;
use mokly_sidecar::definitions::Definitions;
use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

pub(super) fn definitions() -> Definitions {
    Definitions {
        screens: vec![],
        pages: vec![],
        use_cases: vec![],
        folders: vec![],
        components: vec![],
        stories: vec![],
        diagnostics: vec![],
    }
}

pub(super) fn tree(changed: Arc<AtomicBool>) -> Arc<dyn SourceTree> {
    let read = |path: &Path, changed: bool| match path.file_name().unwrap().to_str().unwrap() {
        "theme.module.css" => b".token {color:red}".to_vec(),
        "input.txt" if changed => b"new".to_vec(),
        _ => b"old".to_vec(),
    };
    let content = changed.clone();
    Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let kind = if path == Path::new("/repo") {
                    Some(FileKind::Directory)
                } else if ["theme.module.css", "postcss.mjs", "input.txt"]
                    .iter()
                    .any(|name| path == Path::new("/repo").join(name))
                {
                    Some(FileKind::File)
                } else {
                    None
                };
                Ok(kind.map(|kind| Node {
                    identity: path.into(),
                    lexical_kind: kind,
                    kind,
                }))
            }),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                Ok(read(path, content.load(Ordering::Relaxed)))
            }))
            .at_least_times(0),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                Ok(digest(&read(path, changed.load(Ordering::Relaxed))))
            }))
            .at_least_times(0),
        SourceTreeMock::observe_inputs
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Ok(()))
            .at_least_times(0),
    )))
}

pub(super) fn config(postcss: bool) -> ResolvedConfig {
    ResolvedConfig {
        input: Config {
            renderer: Some("renderer.ts".into()),
            postcss: postcss.then(|| "postcss.mjs".into()),
            ..Default::default()
        },
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        modules: ResolvedModules {
            renderer: Some("renderer.ts".into()),
            postcss: postcss.then(|| "postcss.mjs".into()),
        },
        authored_inputs: vec![],
        roots: vec![],
    }
}
