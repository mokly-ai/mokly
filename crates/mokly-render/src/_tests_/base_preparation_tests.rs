//! A Serve base attempt prepares its PostCSS context, and a head runtime never takes the base rule.

use std::sync::{Arc, Mutex};

use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::postcss_preparation::PostcssPreparation;
use mokly_sidecar::results::Module;
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::runtime::Runtime;

use super::bundle_plan_support::{evidence, result};
use super::bundle_preparation_support::{base_side, config, definitions};

/// A head runtime that reads no source and records each pool request. Its pool answers one plain
/// bundle whose renderer imports no stylesheet. A side may skip the dependency tree, and an
/// attempt may release no context, so the mocks skip their call-count check.
fn head(calls: Arc<Mutex<Vec<Call>>>) -> Runtime {
    let pool = Unimock::new((
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, call| {
                calls.lock().unwrap().push(call.clone());
                Ok(match call {
                    Call::Bundle(_) => {
                        let mut reply = result(None, evidence());
                        reply.modules = vec![Module {
                            path: "renderer.ts".into(),
                            imports: vec![],
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
            .returns(()),
        PoolMock::release_context
            .each_call(matching!(_))
            .returns(()),
    ))
    .no_verify_in_drop();
    let dependencies = Unimock::new(
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, _| Ok(None)),
    )
    .no_verify_in_drop();
    Runtime::new(
        Arc::new(Unimock::new(())),
        Arc::new(dependencies),
        Arc::new(Unimock::new(())),
        Arc::new(pool),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        "test".into(),
        None,
    )
}

/// A head runtime as Serve builds it: plan records, the render store, and stylesheet watching.
fn serve_head(calls: Arc<Mutex<Vec<Call>>>) -> Runtime {
    head(calls)
        .with_serve_edit_plans()
        .with_document_store(Arc::new(Unimock::new(())))
        .with_stylesheet_watching()
}

/// The base runtime that `parent` makes over a leased base side.
fn base(parent: &Runtime) -> Runtime {
    parent.for_base(Arc::new(Unimock::new(())), "test".into(), Some(base_side()))
}

/// The preparation of each `bundle` request that one description sends.
fn preparations(runtime: &Runtime, calls: &Mutex<Vec<Call>>) -> Vec<Option<PostcssPreparation>> {
    runtime.describe(&config(true), &[]).unwrap();
    calls
        .lock()
        .unwrap()
        .iter()
        .filter_map(|call| match call {
            Call::Bundle(request) => Some(request.preparation.clone()),
            _ => None,
        })
        .collect()
}

#[test]
fn a_base_graph_preparation_of_a_serve_head_prepares_its_base_context() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let base = base(&serve_head(calls.clone()));
    let base_context = format!("{}:", base_side().identity);
    let prepared: Vec<_> = preparations(&base, &calls)
        .iter()
        .map(|preparation| {
            preparation.as_ref().map(|preparation| {
                (
                    preparation.context.starts_with(&base_context),
                    preparation.postcss.clone(),
                )
            })
        })
        .collect();
    assert_eq!(prepared, [Some((true, "postcss.mjs".to_string()))]);
}

#[test]
fn a_base_graph_preparation_of_a_static_runtime_prepares_no_context() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let base = base(&head(calls.clone()));
    assert_eq!(preparations(&base, &calls), [None]);
}

#[test]
fn a_serve_head_that_holds_base_leases_keeps_its_preparation_result() {
    for (leased, expected) in [(false, true), (true, false)] {
        let calls = Arc::new(Mutex::new(Vec::new()));
        let mut runtime = serve_head(calls.clone());
        if leased {
            runtime.base = Some(base_side());
        }
        let prepared: Vec<_> = preparations(&runtime, &calls)
            .iter()
            .map(Option::is_some)
            .collect();
        assert_eq!(prepared, [expected], "leased={leased}");
    }
}
