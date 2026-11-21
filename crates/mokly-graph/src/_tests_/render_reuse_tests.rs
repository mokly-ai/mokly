//! Incremental key jobs and exactness across changing complete inputs.

use unimock::Unimock;

use crate::key::NodeKey;

use crate::render_inputs::{PREVIEWS, RenderKeys};

#[path = "render_reuse_support.rs"]
mod support;

use support::{A, B, C, Fixture, RENDERER, STORY};

#[path = "render_reuse_generated_tests.rs"]
mod generated_tests;

#[test]
fn unchanged_and_isolated_edits_avoid_unaffected_exporter_jobs() {
    let mut fixture = Fixture::new();
    let (first, jobs) = fixture.reuse(None);
    assert_eq!(jobs, 4, "the initial build computes every exporter");
    let (unchanged, jobs) = fixture.reuse(Some(&first));
    assert_eq!(jobs, 0, "equal complete inputs compute no exporter");
    fixture.digest("lib/leaf.ts", "leaf@2");
    let (edited, jobs) = fixture.reuse(Some(&unchanged));
    assert_eq!(jobs, 1, "only A imports the edited leaf");
    assert_ne!(edited.module(A), unchanged.module(A));
    assert_eq!(edited.module(B), unchanged.module(B));
}

#[test]
fn changing_module_records_and_missing_imports_keep_full_reference_keys() {
    let mut fixture = Fixture::new();
    let mut previous = fixture.check(None, "initial");
    fixture.digest("lib/leaf.ts", "leaf@2");
    previous = fixture.check(Some(&previous), "content");
    fixture
        .generation
        .modules
        .get_mut(B)
        .unwrap()
        .push("lib/leaf.ts".into());
    previous = fixture.check(Some(&previous), "import addition");
    fixture.generation.modules.get_mut(A).unwrap().reverse();
    previous = fixture.check(Some(&previous), "ordered import list");
    fixture
        .generation
        .modules
        .get_mut(B)
        .unwrap()
        .retain(|path| path != "lib/leaf.ts");
    fixture.generation.modules.remove("lib/leaf.ts");
    previous = fixture.check(Some(&previous), "deleted import target with removed edge");
    fixture
        .generation
        .modules
        .insert("missing.ts".into(), vec![A.into()]);
    fixture.digest("missing.ts", "appeared");
    previous = fixture.check(Some(&previous), "missing module appears with cycle");
    fixture.generation.modules.remove("missing.ts");
    previous = fixture.check(Some(&previous), "imported module becomes missing");
    fixture
        .generation
        .modules
        .insert("lib/moved.ts".into(), vec![]);
    fixture
        .generation
        .modules
        .get_mut(A)
        .unwrap()
        .push("lib/moved.ts".into());
    fixture.digest("lib/moved.ts", "moved");
    previous = fixture.check(Some(&previous), "moved module");
    fixture
        .generation
        .modules
        .insert("lib/leaf.ts".into(), vec![]);
    fixture.check(Some(&previous), "deleted module reappears");
}

#[test]
fn binding_attribution_and_resolution_reclassification_keep_full_reference_keys() {
    let mut fixture = Fixture::new();
    let mut previous = fixture.check(None, "initial");
    fixture
        .bindings
        .get_mut(&format!("{C}#default"))
        .unwrap()
        .title = "Renamed".into();
    previous = fixture.check(Some(&previous), "binding title");
    fixture
        .bindings
        .get_mut(&format!("{C}#default"))
        .unwrap()
        .path = "moved/path".into();
    previous = fixture.check(Some(&previous), "binding catalogue path");
    fixture
        .declarations
        .insert(format!("{C}#default"), "lib/other.ts".into());
    previous = fixture.check(Some(&previous), "declarer moves");
    let binding = fixture.bindings.remove(&format!("{C}#default")).unwrap();
    fixture.bindings.insert(format!("{C}#renamed"), binding);
    previous = fixture.check(Some(&previous), "export rename");
    fixture
        .generation
        .modules
        .insert(format!("{C}#renamed"), vec![]);
    fixture.bindings.insert(
        format!("{C}#renamed#nested"),
        fixture.bindings[&format!("{C}#renamed")].clone(),
    );
    previous = fixture.check(Some(&previous), "longer handle module prefix");
    fixture.generation.modules.remove(&format!("{C}#renamed"));
    previous = fixture.check(Some(&previous), "shorter handle module prefix");
    fixture
        .generation
        .resolution_digests
        .insert("lib/tsconfig.json".into(), "local@1".into());
    previous = fixture.check(Some(&previous), "new chain resolution file");
    fixture
        .generation
        .modules
        .insert("outside/read.ts".into(), vec![]);
    fixture
        .generation
        .modules
        .get_mut(A)
        .unwrap()
        .push("outside/read.ts".into());
    previous = fixture.check(Some(&previous), "shared resolution becomes chained");
    fixture.generation.modules.remove("outside/read.ts");
    previous = fixture.check(Some(&previous), "chained resolution becomes shared");
    fixture
        .generation
        .modules
        .remove("node_modules/react-dom/index.js");
    fixture
        .generation
        .modules
        .get_mut("lib/leaf.ts")
        .unwrap()
        .clear();
    fixture.check(
        Some(&previous),
        "non-React runtime manifest leaves every chain",
    );
}

