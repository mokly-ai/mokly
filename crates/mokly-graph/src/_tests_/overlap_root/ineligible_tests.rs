//! Every unprepared input enters completion before its ordinary worker read.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::template_types::Template;
use mokly_html::composition::{Composed, ComposerMock};
use mokly_html::fragment::{Fragment, FragmentRendererMock};
use mokly_html::parse;
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::EntryContent;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::background::CompletionMock;
use crate::cache::{Artifact, MemoryCache, RenderCache, RenderCacheMock};
use crate::key::NodeKey;
use crate::types::RenderGeneration;
use crate::workers::RenderWorkersMock;

use super::support::{catalogue, document, route, session};

#[test]
fn cached_markdown_template_and_custom_views_enter_before_worker_without_early_fragment() {
    for kind in ["cached", "custom-cache", "markdown", "template", "custom"] {
        let phase = Arc::new(AtomicUsize::new(0));
        let entered = Arc::new(AtomicUsize::new(0));
        let calls = Arc::new(AtomicUsize::new(0));
        let provider = Unimock::new(
            FragmentRendererMock::render
                .each_call(matching!(_))
                .answers_arc(Arc::new({
                    let phase = phase.clone();
                    let calls = calls.clone();
                    move |_, _| {
                        assert_eq!(phase.load(Ordering::SeqCst), 1);
                        calls.fetch_add(1, Ordering::SeqCst);
                        Ok(Fragment {
                            html: document("<p>Custom</p>"),
                            ..Default::default()
                        })
                    }
                })),
        )
        .no_verify_in_drop();
        let cache = Arc::new(MemoryCache::new(1 << 20, 0));
        let mut catalogue = catalogue();
        match kind {
            "markdown" => {
                catalogue.model.entries[0].content = EntryContent::Document {
                    color_schemes: vec![ColorScheme::Light],
                    resources: vec![],
                };
                catalogue
                    .documents
                    .insert("caller".into(), "# Notes".into());
            }
            "template" => {
                let source = document("<p>Template</p>");
                catalogue.templates.insert(
                    "caller".into(),
                    Template {
                        source_path: "caller.page.html".into(),
                        source: source.clone(),
                        body: source,
                        body_offset: 0,
                        page: true,
                    },
                );
            }
            "cached" | "custom-cache" => {
                cache.insert(
                    NodeKey("caller".into()),
                    Arc::new(Artifact {
                        bytes: document("<p>Cached</p>").into_bytes(),
                        content_type: "text/html".into(),
                        fragment: None,
                        document: Some(Composed {
                            tree: parse::html(DeliveredHtml::document(&document("<p>Cached</p>"))),
                            usage: CatalogueUsage::Unavailable,
                            warnings: vec![],
                            resources: vec![],
                            components: vec![],
                            links: vec![],
                        }),
                    }),
                );
            }
            _ => {}
        }
        let (mut session, _) = session(catalogue, Arc::new(provider.clone()), cache.clone());
        let custom_cache = Unimock::new((
            RenderCacheMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new({
                    let cache = cache.clone();
                    let phase = phase.clone();
                    move |_, key| {
                        assert_eq!(phase.load(Ordering::SeqCst), 1);
                        cache.get(key)
                    }
                })),
            RenderCacheMock::insert
                .each_call(matching!(_, _))
                .answers_arc(Arc::new({
                    let cache = cache.clone();
                    move |_, key, value| cache.insert(key, value)
                })),
        ))
        .no_verify_in_drop();
        let actual = session.state.composer.clone();
        let custom = Unimock::new(
            ComposerMock::compose
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, request| actual.compose(request))),
        )
        .no_verify_in_drop();
        let workers = Unimock::new((
            RenderWorkersMock::cancelled
                .each_call(matching!())
                .returns(false),
            RenderWorkersMock::document
                .some_call(matching!(_, _))
                .answers_arc(Arc::new({
                    let phase = phase.clone();
                    let entered = entered.clone();
                    let calls = calls.clone();
                    let cache = cache.clone();
                    move |_, route, job| {
                        assert_eq!(entered.load(Ordering::SeqCst), 1, "{kind}");
                        assert_eq!(calls.load(Ordering::SeqCst), 0, "{kind}");
                        assert_eq!(
                            cache.stats().hits + cache.stats().misses,
                            0,
                            "probe must not count {kind}"
                        );
                        phase.store(1, Ordering::SeqCst);
                        job.artifact(route)
                    }
                })),
        ))
        .no_verify_in_drop();
        let completion = Unimock::new(CompletionMock::enter.some_call(matching!()).answers_arc(
            Arc::new({
                let phase = phase.clone();
                let entered = entered.clone();
                move |_| {
                    assert_eq!(phase.load(Ordering::SeqCst), 0);
                    entered.fetch_add(1, Ordering::SeqCst);
                }
            }),
        ));
        let state = Arc::get_mut(&mut session.state).unwrap();
        if kind == "custom" {
            state.composer = Arc::new(custom.clone());
        }
        if kind == "custom-cache" {
            state.cache = Arc::new(custom_cache.clone());
        }
        state.workers = Arc::new(workers.clone());
        let artifact = session
            .render_background(&route("caller"), Arc::new(completion.clone()))
            .unwrap();
        let expected = match kind {
            "cached" | "custom-cache" => "Cached",
            "markdown" => "Notes",
            "template" => "Template",
            _ => "Custom",
        };
        assert!(
            String::from_utf8(artifact.bytes.clone())
                .unwrap()
                .contains(expected),
            "{kind}"
        );
        assert_eq!(entered.load(Ordering::SeqCst), 1, "{kind}");
        assert_eq!(
            calls.load(Ordering::SeqCst),
            usize::from(kind == "custom"),
            "{kind}"
        );
        assert_eq!(
            cache.stats().hits + cache.stats().misses,
            if kind == "custom" { 2 } else { 1 },
            "{kind}"
        );
    }
}
