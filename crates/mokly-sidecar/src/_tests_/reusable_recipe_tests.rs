//! Complete evidence admits optional reuse without restricting live restores.

use std::sync::Arc;

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
    incomplete.reuse_evidence.complete = false;
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
    unverified.reuse_evidence.durable = false;
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
