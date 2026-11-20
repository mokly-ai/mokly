//! Explicit edit omissions reuse only matching live stamps and follow captured candidates.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedModules};
use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_model::material::digest;
use mokly_sidecar::compiled::{
    CompiledGeneration, PhysicalInput, ReuseEvidence, UncapturedEvidence,
};
use mokly_sidecar::definitions::Definitions;
use mokly_sidecar::methods::{BundleCapture, Call};
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::results;
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::{Child, FileKind, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::bundle::BundleState;
use crate::input_stamp::InputStamp;
use crate::leases::BundleLease;
use crate::physical_inputs::PhysicalInputsMock;
use crate::runtime::Runtime;
use crate::{bundle_inputs, render_environment};

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

fn fresh() -> results::Bundle {
    results::Bundle {
        plan: None,
        generation: "fresh".into(),
        epoch: 9,
        cache: None,
        compile_count: 1,
        modules: vec![],
        unmapped_dependency_directories: None,
        compiled: Arc::new(CompiledGeneration {
            toolchain: "fixture".into(),
            metadata_identity: None,
            reuse_evidence: Arc::new(evidence("captured")),
            identity: "fresh".into(),
            code: String::new(),
            vite: None,
            runtime_key: "fresh".into(),
            dependency_roots: vec![],
            css_modules: vec![],
            sources: BTreeMap::new(),
            peers: BTreeMap::new(),
            inputs: BTreeMap::new(),
            metadata_inputs: BTreeMap::new(),
            input_directories: BTreeMap::new(),
            metadata_directories: BTreeMap::new(),
            unmapped_dependency_directories: None,
        }),
    }
}

fn evidence(kind: &str) -> ReuseEvidence {
    ReuseEvidence {
        complete: kind == "captured",
        durable: kind == "captured",
        uncaptured: (kind == "edit").then_some(UncapturedEvidence::ServeEdit),
        inputs: if kind == "captured" {
            BTreeMap::from([("/outside/config.json".into(), PhysicalInput::Absent)])
        } else {
            BTreeMap::new()
        },
    }
}

pub(super) fn pool(capture: BundleCapture, expected: &str) -> Unimock {
    let release = PoolMock::release_generation
        .each_call(matching!(_, _))
        .returns(());
    if expected == "fresh" {
        Unimock::new((
            release,
            PoolMock::request
                .each_call(matching!(_))
                .answers(&|_, call| {
                    Ok(match call {
                        Call::Bundle(_) => MethodResult::Bundle(Box::new(fresh())),
                        Call::Describe(_) => MethodResult::Definitions(definitions()),
                        Call::CssModules(_) => MethodResult::Empty,
                        _ => panic!("unexpected request"),
                    })
                }),
        ))
    } else if capture == BundleCapture::Full {
        Unimock::new((
            release,
            PoolMock::served_generation
                .some_call(matching!("z-captured", 1))
                .returns(()),
        ))
    } else {
        Unimock::new(release)
    }
}

#[test]
fn edit_reuse_keeps_stamps_and_capture_priority_while_full_reuse_rejects_omissions() {
    for (capture, physical, hash, member, edit_toolchain, expected) in [
        (
            BundleCapture::Full,
            true,
            "source",
            "entry.ts",
            "fixture",
            "z-captured",
        ),
        (
            BundleCapture::ServeEdit,
            true,
            "source",
            "entry.ts",
            "fixture",
            "z-captured",
        ),
        (
            BundleCapture::ServeEdit,
            false,
            "source",
            "entry.ts",
            "fixture",
            "b-edit",
        ),
        (
            BundleCapture::Full,
            false,
            "source",
            "entry.ts",
            "fixture",
            "fresh",
        ),
        (
            BundleCapture::ServeEdit,
            false,
            "source",
            "entry.ts",
            "",
            "fresh",
        ),
        (
            BundleCapture::ServeEdit,
            false,
            "changed",
            "entry.ts",
            "fixture",
            "fresh",
        ),
        (
            BundleCapture::ServeEdit,
            false,
            "source",
            "other.ts",
            "fixture",
            "fresh",
        ),
    ] {
        let digests = SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(hash.into())));
        let listings = SourceTreeMock::children
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(vec![Child {
                    name: member.into(),
                    kind: FileKind::File,
                }])
            }));
        let tree = Arc::new(if hash == "source" {
            Unimock::new((digests, listings))
        } else {
            Unimock::new(digests)
        });
        let reader = if hash == "source" && member == "entry.ts" {
            Unimock::new(
                PhysicalInputsMock::matches
                    .some_call(matching!(_, _))
                    .returns(Ok(physical)),
            )
        } else {
            Unimock::new(())
        };
        let mut runtime = Runtime::new(
            tree,
            Arc::new(Unimock::new(
                SourceTreeMock::project
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok(None)),
            )),
            Arc::new(reader),
            Arc::new(pool(capture, expected)),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            "test".into(),
            None,
        );
        runtime.bundle_capture = capture;
        let config = ResolvedConfig {
            input: Config {
                renderer: Some("renderer.tsx".into()),
                ..Config::default()
            },
            file: "/repo/mokly.config.json".into(),
            repo_root: "/repo".into(),
            modules: ResolvedModules {
                renderer: Some("renderer.tsx".into()),
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
        let retained: Vec<_> = [
            ("a-incomplete", "incomplete"),
            ("b-edit", "edit"),
            ("z-captured", "captured"),
        ]
        .into_iter()
        .map(|(id, kind)| {
            Arc::new(BundleState {
                repository: "/repo".into(),
                settings: settings.clone(),
                lease: Arc::new(BundleLease {
                    id: id.into(),
                    epoch: 1,
                    pool: runtime.pool.clone(),
                }),
                class_maps_digest: digest(b"{}"),
                definitions: definitions(),
                modules: BTreeMap::from([("entry.ts".into(), vec![])]),
                module_digests: BTreeMap::new(),
                render: render_environment::RenderEnvironment::default(),
                stamp: InputStamp {
                    files: BTreeMap::from([("/repo/entry.ts".into(), Some("source".into()))]),
                    memberships: BTreeMap::from([(
                        "/repo/modules".into(),
                        Some(["entry.ts".into()].into()),
                    )]),
                    ..InputStamp::default()
                },
                persistence_identity: (kind == "captured").then(|| "captured-build".into()),
                toolchain: if kind == "edit" {
                    edit_toolchain.into()
                } else {
                    "fixture".into()
                },
                reuse_evidence: Arc::new(evidence(kind)),
            })
        })
        .collect();
        for state in &retained {
            runtime
                .bundles
                .lock()
                .unwrap()
                .insert(state.lease.id.clone(), Arc::downgrade(state));
        }
        let described = runtime.describe(&config, &[]).unwrap();
        let generation = described.generation.unwrap();
        assert_eq!(
            generation.persistence_identity.as_deref(),
            (expected == "z-captured").then_some("captured-build")
        );
        assert_eq!(
            generation.id, expected,
            "capture={capture:?}, physical={physical}, hash={hash}, member={member}, toolchain={edit_toolchain}"
        );
    }
}
