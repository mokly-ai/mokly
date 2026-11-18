//! Complete evidence admits optional reuse without restricting live restores.

use std::sync::Arc;

use crate::compiled::{PhysicalInput, UncapturedEvidence};
use crate::compiled_fixture::compiled;
use crate::durable_recipe::DurableRecipe;
use crate::methods::Bundle;
use crate::methods::Call;
use crate::reusable_recipe::{ReusableRecipe, disk_seed_request};

fn params() -> Bundle {
    Bundle {
        evaluation: None,
        entry_files: vec!["entry.ts".into()],
        renderer: None,
        stories_files: vec![],
        module_resolution: Default::default(),
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
    }
}

#[test]
fn incomplete_evidence_cannot_enter_optional_reuse_and_disk_seeds_have_one_envelope() {
    let mut incomplete = compiled("identity");
    Arc::make_mut(&mut incomplete.reuse_evidence).complete = false;
    assert!(
        ReusableRecipe::new("generation".into(), params(), vec![], Arc::new(incomplete)).is_none()
    );
    let recipe = ReusableRecipe::new(
        "generation".into(),
        params(),
        vec![],
        Arc::new(compiled("identity")),
    )
    .unwrap();
    let mut unverified = compiled("identity");
    Arc::make_mut(&mut unverified.reuse_evidence).durable = false;
    assert!(compiled("identity").same_recipe(&unverified));
    let memory =
        ReusableRecipe::new("generation".into(), params(), vec![], Arc::new(unverified)).unwrap();
    assert!(DurableRecipe::new(memory).is_none());
    let request = disk_seed_request(&DurableRecipe::new(recipe).unwrap());
    assert_eq!(request.id, 1);
    let Call::RestoreGeneration(restored) = request.call else {
        panic!("expected a restore")
    };
    assert_eq!(restored.generation, "disk:generation");
    assert_eq!(restored.compiled.identity, "identity");
}

#[test]
fn an_uncaptured_marker_cannot_become_durable_when_flags_are_forged() {
    let mut value = serde_json::to_value(compiled("identity")).unwrap();
    value["reuseEvidence"]["uncaptured"] = "serveEdit".into();
    let compiled = Arc::new(serde_json::from_value(value).unwrap());
    let durable = ReusableRecipe::new("generation".into(), params(), vec![], compiled)
        .and_then(DurableRecipe::new);
    assert!(durable.is_none());
}

#[test]
fn live_only_admission_requires_the_exact_marker_and_a_toolchain() {
    for (complete, durable, nonempty, toolchain, expected) in [
        (false, false, false, "fixture", Some("generation")),
        (true, false, false, "fixture", None),
        (false, true, false, "fixture", None),
        (false, false, true, "fixture", None),
        (false, false, false, "", None),
    ] {
        let mut compiled = compiled("identity");
        compiled.toolchain = toolchain.into();
        let evidence = Arc::make_mut(&mut compiled.reuse_evidence);
        evidence.complete = complete;
        evidence.durable = durable;
        evidence.uncaptured = Some(UncapturedEvidence::ServeEdit);
        if nonempty {
            evidence
                .inputs
                .insert("/repo/config.json".into(), PhysicalInput::Absent);
        }
        let recipe = ReusableRecipe::new("generation".into(), params(), vec![], Arc::new(compiled));
        assert_eq!(recipe.as_ref().map(ReusableRecipe::generation), expected);
    }
}
