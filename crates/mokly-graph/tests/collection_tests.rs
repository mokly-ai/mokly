//! Collected validation preserves public resource admission for historical output.

use std::path::PathBuf;

use mokly_graph::collection::ComparisonCollector;
use mokly_graph::error::{GraphError, Result};
use mokly_graph::types::ComparisonDocument;

struct ReleasedInputs;
impl ComparisonCollector for ReleasedInputs {
    fn collect(&mut self, _: &str, _: ComparisonDocument) -> Result<()> {
        Ok(())
    }
}

mod support;

#[test]
fn collected_validation_retains_the_same_public_files_as_document_capture() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/catalogue");
    let (before, _) = support::prepare(&root, 0, 2);
    let before = before.unwrap();
    before.render_all().unwrap();
    for route in before.plans().keys() {
        before.comparison_input(route).unwrap();
    }
    let expected = before.public_files();
    assert!(!expected.is_empty());
    let (after, _) = support::prepare(&root, 0, 2);
    let after = after.unwrap();
    assert!(after.public_files().is_empty());
    let mut collector = ReleasedInputs;
    let summary = after.collect_comparison(&mut collector).unwrap();
    assert_eq!(summary.closure, expected);
    assert_eq!(after.public_files(), expected);
    assert!(expected.iter().all(|path| after.contains_public_file(path)));
}

#[test]
fn a_failed_collection_keeps_its_files_private() {
    struct RejectedInputs;
    impl ComparisonCollector for RejectedInputs {
        fn collect(&mut self, _: &str, _: ComparisonDocument) -> Result<()> {
            Err(GraphError::InputsChanged {
                path: "collector".into(),
            })
        }
    }
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/catalogue");
    let (generation, _) = support::prepare(&root, 0, 2);
    let generation = generation.unwrap();
    assert!(generation.collect_comparison(&mut RejectedInputs).is_err());
    assert!(generation.public_files().is_empty());
    assert!(!generation.contains_public_file("specs/assets/public.svg"));
    generation.collect_comparison(&mut ReleasedInputs).unwrap();
    assert!(
        generation
            .public_files()
            .contains("specs/assets/public.svg")
    );
    assert!(generation.contains_public_file("specs/assets/public.svg"));
}
