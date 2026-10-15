//! Evicted stylesheet results replay the sources captured before definition evaluation.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_css::types::StylesheetRoot;
use mokly_graph::cache::MemoryCache;
use mokly_sidecar::definitions::Definitions;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::results::{Bundle, Module};
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::runtime::Runtime;
use crate::stylesheet_cache::StylesheetCache;

#[test]
fn retained_definition_compilers_keep_their_original_bytes_after_cache_eviction() {
    let changed = Arc::new(AtomicBool::new(false));
    let reads = Arc::new(AtomicUsize::new(0));
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    lexical_kind: if path.extension().is_some() {
                        FileKind::File
                    } else {
                        FileKind::Directory
                    },
                    kind: if path.extension().is_some() {
                        FileKind::File
                    } else {
                        FileKind::Directory
                    },
                }))
            }),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let changed = changed.clone();
                let reads = reads.clone();
                move |_, path| {
                    assert_eq!(path, Path::new("/repo/main.css"));
                    reads.fetch_add(1, Ordering::SeqCst);
                    Ok(if changed.load(Ordering::SeqCst) {
                        b"a {color: blue}".to_vec()
                    } else {
                        b"a {color: red}".to_vec()
                    })
                }
            })),
    )));
    let pool = Arc::new(Unimock::new(
        PoolMock::request
            .each_call(matching!(_))
            .answers(&|_, call| {
                Ok(match call {
                    Call::Bundle(_) => MethodResult::Bundle(Bundle {
                        generation: "bundle".into(),
                        warnings: vec![],
                        modules: vec![
                            Module {
                                path: "renderer.tsx".into(),
                                imports: vec!["main.css".into()],
                                digest: Some("source".into()),
                            },
                            Module {
                                path: "main.css".into(),
                                imports: vec![],
                                digest: Some("css".into()),
                            },
                        ],
                    }),
                    Call::CssModules(_) | Call::Dispose(_) => MethodResult::Empty,
                    Call::Describe(_) => MethodResult::Definitions(Definitions {
                        screens: vec![],
                        pages: vec![],
                        use_cases: vec![],
                        folders: vec![],
                        components: vec![],
                        stories: vec![],
                        diagnostics: vec![],
                        warnings: vec![],
                    }),
                    call => panic!("unexpected request {call:?}"),
                })
            }),
    ));
    let mut runtime = Runtime::new(
        tree.clone(),
        tree,
        pool,
        Arc::new(MemoryCache::new(0)),
        Arc::new(Unimock::new(())),
        "test".into(),
        None,
    );
    runtime.styles = Arc::new(Mutex::new(StylesheetCache::new(0)));
    let config = ResolvedConfig {
        input: Config {
            renderer: Some("renderer.tsx".into()),
            ..Default::default()
        },
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: vec![],
        authored_inputs: vec![],
    };
    let provider: &dyn DefinitionProvider = &runtime;
    let described = provider.describe(&config, &[]).unwrap();
    let context = &described.generation.as_ref().unwrap().css_context;
    let lease = runtime
        .prepared
        .lock()
        .unwrap()
        .get(context)
        .unwrap()
        .upgrade()
        .unwrap();
    let root = StylesheetRoot {
        path: "renderer.tsx".into(),
        stylesheets: vec!["main.css".into()],
        excluded: BTreeSet::new(),
        local_css: false,
    };
    let before = lease.compiler.bundle(&root).unwrap();
    changed.store(true, Ordering::SeqCst);
    let after = lease.compiler.bundle(&root).unwrap();
    assert_eq!(before.css, after.css);
    assert_eq!(reads.load(Ordering::SeqCst), 1);
}
