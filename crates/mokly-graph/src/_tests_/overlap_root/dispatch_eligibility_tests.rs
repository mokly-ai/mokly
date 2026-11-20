//! Dispatch classification reads immutable metadata without starting render work.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::template_types::Template;
use mokly_html::composition::{Composer, ComposerMock, HtmlComposer};
use mokly_html::fragment::{Fragment, FragmentRendererMock};
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::EntryContent;
use unimock::{MockFn, Unimock, matching};

use crate::cache::{Artifact, MemoryCache, RenderCache, RenderCacheMock};
use crate::key::NodeKey;
use crate::types::RenderGeneration;
use crate::workers::RenderWorkersMock;

use super::support::{catalogue, document, route, session};

#[derive(Default)]
struct Operations {
    probes: AtomicUsize,
    reads: AtomicUsize,
    preparations: AtomicUsize,
    fragments: AtomicUsize,
    workers: AtomicUsize,
}

impl Operations {
    fn snapshot(&self) -> [usize; 5] {
        [
            self.probes.load(Ordering::SeqCst),
            self.reads.load(Ordering::SeqCst),
            self.preparations.load(Ordering::SeqCst),
            self.fragments.load(Ordering::SeqCst),
            self.workers.load(Ordering::SeqCst),
        ]
    }
}

#[test]
fn static_root_choice_ignores_cache_and_never_starts_preparation_or_work() {
    let operations = Arc::new(Operations::default());
    let provider = Unimock::new(
        FragmentRendererMock::render
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let operations = operations.clone();
                move |_, _| {
                    operations.fragments.fetch_add(1, Ordering::SeqCst);
                    Ok(Fragment::default())
                }
            }))
            .at_least_times(0),
    )
    .no_verify_in_drop();
    let cache = Arc::new(MemoryCache::new(1 << 20, 0));
    let mut catalogue = catalogue();
    let source = document("<p>Template</p>");
    catalogue.templates.insert(
        "target".into(),
        Template {
            source_path: "target.page.html".into(),
            source: source.clone(),
            body: source,
            body_offset: 0,
            page: true,
        },
    );
    let mut markdown = catalogue.model.entries[0].clone();
    markdown.metadata.path = "markdown".into();
    markdown.content = EntryContent::Document {
        color_schemes: vec![ColorScheme::Light],
        resources: vec![],
    };
    catalogue.model.entries.push(markdown);
    let actual = Arc::new(HtmlComposer {
        fragments: Arc::new(provider.clone()),
    });
    let preparing = actual.clone();
    let classifier = Unimock::new(
        ComposerMock::can_prepare_root
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, catalogue, entry| {
                matches!(entry.content, EntryContent::Document { .. })
                    || actual.can_prepare_root(catalogue, entry)
            })),
    );
    let composer = Unimock::new((
        ComposerMock::can_prepare_root
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let classifier = classifier.clone();
                move |_, catalogue, entry| Composer::can_prepare_root(&classifier, catalogue, entry)
            })),
        ComposerMock::prepare_root
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let operations = operations.clone();
                move |_, request| {
                    operations.preparations.fetch_add(1, Ordering::SeqCst);
                    preparing.prepare_root(request)
                }
            }))
            .at_least_times(0),
    ))
    .no_verify_in_drop();
    let cache_reads = Unimock::new((
        RenderCacheMock::contains
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let operations = operations.clone();
                let cache = cache.clone();
                move |_, key| {
                    operations.probes.fetch_add(1, Ordering::SeqCst);
                    cache.contains(key)
                }
            }))
            .at_least_times(0),
        RenderCacheMock::get
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let operations = operations.clone();
                let cache = cache.clone();
                move |_, key| {
                    operations.reads.fetch_add(1, Ordering::SeqCst);
                    cache.get(key)
                }
            }))
            .at_least_times(0),
    ))
    .no_verify_in_drop();
    let workers = Unimock::new((
        RenderWorkersMock::cancelled
            .each_call(matching!())
            .answers_arc(Arc::new({
                let operations = operations.clone();
                move |_| {
                    operations.workers.fetch_add(1, Ordering::SeqCst);
                    false
                }
            }))
            .at_least_times(0),
        RenderWorkersMock::document
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let operations = operations.clone();
                move |_, route, job| {
                    operations.workers.fetch_add(1, Ordering::SeqCst);
                    job.artifact(route)
                }
            }))
            .at_least_times(0),
    ))
    .no_verify_in_drop();
    let (mut session, _) = session(catalogue, Arc::new(provider.clone()), cache.clone());
    let state = Arc::get_mut(&mut session.state).unwrap();
    state.composer = Arc::new(composer.clone());
    state.cache = Arc::new(cache_reads.clone());
    state.workers = Arc::new(workers.clone());

    assert!(session.can_prepare_root(&route("caller")));
    assert!(!session.can_prepare_root(&route("target")));
    assert!(!session.can_prepare_root(&route("markdown")));
    assert!(!session.can_prepare_root(&route("absent")));
    assert_eq!(operations.snapshot(), [0, 0, 0, 0, 0]);
    cache.insert(
        NodeKey("caller".into()),
        Arc::new(Artifact {
            bytes: vec![],
            content_type: "text/html".into(),
            document: None,
            fragment: None,
        }),
    );
    assert!(cache.contains(&NodeKey("caller".into())));
    assert!(session.can_prepare_root(&route("caller")));
    assert_eq!(operations.snapshot(), [0, 0, 0, 0, 0]);
}
