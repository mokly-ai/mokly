//! Replacement generations retain only public files of unchanged documents.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use tempfile::TempDir;

mod support;

const ROUTE: &str = "home/index.mobile.html";
const PUBLIC_FILE: &str = "specs/assets/public.svg";

fn fixture() -> TempDir {
    let root = TempDir::new().unwrap();
    fs::create_dir_all(root.path().join("specs/assets")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<img src=\"../../specs/assets/public.svg\">",
    )
    .unwrap();
    fs::write(
        root.path().join(PUBLIC_FILE),
        "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
    )
    .unwrap();
    root
}

fn render_first(
    root: &Path,
) -> (
    mokly_graph::delivery_inputs::DeliveryInputs,
    Arc<dyn mokly_graph::types::RenderGeneration>,
) {
    let inputs = mokly_graph::delivery_inputs::DeliveryInputs::default();
    let first = support::prepare_with_inputs(root, 0, 1, inputs.clone())
        .0
        .unwrap();
    first.render(ROUTE).unwrap();
    assert!(first.contains_public_file(PUBLIC_FILE));
    (inputs, first)
}

#[test]
fn unchanged_documents_carry_public_files_without_rendering() {
    let _prepare = support::prepare;
    let root = fixture();
    let (inputs, _first) = render_first(root.path());
    let replacement = support::prepare_with_inputs(root.path(), 0, 1, inputs)
        .0
        .unwrap();

    assert!(replacement.contains_public_file(PUBLIC_FILE));
}

#[test]
fn changed_documents_do_not_carry_their_old_public_files() {
    let root = fixture();
    let (inputs, _first) = render_first(root.path());
    let carried = support::prepare_with_inputs(root.path(), 0, 1, inputs.clone())
        .0
        .unwrap();
    assert!(carried.contains_public_file(PUBLIC_FILE));
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Changed\n---\n<img src=\"../../specs/assets/public.svg\">",
    )
    .unwrap();
    let replacement = support::prepare_with_inputs(root.path(), 0, 1, inputs)
        .0
        .unwrap();

    assert!(!replacement.contains_public_file(PUBLIC_FILE));
}

#[test]
fn denied_files_are_not_carried_into_a_replacement() {
    let root = fixture();
    let (inputs, _first) = render_first(root.path());
    let carried = support::prepare_with_inputs(root.path(), 0, 1, inputs.clone())
        .0
        .unwrap();
    assert!(carried.contains_public_file(PUBLIC_FILE));
    fs::remove_file(root.path().join(PUBLIC_FILE)).unwrap();
    let denied_inputs = mokly_graph::delivery_inputs::DeliveryInputs {
        closures: inputs.closures.clone(),
        ..Default::default()
    };
    let replacement = support::prepare_with_inputs(root.path(), 0, 1, denied_inputs)
        .0
        .unwrap();

    assert!(!replacement.contains_public_file(PUBLIC_FILE));
}
