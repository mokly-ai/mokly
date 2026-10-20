//! Historical JavaScript style records retain component ownership through comparison.

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::cache_types::Lease;
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_types::{Comparison, ComparisonRequest, ComparisonResult};
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_model::review::{EntryChangeReason, ReviewState};
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::methods::ModuleResolution;
use unimock::Unimock;

use super::support::Consumer;

const CARD: &str = "import {defineComponent} from '@mokly/mokly'; export const card=defineComponent({title:'Card',description:'',relatedDocs:[],element:'ui-card',propSchema:{type:'object',additionalProperties:false,required:['label'],properties:{label:{type:'string'}}},props:{label:'Own'},variants:[{slug:'other',title:'Other',props:{label:'Other'}}],render:(props)=><><style>{`.card-${props.label}{color:${COLOR}}`}</style><p className={'card-'+props.label}>Card</p></>});";
const HOME: &str = "---\ntitle: Home\n---\n<ui-card label=\"Instance\"></ui-card>";

fn consumer(color: &str) -> Consumer {
    let consumer = Consumer::single();
    fs::create_dir(consumer.root().join("owned")).unwrap();
    fs::write(
        consumer.root().join("mokly.config.json"),
        r#"{"roots":[{"dir":"owned"}]}"#,
    )
    .unwrap();
    fs::write(
        consumer.root().join("owned/card.mockup.tsx"),
        CARD.replace("COLOR", color),
    )
    .unwrap();
    fs::write(consumer.root().join("owned/home.screen.html"), HOME).unwrap();
    consumer
}

fn historical(head: &Consumer, base: &Consumer) -> Arc<dyn RenderGeneration> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let runtime = Arc::new(Runtime::new(
        Arc::new(WorkingTree),
        Arc::new(WorkingTree),
        head.runtime.pool.clone(),
        head.runtime.cache.clone(),
        head.runtime.workers.clone(),
        super::support::package_version::read(),
        Some(Arc::new(BaseSide {
            sources: Lease {
                directory: base.root().into(),
                guard: Box::new(Unimock::new(())),
            },
            dependencies: Resolved {
                tier: Tier::Working,
                node_modules: root.join("node_modules"),
                module_resolution: ModuleResolution {
                    package_roots: vec![root.to_string_lossy().into_owned()],
                    ..Default::default()
                },
                warning: None,
                lease: None,
                repository_roots: vec![head.root().into(), root],
            },
            identity: "historical".into(),
        })),
    ));
    let catalogue = Builder {
        tree: Arc::new(WorkingTree),
        discovery: Arc::new(Discoverer {
            tree: Arc::new(WorkingTree),
        }),
        definitions: runtime.clone(),
    }
    .prepare(&base.config(), None)
    .unwrap();
    let factory: &dyn GraphFactory = runtime.as_ref();
    factory
        .create(&base.config())
        .unwrap()
        .prepare(base.config(), catalogue, None)
        .unwrap()
}

fn compare(base: &Consumer, head: &Consumer) -> ComparisonResult {
    let current = head.generation(head.prepare().unwrap());
    let previous = historical(head, base);
    let engine: &dyn Comparison = &Engine {
        moves: Arc::new(Detector),
        css: Arc::new(MemoryParsedCss::new(1024 * 1024)),
    };
    let previous = engine.capture_base(previous).unwrap();
    engine
        .compare_prepared(
            &ComparisonRequest {
                base_ref: "base".into(),
                base_commit: "a".repeat(40),
                catalogue_identity: "b".repeat(64),
            },
            previous,
            current,
        )
        .unwrap()
}

#[test]
fn base_owned_styles_change_the_component_and_saved_variant_without_a_consumer_row() {
    let base = consumer("'red'");
    let head = consumer("'blue'");
    let result = compare(&base, &head);
    assert_eq!(result.snapshot.changed_entries, ["card", "card/other"]);
    assert_eq!(result.review.affected.len(), 1);
    assert_eq!(result.review.affected[0].consumer.path, "home");
    assert!(
        result
            .entries
            .iter()
            .filter(|entry| entry.path == "card" || entry.path == "card/other")
            .flat_map(|entry| &entry.documents)
            .all(|view| view.evidence.rules.is_empty())
    );
    assert!(
        result
            .entries
            .iter()
            .find(|entry| entry.path == "home")
            .unwrap()
            .documents
            .iter()
            .all(|view| view.state == ReviewState::Unchanged)
    );
}

