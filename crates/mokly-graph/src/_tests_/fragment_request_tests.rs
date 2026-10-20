//! Fragment request registrations end on cache hits, successful renders, and errors.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_html::error::HtmlError;
use mokly_html::fragment::{
    Fragment, FragmentRenderer, FragmentRendererMock, FragmentRequest, RenderKind,
};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use unimock::{MockFn, Unimock, matching};

use crate::cache::{Artifact, RenderCache, RenderCacheMock};
use crate::fragments::MemoFragments;
use crate::key::NodeKey;
use crate::requests::{MemoryRequests, Requests};

fn request() -> FragmentRequest {
    FragmentRequest {
        entry_path: "components/chip".into(),
        entry_title: "Chip".into(),
        handle: "chip.mockup.tsx#Chip".into(),
        kind: RenderKind::Component,
        props: BTreeMap::new(),
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        ignore_enabled: true,
        slots: BTreeMap::new(),
        saved_slots: BTreeMap::new(),
    }
}

#[test]
fn successful_and_failed_fragment_renders_release_request_metadata() {
    for fails in [false, true] {
        let flights: Arc<dyn Requests> = Arc::new(MemoryRequests::default());
        let observed = flights.clone();
        let renderer = Arc::new(Unimock::new(
            FragmentRendererMock::render
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    assert_eq!(observed.len(), 1);
                    if fails {
                        Err(HtmlError::Runtime {
                            source: RuntimeDiagnostic {
                                code: RuntimeCode::Cancelled,
                                message: "cancelled fragment".into(),
                            },
                        })
                    } else {
                        Ok(Fragment {
                            html: "<p>saved</p>".into(),
                            ..Default::default()
                        })
                    }
                })),
        ));
        let cache: Arc<dyn RenderCache> = if fails {
            Arc::new(Unimock::new(
                RenderCacheMock::get.next_call(matching!(_)).returns(None),
            ))
        } else {
            Arc::new(Unimock::new((
                RenderCacheMock::get.next_call(matching!(_)).returns(None),
                RenderCacheMock::insert.next_call(matching!((_, value) if value.fragment.as_ref().unwrap().html == "<p>saved</p>")).returns(()),
            )))
        };
        let memo = MemoFragments {
            generation: "generation".into(),
            renderer,
            cache,
            flights: flights.clone(),
        };
        let result = memo.render(&request());
        if fails {
            assert!(
                matches!(result, Err(HtmlError::Runtime { source }) if source.code == RuntimeCode::Cancelled)
            );
        } else {
            assert_eq!(result.unwrap().html, "<p>saved</p>");
        }
        assert_eq!(flights.len(), 0);
    }
}

#[test]
fn a_cached_fragment_releases_its_registration_without_a_provider_call() {
    let memo = MemoFragments::new(
        "generation".into(),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            RenderCacheMock::get
                .next_call(matching!(_))
                .returns(Some(Arc::new(Artifact {
                    bytes: vec![],
                    content_type: "text/html".into(),
                    document: None,
                    fragment: Some(Fragment {
                        html: "<p>cached</p>".into(),
                        ..Default::default()
                    }),
                }))),
        )),
    );
    assert_eq!(memo.render(&request()).unwrap().html, "<p>cached</p>");
    assert_eq!(memo.flights.len(), 0);
}

#[test]
fn fragment_adapters_keep_independent_request_registries() {
    let first = MemoFragments::new(
        "same".into(),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
    );
    let second = MemoFragments::new(
        "same".into(),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
    );
    let key = NodeKey("same request".into());
    let left = first.flights.acquire(&key);
    let right = second.flights.acquire(&key);
    let _guard = left.lock().unwrap();
    assert!(right.try_lock().is_ok());
}
