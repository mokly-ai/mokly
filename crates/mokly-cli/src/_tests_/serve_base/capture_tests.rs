//! Capture cancellation stops later reader calls while a detached in-flight read finishes.

use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier};
use std::thread;

use mokly_cli::cancellation::Cancellation;
use mokly_cli::cancelled_work::CancellableTree;
use mokly_compare::base_freshness::FreshnessMock;
use mokly_compare::base_render::{BaseProviderMock, PreparedBase};
use mokly_compare::comparison_types::ComparisonMock;
use mokly_graph::cache::Artifact;
use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::types::RenderGenerationMock;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use mokly_server::changes::{ChangeCancellation, ChangeSource, ChangeToken};
use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::warning_support::{catalogue, config};

use super::flow_support::{Calls, classify, comparison, result, sources};
use super::runtime_support::source;
use super::support::{Fixture, head, inputs, runtime, selected};

#[test]
fn kept_reader_survives_origin_replacement_and_later_captures_after_one_running_read() {
    let calls = Arc::new(Calls::default());
    let entered = Arc::new(Barrier::new(2));
    let resume = Arc::new(Barrier::new(2));
    let reads = Arc::new(AtomicUsize::new(0));
    let mut first = Fixture::new(
        Arc::default(),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        runtime(),
    );
    let tree: Arc<dyn SourceTree> = Arc::new(CancellableTree {
        inner: Arc::new(Unimock::new(
            SourceTreeMock::read.each_call(matching!(_)).answers_arc({
                let entered = entered.clone();
                let resume = resume.clone();
                let reads = reads.clone();
                Arc::new(move |_, path| {
                    if path.ends_with("image.png") {
                        if reads.fetch_add(1, Ordering::Relaxed) == 0 {
                            entered.wait();
                            resume.wait();
                        }
                        Ok(b"resource".to_vec())
                    } else {
                        Ok(b"document".to_vec())
                    }
                })
            }),
        )),
        cancellation: first.lifetime.clone(),
    });
    let generation = Arc::new(Unimock::new((
        RenderGenerationMock::catalogue
            .some_call(matching!())
            .returns(catalogue(Vec::new())),
        RenderGenerationMock::check_cancelled
            .each_call(matching!())
            .answers_arc({
                let lifetime = first.lifetime.clone();
                Arc::new(move |_| {
                    if lifetime.requested() {
                        Err(GraphError::Runtime {
                            source: RuntimeDiagnostic {
                                code: RuntimeCode::Cancelled,
                                message: "base cancelled".into(),
                            },
                        })
                    } else {
                        Ok(())
                    }
                })
            }),
        RenderGenerationMock::comparison_document
            .each_call(matching!("index.html"))
            .answers_arc({
                let tree = tree.clone();
                Arc::new(move |_, _| {
                    let bytes = tree.read(Path::new("/repo/index.html")).map_err(|source| {
                        GraphError::Internal(InternalError::Provider {
                            source: Box::new(source),
                        })
                    })?;
                    Ok(Arc::new(Artifact {
                        bytes,
                        document: None,
                        fragment: None,
                        content_type: "text/html".into(),
                    }))
                })
            }),
        RenderGenerationMock::resource_bytes
            .each_call(matching!("static/image.png"))
            .answers_arc(Arc::new(move |_, _| {
                tree.read(Path::new("/repo/image.png"))
                    .map(Some)
                    .map_err(|source| {
                        GraphError::Internal(InternalError::Provider {
                            source: Box::new(source),
                        })
                    })
            })),
    )));
    Arc::get_mut(&mut first.provider).unwrap().inner = Arc::new(Unimock::new(
        BaseProviderMock::prepare
            .some_call(matching!(_))
            .answers_arc({
                let calls = calls.clone();
                Arc::new(move |_, _| {
                    calls.prepares.fetch_add(1, Ordering::Relaxed);
                    Ok(PreparedBase {
                        prefetch: None,
                        generation: generation.clone(),
                        scripts_off: false,
                        freshness: Some(inputs(false)),
                    })
                })
            }),
    ));
    let result1 = classify(
        first.provider.clone(),
        selected("a"),
        sources(calls.clone()),
        comparison(calls.clone()),
        head(false),
        &config(),
    )
    .unwrap();
    first.origin.cancel();
    assert!(matches!(result1.before.comparison_document("index.html"),
        Err(GraphError::Runtime { source }) if source.code == RuntimeCode::Cancelled));
    let second = Fixture::new(
        first.slot.clone(),
        Arc::new(Unimock::new(
            FreshnessMock::current
                .each_call(matching!(_))
                .answers(&|_, _, _| Ok(true)),
        )),
        Arc::new(Unimock::new(())),
        runtime(),
    );
    let compare = Arc::new(Unimock::new(
        ComparisonMock::compare_prepared
            .each_call(matching!(_))
            .answers(&|_, request, before, after| Ok(result(request, before, after))),
    ));
    let result2 = classify(
        second.provider.clone(),
        selected("a"),
        Arc::new(Unimock::new(())),
        compare.clone(),
        head(false),
        &config(),
    )
    .unwrap();
    let document = result2.before.comparison_document("index.html");
    assert!(
        matches!(&document, Ok(artifact) if artifact.bytes == b"document"),
        "{document:?}"
    );
    let source = source(&second, Arc::new(Unimock::new(())));
    {
        let capture = Arc::new(ChangeToken::default());
        let _scope = source.capture_scope(capture.clone()).unwrap();
        thread::scope(|scope| {
            let running = scope.spawn(|| result2.before.resource_bytes("static/image.png"));
            entered.wait();
            capture.cancel();
            resume.wait();
            assert_eq!(running.join().unwrap().unwrap(), Some(b"resource".to_vec()));
        });
        assert!(matches!(result2.before.comparison_document("index.html"),
            Err(GraphError::Runtime { source }) if source.code == RuntimeCode::Cancelled));
    }
    {
        let _scope = source
            .capture_scope(Arc::new(ChangeToken::default()))
            .unwrap();
        assert_eq!(
            result2
                .before
                .comparison_document("index.html")
                .unwrap()
                .bytes,
            b"document"
        );
        assert_eq!(
            result2.before.resource_bytes("static/image.png").unwrap(),
            Some(b"resource".to_vec())
        );
    }
    second.origin.cancel();
    let third = Fixture::new(
        first.slot.clone(),
        Arc::new(Unimock::new(
            FreshnessMock::current
                .some_call(matching!(_))
                .returns(Ok(true)),
        )),
        Arc::new(Unimock::new(())),
        runtime(),
    );
    let result3 = classify(
        third.provider.clone(),
        selected("a"),
        Arc::new(Unimock::new(())),
        compare,
        head(false),
        &config(),
    )
    .unwrap();
    assert_eq!(
        result3
            .before
            .comparison_document("index.html")
            .unwrap()
            .bytes,
        b"document"
    );
    assert_eq!(
        result3.before.resource_bytes("static/image.png").unwrap(),
        Some(b"resource".to_vec())
    );
    assert_eq!(calls.counts(), (1, 1, 1));
    assert_eq!(reads.load(Ordering::Relaxed), 3);
}
