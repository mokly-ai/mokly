//! Collected validation preserves public resource admission for historical output.

use std::path::PathBuf;

use mokly_graph::collection::ComparisonCollector;
use mokly_graph::error::Result;
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
    let mut collector = ReleasedInputs;
    let summary = after.collect_comparison(&mut collector).unwrap();
    assert_eq!(summary.closure, expected);
    assert_eq!(after.public_files(), expected);
    assert!(expected.iter().all(|path| after.contains_public_file(path)));
}
