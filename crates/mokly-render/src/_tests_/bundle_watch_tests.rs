//! Retained JavaScript bundles remap nested installation inputs at delivery.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_catalogue::config_types::{Config, ModuleResolution, ResolvedConfig, ResolvedModules};
use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_model::material::digest;
use mokly_sidecar::compiled::ReuseEvidence;
use mokly_sidecar::definitions::Definitions;
use mokly_sidecar::pool::PoolMock;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::bundle::BundleState;
use crate::input_stamp::InputStamp;
use crate::leases::BundleLease;
use crate::runtime::Runtime;
use crate::{bundle_inputs, render_environment};

#[test]
fn retained_javascript_watch_inputs_follow_nested_installation_retargets() {
    let switched = Arc::new(AtomicBool::new(false));
    let selected = switched.clone();
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                let mut identity = path
                    .strip_prefix("/repo/node_modules")
                    .map(|suffix| {
                        if suffix.as_os_str().is_empty() {
                            Path::new("/deps/node_modules").to_path_buf()
                        } else {
                            Path::new("/deps/node_modules").join(suffix)
                        }
                    })
                    .unwrap_or_else(|_| path.to_path_buf());
                for root in [
                    "/repo/node_modules/outer/node_modules",
                    "/deps/node_modules/outer/node_modules",
                ] {
                    if let Ok(suffix) = path.strip_prefix(root) {
                        let installation = if selected.load(Ordering::SeqCst) {
                            "/nested-two"
                        } else {
                            "/nested-one"
                        };
                        identity = Path::new(installation).join(suffix);
                    }
                }
                Ok(Some(Node {
                    identity,
                    kind: FileKind::Directory,
                    lexical_kind: FileKind::Directory,
                }))
            })),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers(&|_, _| Ok("same".into())),
        SourceTreeMock::children
            .each_call(matching!(_))
            .answers(&|_, _| {
                Ok(vec![Child {
                    name: "index.js".into(),
                    kind: FileKind::File,
                }])
            }),
    )));
    let pool = Arc::new(Unimock::new((
        PoolMock::served_generation
            .each_call(matching!("retained", 1))
            .returns(()),
        PoolMock::release_generation
            .some_call(matching!("retained", 1))
            .returns(()),
    )));
    let runtime = Runtime::new(
        tree.clone(),
        tree,
        Arc::new(Unimock::new(())),
        pool.clone(),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        "test".into(),
        None,
    )
    .with_resolution_watching();
    let config = ResolvedConfig {
        input: Config {
            renderer: Some("renderer.mjs".into()),
            module_resolution: Some(ModuleResolution {
                package_roots: Some(vec!["vendor".into()]),
                ..Default::default()
            }),
            ..Default::default()
        },
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        modules: ResolvedModules {
            renderer: Some("renderer.mjs".into()),
            ..Default::default()
        },
        authored_inputs: vec![],
        roots: vec![],
    };
    let side = runtime.side(&config);
    let params = bundle_inputs::params(&config, &[], &side);
    let settings =
        bundle_inputs::cache_key(&config, &params, &side, runtime.dependency_tree.as_ref())
            .unwrap();
    let bundle = Arc::new(BundleState {
        persistence_identity: None,
        repository: "/repo".into(), settings,
        lease: Arc::new(BundleLease { id: "retained".into(), epoch: 1, pool }),
        class_maps_digest: digest(b"{}"),
        definitions: Definitions { screens: vec![], pages: vec![], use_cases: vec![], folders: vec![], components: vec![], stories: vec![], diagnostics: vec![] },
        modules: BTreeMap::new(), module_digests: BTreeMap::new(),
        render: render_environment::RenderEnvironment::default(),
        stamp: InputStamp {
            files: BTreeMap::from([
                ("/repo/node_modules/outer/node_modules/inner/index.js".into(), Some("same".into())),
                ("/repo/node_modules/.mokly-roots/installed/node_modules/outer/node_modules/inner/package.json".into(), Some("same".into())),
            ]),
            memberships: BTreeMap::from([
                ("/repo/node_modules/outer/node_modules/inner".into(), Some(["index.js".into()].into())),
                ("/repo/node_modules".into(), Some(["index.js".into()].into())),
                ("/repo/node_modules/.mokly-roots/1".into(), Some(["index.js".into()].into())),
            ]),
            ..Default::default()
        },
        toolchain: "fixture".into(), reuse_evidence: Arc::new(ReuseEvidence {
            complete: true, durable: true, uncaptured: None, inputs: BTreeMap::new(),
        }),
    });
    runtime
        .bundles
        .lock()
        .unwrap()
        .insert("retained".into(), Arc::downgrade(&bundle));
    let first = runtime.describe(&config, &[]).unwrap().generation.unwrap();
    assert!(
        first
            .resolution_inputs
            .files
            .contains("/nested-one/inner/index.js"),
        "{:?}",
        first.resolution_inputs.files
    );
    assert_eq!(
        first
            .resolution_inputs
            .dependency_roots
            .get("/nested-one/inner/index.js"),
        Some(&Path::new("/nested-one").to_path_buf())
    );
    assert_eq!(
        first
            .resolution_inputs
            .dependency_roots
            .get("/deps/node_modules/outer/node_modules"),
        Some(&Path::new("/deps/node_modules").to_path_buf()),
        "the nested link must retain its selected outer repair boundary"
    );
    switched.store(true, Ordering::SeqCst);
    let reused = runtime.describe(&config, &[]).unwrap().generation.unwrap();
    assert_eq!(reused.id, first.id);
    for generation in [&first, &reused] {
        assert!(
            !generation
                .resolution_directories
                .contains_key("/deps/node_modules/outer/node_modules")
        );
        for root in ["node_modules", "/deps/node_modules", "vendor/node_modules"] {
            assert!(
                generation.resolution_inputs.files.contains(root),
                "missing bare root {root}"
            );
            assert!(
                generation.resolution_directories.contains_key(root),
                "missing bare directory {root}"
            );
        }
    }
    assert!(
        reused
            .resolution_inputs
            .files
            .contains("/nested-two/inner/index.js")
    );
    assert!(
        reused
            .resolution_inputs
            .files
            .contains("/nested-two/inner/package.json")
    );
    assert!(
        reused
            .resolution_directories
            .contains_key("/nested-two/inner")
    );
    assert_eq!(
        reused
            .resolution_inputs
            .dependency_roots
            .get("/nested-two/inner/index.js"),
        Some(&Path::new("/nested-two").to_path_buf())
    );
    assert!(
        reused
            .resolution_inputs
            .files
            .iter()
            .all(|path| !path.contains(".mokly-roots"))
    );
    assert!(
        !reused
            .resolution_inputs
            .files
            .iter()
            .any(|path| path.starts_with("/nested-one/"))
    );
    assert_eq!(reused.environment, first.environment);
    assert_eq!(reused.resolution_digests, first.resolution_digests);
}