#[test]
fn common_roots_modes_shared_inputs_and_fallbacks_keep_full_reference_keys() {
    let mut fixture = Fixture::new();
    let mut previous = fixture.check(None, "initial");
    fixture.generation.modules.remove(PREVIEWS[0]);
    previous = fixture.check(Some(&previous), "selected preview switches to old member");
    fixture.renderer = Some("runtime/theme.ts".into());
    previous = fixture.check(Some(&previous), "renderer root switches to old member");
    fixture.digest("preview/setup.ts", "preview@2");
    previous = fixture.check(Some(&previous), "preview content");
    fixture.entries.get_mut("story").unwrap().method =
        mokly_catalogue::render_sources::RenderMethod::Screen;
    previous = fixture.check(Some(&previous), "story changes mode");
    fixture.renderer = Some("absent-renderer.tsx".into());
    previous = fixture.check(Some(&previous), "renderer fallback");
    fixture.renderer = Some(RENDERER.into());
    previous = fixture.check(Some(&previous), "renderer returns");
    fixture.entries.get_mut("story").unwrap().method =
        mokly_catalogue::render_sources::RenderMethod::Story;
    fixture
        .generation
        .resolution_digests
        .insert(PREVIEWS[0].into(), "unnamed preview".into());
    previous = fixture.check(Some(&previous), "story fallback");
    fixture.generation.resolution_digests.remove(PREVIEWS[0]);
    previous = fixture.check(Some(&previous), "story returns");
    fixture.bindings.remove(&format!("{B}#default"));
    previous = fixture.check(Some(&previous), "module loses last binding");
    fixture.generation.environment = "environment@2".into();
    previous = fixture.check(Some(&previous), "shared environment");
    fixture
        .generation
        .unattributed
        .insert("external#entry".into());
    fixture.bindings.insert(
        "external#entry".into(),
        fixture.bindings[&format!("{A}#default")].clone(),
    );
    previous = fixture.check(Some(&previous), "unattributed binding");
    fixture.bindings.get_mut("external#entry").unwrap().title = "External renamed".into();
    previous = fixture.check(Some(&previous), "unattributed title");
    fixture
        .generation
        .resolution_digests
        .insert("unread/tsconfig.json".into(), "shared@2".into());
    fixture.check(Some(&previous), "global resolution");
}

#[test]
fn css_content_uses_class_maps_and_full_predecessors_seed_reuse_safely() {
    let mut fixture = Fixture::new();
    let full = RenderKeys::build(&fixture.inputs(), support::fallback());
    assert_eq!(full.reuse_facts_bytes(), 0);
    let (seed, jobs) = fixture.reuse(Some(&full));
    assert_eq!(jobs, 4, "a full predecessor has no reuse facts");
    assert!(seed.reuse_facts_bytes() > 0);
    fixture.digest("styles/plain.css", "plain@2");
    let (plain, jobs) = fixture.reuse(Some(&seed));
    assert_eq!(jobs, 0, "plain CSS contents do not enter render input keys");
    assert_eq!(plain.modules, seed.modules);
    fixture.digest("styles/card.module.css", "source@2");
    let (classes, jobs) = fixture.reuse(Some(&plain));
    assert_eq!(jobs, 0, "CSS Modules use the class map identity");
    fixture
        .generation
        .class_map_digests
        .insert("styles/card.module.css".into(), "map@2".into());
    let (changed, jobs) = fixture.reuse(Some(&classes));
    assert_eq!(jobs, 1, "only A imports this class map");
    assert_ne!(changed.module(A), classes.module(A));
    assert_eq!(changed.module(STORY), classes.module(STORY));
    fixture.check(Some(&changed), "class map reference");
    let fallback = NodeKey("current fallback".into());
    let current = RenderKeys::build_reusing_with_workers(
        &fixture.inputs(),
        fallback.clone(),
        &Unimock::new(()),
        Some(&changed),
    );
    assert_eq!(current.module(A), changed.module(A));
    assert_eq!(current.module("not-an-exporter.ts"), &fallback);
}
