//! HTML, Markdown, stylesheets, and graph eviction share one integration fixture.

use std::path::Path;

use mokly_model::usage::CatalogueUsage;

mod support;

#[test]
fn every_template_rule_has_deterministic_rendered_document_snapshots() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/catalogue");
    let (generation, cache) = support::prepare(&root, 16 * 1024 * 1024, 3);
    let generation = generation.unwrap();
    assert_eq!(generation.plans().len(), 23);
    let keys: Vec<_> = generation
        .plans()
        .values()
        .map(|plan| plan.key.clone())
        .collect();
    assert_eq!(cache.stats().hits, 0);
    let summary = generation.render_all().unwrap();
    assert_eq!(summary.documents, 23);
    assert!(summary.warnings.is_empty(), "{:?}", summary.warnings);
    assert_eq!(
        summary.closure.into_iter().collect::<Vec<_>>(),
        ["specs/assets/public.svg"]
    );
    for plan in generation.plans().values() {
        let artifact = generation.render(&plan.route).unwrap();
        insta::assert_snapshot!(
            plan.route.replace('/', "__"),
            String::from_utf8(artifact.bytes.clone()).unwrap()
        );
    }
    assert_eq!(
        keys,
        generation
            .plans()
            .values()
            .map(|plan| plan.key.clone())
            .collect::<Vec<_>>()
    );
    assert!(cache.stats().hits > 0);
}

#[test]
fn render_and_comparison_document_return_the_same_artifact() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/catalogue");
    let (generation, _) = support::prepare(&root, 16 * 1024 * 1024, 1);
    let generation = generation.unwrap();
    let route = "home/index.mobile.html";
    let rendered = generation.render(route).unwrap();
    let comparison = generation.comparison_document(route).unwrap();
    assert_eq!(rendered.bytes, comparison.bytes);
    assert_eq!(rendered.content_type, comparison.content_type);
    let rendered_document = rendered.document.as_ref().unwrap();
    let comparison_document = comparison.document.as_ref().unwrap();
    assert_eq!(rendered_document.tree, comparison_document.tree);
    assert_eq!(rendered_document.usage, comparison_document.usage);
    assert_eq!(rendered_document.warnings, comparison_document.warnings);
    assert_eq!(rendered_document.resources, comparison_document.resources);
    assert_eq!(rendered_document.components, comparison_document.components);
    assert_eq!(
        rendered_document.links.len(),
        comparison_document.links.len()
    );
    for (rendered_link, comparison_link) in rendered_document
        .links
        .iter()
        .zip(&comparison_document.links)
    {
        assert_eq!(rendered_link.source_route, comparison_link.source_route);
        assert_eq!(rendered_link.target, comparison_link.target);
        assert_eq!(rendered_link.fragment, comparison_link.fragment);
    }
}

#[test]
fn repeated_slots_keep_one_input_and_separate_placements() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/catalogue");
    let (generation, _) = support::prepare(&root, 16 * 1024 * 1024, 1);
    let artifact = generation
        .unwrap()
        .render("home/index.mobile.html")
        .unwrap();
    let CatalogueUsage::Ready {
        instances,
        slots,
        ranges,
    } = &artifact.document.as_ref().unwrap().usage
    else {
        panic!("usage not ready")
    };
    assert_eq!(instances.len(), 4);
    assert_eq!(slots.len(), 2);
    let action = instances
        .iter()
        .find(|instance| instance.id == "slot-action")
        .unwrap();
    assert!(matches!(
        action.owner,
        mokly_model::usage::ComponentInputOwner::Entry
    ));
    assert!(action.slot_key.is_some());
    assert_eq!(ranges.iter().filter(|range| matches!(&range.target, mokly_model::usage::ComponentRangeTarget::Instance { instance_key } if instance_key == &action.key)).count(), 2);
}

#[test]
fn zero_byte_cache_recomputes_equal_documents_and_pending_css_assets() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/catalogue");
    let (generation, cache) = support::prepare(&root, 0, 2);
    let generation = generation.unwrap();
    let first = generation
        .render("home/hidden/index.desktop.dark.html")
        .unwrap();
    let second = generation
        .render("home/hidden/index.desktop.dark.html")
        .unwrap();
    assert_eq!(first.bytes, second.bytes);
    assert_eq!(cache.stats().bytes, 0);
    assert_eq!(cache.stats().entries, 0);
    let route = "assets/assets/background.svg";
    assert_eq!(
        generation.resource(route).unwrap().unwrap(),
        include_bytes!("fixtures/catalogue/assets/background.svg")
    );
    assert!(generation.resource("assets/missing.svg").unwrap().is_none());
}
