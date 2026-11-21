//! Startup preparation keeps full evidence and respects the existing attempt guards.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, Weak};

use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_css::types::StylesheetRoot;
use mokly_model::material::digest;
use mokly_sidecar::methods::BundleCapture::{Full, ServeEdit};
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::postcss_evidence::Evidence;
use mokly_sidecar::results::{Css, Dependency, DependencyKind, Module};
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::bundle::BundleState;
use crate::input_stamp::InputStamp;
use crate::leases::BundleLease;
use crate::physical_inputs::PhysicalInputsMock;
use crate::runtime::Runtime;
use crate::{bundle_inputs, render_environment, stylesheets};

use super::bundle_plan_support::{evidence, plan, result};
use super::bundle_preparation_support::{config, definitions, tree};

#[test]
fn css_before_bundle_and_second_evaluation_never_add_another_preparation() {
    for (css_before_bundle, capture, base, older_head, startup, cached_css, postcss, expected) in [
        (false, ServeEdit, false, false, false, true, true, true),
        (true, ServeEdit, false, false, false, true, true, false),
        (false, Full, false, false, false, true, true, false),
        (false, ServeEdit, true, false, false, true, true, false),
        (false, ServeEdit, false, true, false, true, true, false),
        (false, Full, false, false, true, false, true, true),
        (true, Full, false, false, true, false, true, false),
        (false, Full, true, false, true, false, true, false),
        (false, Full, false, true, true, true, true, false),
        (false, ServeEdit, false, false, false, false, true, false),
        (false, Full, false, false, true, false, false, false),
    ] {
        let changed = Arc::new(AtomicBool::new(false));
        let calls = Arc::new(Mutex::new(Vec::new()));
        let observed = calls.clone();
        let requests = Arc::new(Mutex::new(0));
        let bundled = requests.clone();
        let pool_calls = (
            PoolMock::request
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, call| {
                    observed.lock().unwrap().push(call.clone());
                    Ok(match call {
                        Call::ProcessCss(params) => MethodResult::Css(Css {
                            text: params.text,
                            read_evidence: Evidence {
                                coverage: Default::default(),
                                reads: vec![],
                                modules: vec!["/repo/postcss.mjs".into()],
                            },
                            dependencies: vec![Dependency {
                                kind: DependencyKind::File,
                                path: "/repo/input.txt".into(),
                                plugin: Some("fixture".into()),
                                glob: None,
                            }],
                            unmapped_dependency_directories: None,
                        }),
                        Call::Bundle(_) => {
                            let mut count = bundled.lock().unwrap();
                            *count += 1;
                            let mut reply = result(startup.then(plan), evidence());
                            reply.generation = if *count == 1 { "old" } else { "new" }.into();
                            reply.modules = vec![Module {
                                path: "renderer.ts".into(),
                                imports: vec!["theme.module.css".into()],
                                digest: None,
                            }]
                            .into();
                            MethodResult::Bundle(Box::new(reply))
                        }
                        Call::Describe(_) => MethodResult::Definitions(definitions()),
                        Call::CssModules(_) => MethodResult::Empty,
                        _ => panic!("unexpected call"),
                    })
                })),
            PoolMock::release_generation
                .each_call(matching!(_, _))
                .returns(())
                .at_least_times(0),
        );
        let pool = if postcss {
            Unimock::new((
                pool_calls,
                PoolMock::release_context
                    .each_call(matching!(_))
                    .returns(())
                    .at_least_times(0),
            ))
        } else {
            Unimock::new(pool_calls)
        };
        let mut runtime = Runtime::new(
            tree(changed.clone()),
            Arc::new(Unimock::new(
                SourceTreeMock::project
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok(None)),
            )),
            Arc::new(if css_before_bundle {
                Unimock::new(
                    PhysicalInputsMock::matches
                        .each_call(matching!(_, _))
                        .answers(&|_, _, _| Ok(true))
                        .at_least_times(0),
                )
            } else {
                Unimock::new(())
            }),
            Arc::new(pool),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            "test".into(),
            None,
        );
        runtime.bundle_capture = capture;
        if startup {
            runtime = runtime.with_serve_edit_plans();
        }
        runtime.head_styles = base.then(Weak::new);
        runtime.watch_stylesheets = older_head || startup;
        let config = config(postcss);
        let side = runtime.side(&config);
        let compiler = stylesheets::attempt(&runtime, &config, &side).compiler;
        if cached_css {
            compiler
                .bundle(&StylesheetRoot {
                    path: "theme.module.css".into(),
                    stylesheets: vec!["theme.module.css".into()],
                    excluded: Default::default(),
                    local_css: true,
                })
                .unwrap();
        }
        let params = bundle_inputs::params(&config, &[], &side);
        let previous = result(None, evidence());
        let state = Arc::new(BundleState {
            persistence_identity: None,
            repository: config.repo_root.clone(),
            settings: bundle_inputs::cache_key(
                &config,
                &params,
                &side,
                runtime.dependency_tree.as_ref(),
            )
            .unwrap(),
            lease: Arc::new(BundleLease {
                id: "old".into(),
                epoch: 1,
                pool: runtime.pool.clone(),
            }),
            class_maps_digest: "previous maps".into(),
            definitions: definitions(),
            modules: BTreeMap::from([("renderer.ts".into(), vec!["theme.module.css".into()])]),
            module_digests: BTreeMap::new(),
            render: render_environment::RenderEnvironment::default(),
            stamp: InputStamp {
                files: if css_before_bundle {
                    BTreeMap::new()
                } else {
                    BTreeMap::from([("/repo/input.txt".into(), Some(digest(b"old")))])
                },
                ..Default::default()
            },
            toolchain: "fixture".into(),
            reuse_evidence: previous.compiled.reuse_evidence.clone(),
        });
        runtime
            .bundles
            .lock()
            .unwrap()
            .insert("generation:old".into(), Arc::downgrade(&state));
        changed.store(true, Ordering::Relaxed);
        calls.lock().unwrap().clear();
        let described = runtime.describe(&config, &[]).unwrap();
        let calls = calls.lock().unwrap();
        let preparations: Vec<_> = calls
            .iter()
            .filter_map(|call| match call {
                Call::Bundle(request) => Some(request.preparation.is_some()),
                _ => None,
            })
            .collect();
        assert_eq!(
            preparations,
            [expected, false],
            "capture={capture:?}, base={base}, css_before_bundle={css_before_bundle}, older_head={older_head}, startup={startup}, cached_css={cached_css}, postcss={postcss}"
        );
        for request in calls.iter().filter_map(|call| match call {
            Call::Bundle(request) => Some(request),
            _ => None,
        }) {
            assert_eq!(request.capture, Some(capture));
            let retained = runtime
                .edit_plans
                .as_ref()
                .and_then(|records| records.lock().unwrap().get(&request.params));
            assert_eq!(
                retained.map(|record| (record.plan.clone(), record.evidence.clone())),
                startup.then(|| (plan(), evidence()))
            );
        }
        assert_eq!(
            matches!(calls.first(), Some(Call::ProcessCss(_))),
            css_before_bundle
        );
        assert_eq!(described.generation.unwrap().id, "new");
    }
}
