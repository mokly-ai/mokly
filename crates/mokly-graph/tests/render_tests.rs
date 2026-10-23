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
