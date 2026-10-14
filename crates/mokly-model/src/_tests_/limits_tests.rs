//! Traversal stops at the node budget without expanding a large pending stack.

use serde_json::json;

use super::{MAX_NODES, walk};

#[test]
fn excess_data_has_a_fixed_visit_bound_at_both_input_sizes() {
    for size in [MAX_NODES + 1, (MAX_NODES + 1) * 4] {
        let value = json!({"value":vec![0;size]});
        let mut visited = 0;
        let error = walk(&value, &mut String::new(), 0, &mut visited, true).unwrap_err();
        assert_eq!(visited, MAX_NODES);
        assert_eq!(error.0, "/value/9998");
        assert_eq!(error.1, "exceeds 10000 visited nodes");
    }
}