#[test]
fn a_context_only_style_edit_uses_the_exact_unchanged_input_instance() {
    let base = consumer("props.label === 'Instance' ? 'red' : 'black'");
    let head = consumer("props.label === 'Instance' ? 'blue' : 'black'");
    let result = compare(&base, &head);
    assert_eq!(result.snapshot.changed_entries, ["card"]);
    let card = result
        .entries
        .iter()
        .find(|entry| entry.path == "card")
        .unwrap();
    assert!(card.reasons.contains(&EntryChangeReason::Implementation));
    assert!(
        card.documents
            .iter()
            .all(|view| view.state == ReviewState::Unchanged)
    );
}

#[test]
fn caller_prop_changes_do_not_give_an_unchanged_sibling_instance_a_style_reason() {
    let base = consumer("props.label === 'Instance' ? 'red' : 'blue'");
    let head = consumer("props.label === 'Instance' ? 'red' : 'blue'");
    let body = HOME.to_owned() + "<ui-card mokly-instance=\"stable\" label=\"Stable\"></ui-card>";
    fs::write(base.root().join("owned/home.screen.html"), &body).unwrap();
    fs::write(
        head.root().join("owned/home.screen.html"),
        body.replace("Instance", "Changed"),
    )
    .unwrap();
    let result = compare(&base, &head);
    assert_eq!(result.snapshot.changed_entries, ["home"]);
    assert!(result.review.affected.is_empty());
}

#[test]
fn formatting_and_duplicate_owned_rules_do_not_change_entries() {
    let base = consumer("'red'");
    let head = consumer("'red'");
    head.replace(
        "owned/card.mockup.tsx",
        "{color:${'red'}}",
        " { color: ${'red'} } .card-${props.label}{color:${'red'}}",
    );
    let result = compare(&base, &head);
    assert!(result.snapshot.changed_entries.is_empty());
    assert!(result.review.affected.is_empty());
}

#[test]
fn removing_owned_styles_keeps_historical_component_attribution() {
    let base = consumer("'red'");
    let head = consumer("'red'");
    head.replace(
        "owned/card.mockup.tsx",
        "<style>{`.card-${props.label}{color:${'red'}}`}</style>",
        "",
    );
    let result = compare(&base, &head);
    assert_eq!(result.snapshot.changed_entries, ["card", "card/other"]);
    assert_eq!(result.review.affected[0].consumer.path, "home");
}

#[test]
fn identical_owned_styles_follow_a_component_move_and_its_saved_variant() {
    let base = consumer("'red'");
    let head = consumer("'red'");
    fs::rename(
        head.root().join("owned/card.mockup.tsx"),
        head.root().join("owned/renamed.mockup.tsx"),
    )
    .unwrap();
    let result = compare(&base, &head);
    assert_eq!(result.counts.moved, 2);
    assert!(result.snapshot.removed_entries.is_empty());
    assert!(
        result
            .pairing
            .entries
            .iter()
            .all(|pair| pair.before.is_some() && pair.after.is_some())
    );
    let parent = result
        .review
        .entries
        .iter()
        .find(|entry| entry.path == "renamed")
        .unwrap();
    assert_eq!(parent.previous_path.as_deref(), Some("card"));
    let variants = parent.variants.as_ref().unwrap();
    assert_eq!(variants.len(), 1);
    assert_eq!(variants[0].path, "renamed/other");
    assert_eq!(variants[0].previous_path.as_deref(), Some("card/other"));
    assert!(
        parent
            .views
            .iter()
            .chain(&variants[0].views)
            .all(|view| view.state == ReviewState::Unchanged)
    );
}
