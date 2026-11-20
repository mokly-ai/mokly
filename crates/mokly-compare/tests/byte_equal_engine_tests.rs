//! Requested differential corpus proves equal-document sharing preserves published results.

use std::sync::Arc;

use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_types::{Comparison, ComparisonRequest, ComparisonResult};
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::cache::{Artifact, MemoryCache};
use mokly_graph::types::RenderGeneration;
use mokly_graph::workers::ThreadWorkers;
use mokly_model::evidence::RuleStatus;
use mokly_model::review::ReviewState;
use mokly_model::usage::CatalogueUsage;
use mokly_test_support::capture::Trace;

mod byte_equal_support;
#[expect(
    dead_code,
    reason = "the shared fixture also supports other comparison entrypoints"
)]
mod engine_support;

use byte_equal_support::complete_generation::CompleteGeneration;
use byte_equal_support::outputs;
use engine_support::{Fixture, entry};

fn engine() -> Engine {
    Engine {
        moves: Arc::new(Detector),
        css: Arc::new(MemoryParsedCss::new(1024 * 1024)),
    }
}

fn prepared(fixture: &Fixture, base: bool) -> Arc<dyn RenderGeneration> {
    engine_support::prepare(
        fixture.directory.path(),
        if base {
            fixture.base_tree(engine_support::runner(), 1024 * 1024)
        } else {
            Arc::new(WorkingTree)
        },
        Arc::new(MemoryCache::new(4 * 1024 * 1024, 0)),
        Arc::new(ThreadWorkers::new(2).unwrap()),
    )
    .unwrap()
}

fn compare(
    fixture: &Fixture,
    base: Arc<dyn RenderGeneration>,
    annotation: Option<fn(&mut Artifact)>,
) -> ComparisonResult {
    let head = prepared(fixture, false);
    let head: Arc<dyn RenderGeneration> = match annotation {
        Some(edit) => Arc::new(CompleteGeneration(head, Some(edit))),
        None => head,
    };
    engine()
        .compare_prepared(
            &ComparisonRequest {
                base_ref: "fixture-base".into(),
                base_commit: fixture.commit.to_string(),
                catalogue_identity: "a".repeat(64),
            },
            base,
            head,
        )
        .unwrap()
}

fn assert_complete_output(
    fixture: &Fixture,
    base: &Arc<dyn RenderGeneration>,
    annotation: Option<fn(&mut Artifact)>,
) -> (ComparisonResult, usize) {
    let trace = Trace::default();
    let shared = trace.in_scope(|| compare(fixture, base.clone(), annotation));
    let complete = compare(
        fixture,
        Arc::new(CompleteGeneration(base.clone(), None)),
        annotation,
    );
    assert_eq!(outputs::collect(&shared), outputs::collect(&complete));
    let spans = trace.closed("review.compare-views");
    let admitted = spans[0].fields["admitted_views"].parse().unwrap();
    (shared, admitted)
}

fn incomplete_usage(artifact: &mut Artifact) {
    artifact.document.as_mut().unwrap().usage = CatalogueUsage::Unavailable;
}

#[test]
fn byte_equal_corpus_keeps_all_records_and_published_bytes_equal_to_complete_comparison() {
    let fixture = Fixture::new(&[
        (
            "mokly.config.json",
            "{\"colorSchemes\":[\"light\",\"dark\"]}",
        ),
        (
            "specs/stable.screen.html",
            "---\ntitle: Stable\n---\n<mokly-ignore id=\"stable\">Same</mokly-ignore><ui-card></ui-card>",
        ),
        (
            "specs/card.component.html",
            "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<article>Card</article><img src=\"../../image.svg\">",
        ),
        (
            "specs/styled.page.html",
            "---\ntitle: Styled\n---\n<!doctype html><html><head><title>Styled</title><link rel=\"stylesheet\" href=\"../../theme.css\"></head><body><p class=\"kept\">Same</p><iframe src=\"../../embedded.html\"></iframe></body></html>",
        ),
        (
            "specs/ignored.screen.html",
            "---\ntitle: Ignored\n---\n<mokly-ignore id=\"chrome\">Before</mokly-ignore>",
        ),
        (
            "specs/old.screen.html",
            "---\ntitle: Move\n---\n<p>Move</p>",
        ),
        (
            "specs/removed.screen.html",
            "---\ntitle: Removed\n---\n<p>Removed</p>",
        ),
        (
            "specs/schemes.screen.html",
            "---\ntitle: Schemes\ncolorSchemes: [light, dark]\n---\n<p>Schemes</p>",
        ),
        ("theme.css", ".missing{color:red}"),
        (
            "embedded.html",
            "<html><head><link rel=\"stylesheet\" href=\"embedded.css\"></head><body><p class=\"inside\">Same</p></body></html>",
        ),
        ("embedded.css", ".inside{color:red}"),
        ("image.svg", "before"),
    ]);
    let base = engine().capture_base(prepared(&fixture, true)).unwrap();
    let (equal, admitted) = assert_complete_output(&fixture, &base, None);
    assert!(admitted > 0, "the corpus must exercise shared preparation");
    assert_eq!(equal.counts.changes, 0);
    assert_eq!(entry(&equal, "stable").views[0].ignored_ids, ["stable"]);
    let (_, admitted) = assert_complete_output(&fixture, &base, Some(incomplete_usage));
    assert_eq!(
        admitted, 0,
        "metadata-only changes must use complete preparation"
    );

    fixture.edit("theme.css", ".missing{color:blue}");
    fixture.edit("embedded.css", ".inside{color:blue}");
    fixture.edit("embedded.html", "<html><head><link rel=\"stylesheet\" href=\"embedded.css\"></head><body><p class=\"inside\">After</p></body></html>");
    fixture.edit("image.svg", "after");
    fixture.edit(
        "specs/ignored.screen.html",
        "---\ntitle: Ignored\n---\n<mokly-ignore id=\"chrome\">After</mokly-ignore>",
    );
    fixture.edit(
        "specs/schemes.screen.html",
        "---\ntitle: Schemes\ncolorSchemes: [light]\n---\n<p>Schemes</p>",
    );
    fixture.remove("specs/removed.screen.html");
    fixture.edit(
        "specs/added.screen.html",
        "---\ntitle: Added\n---\n<p>Added</p>",
    );
    let (changed, admitted) = assert_complete_output(&fixture, &base, None);
    assert!(
        admitted > 0,
        "resource changes must still exercise shared document preparation"
    );
    assert_eq!(
        entry(&changed, "ignored").views[0].state,
        ReviewState::IgnoredOnly
    );
    let styled = changed
        .entries
        .iter()
        .find(|entry| entry.path == "styled")
        .unwrap();
    assert!(styled.documents[0].evidence.rules.iter().any(|rule| {
        rule.status == RuleStatus::Excluded && rule.stylesheet == "static/theme.css"
    }));
    assert!(entry(&changed, "card").included);
    assert_eq!(entry(&changed, "added").views[0].state, ReviewState::Added);
    assert!(
        changed
            .entries
            .iter()
            .flat_map(|entry| &entry.documents)
            .any(|view| { view.state == ReviewState::Removed })
    );

    fixture.relocate("specs/old.screen.html", "specs/moved.screen.html");
    let (moved, admitted) = assert_complete_output(&fixture, &base, None);
    assert_eq!(
        admitted, 0,
        "another entry's move must disable sharing for every view"
    );
    assert_eq!(moved.counts.moved, 1);
    assert_eq!(entry(&moved, "moved").previous_path.as_deref(), Some("old"));
}
