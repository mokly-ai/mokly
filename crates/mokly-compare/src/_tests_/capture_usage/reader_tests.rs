//! Usage misses keep the reader's cancellation and exact-base failure release.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_git::control::CancellationMock;
use mokly_graph::cache::Artifact;
use mokly_graph::error::GraphError;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_html::composition::Composed;
use mokly_model::runtime_diagnostic::RuntimeCode;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::base_reader::BaseReader;
use crate::base_retention::{BaseReleaseMock, BaseReuse, KeptBase};

use super::support::{captured, usage};

fn document(usage: Option<CatalogueUsage>) -> Arc<Artifact> {
    Arc::new(Artifact {
        bytes: b"source document".to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: usage.map(|usage| Composed {
            tree: vec![],
            usage,
            warnings: vec![],
            resources: vec![],
            components: vec![],
            links: vec![],
        }),
    })
}

#[test]
fn missing_or_failed_usage_keeps_checked_fallback_and_releases_only_its_owned_failure() {
    for failed_usage in [false, true] {
        let cancelled = Arc::new(AtomicBool::new(false));
        let lookups = Arc::new(AtomicUsize::new(0));
        let source = Arc::new(Unimock::new((
            RenderGenerationMock::check_cancelled
                .each_call(matching!())
                .answers(&|_| Ok(())),
            RenderGenerationMock::comparison_usage
                .each_call(matching!(_))
                .answers_arc({
                    let cancelled = cancelled.clone();
                    let lookups = lookups.clone();
                    Arc::new(move |_, route| {
                        lookups.fetch_add(1, Ordering::AcqRel);
                        if route == "cancelled/index.html" {
                            cancelled.store(true, Ordering::Release);
                        }
                        if failed_usage {
                            Err(GraphError::InputsChanged {
                                path: PathBuf::from("usage.html"),
                            })
                        } else {
                            Ok(None)
                        }
                    })
                }),
            RenderGenerationMock::comparison_document
                .some_call(matching!("ready/index.html"))
                .returns(Ok(document(Some(usage(vec![]))))),
            RenderGenerationMock::comparison_document
                .some_call(matching!("absent/index.html"))
                .returns(Ok(document(None))),
            RenderGenerationMock::comparison_document
                .each_call(matching!("failed/index.html"))
                .answers(&|_, _| {
                    Err(GraphError::InputsChanged {
                        path: PathBuf::from("document.html"),
                    })
                }),
        )));
        let base = Arc::new(KeptBase {
            generation: captured(source, vec![], Arc::new(AtomicUsize::new(0))),
            failures: Arc::new(Unimock::new(())),
            scripts_off: true,
            freshness: None,
        });
        let released = Arc::new(Mutex::new(Vec::new()));
        let reader = BaseReader::new(BaseReuse {
            base: base.clone(),
            cancellation: Arc::new(Unimock::new(
                CancellationMock::cancelled
                    .each_call(matching!())
                    .answers_arc({
                        let cancelled = cancelled.clone();
                        Arc::new(move |_| cancelled.load(Ordering::Acquire))
                    }),
            )),
            releaser: Arc::new(Unimock::new(
                BaseReleaseMock::release
                    .each_call(matching!(_))
                    .answers_arc({
                        let released = released.clone();
                        Arc::new(move |_, base| released.lock().unwrap().push(base.clone()))
                    }),
            )),
        });

        assert_eq!(
            reader.comparison_usage("ready/index.html").unwrap(),
            Some(usage(vec![])),
            "failed_usage={failed_usage}"
        );
        assert_eq!(lookups.load(Ordering::Acquire), 1);
        assert_eq!(reader.comparison_usage("absent/index.html").unwrap(), None);
        assert!(matches!(
            reader.comparison_usage("cancelled/index.html"),
            Err(GraphError::Runtime { source }) if source.code == RuntimeCode::Cancelled
        ));
        assert!(!reader.failed());
        assert_eq!(released.lock().unwrap().len(), 0);
        cancelled.store(false, Ordering::Release);

        for _ in 0..2 {
            assert!(matches!(
                reader.comparison_usage("failed/index.html"),
                Err(GraphError::InputsChanged { path }) if path == Path::new("document.html")
            ));
        }
        assert!(reader.failed());
        assert_eq!(lookups.load(Ordering::Acquire), 5);
        let released = released.lock().unwrap();
        assert_eq!(released.len(), 1);
        assert!(Arc::ptr_eq(&released[0], &base));
    }
}
