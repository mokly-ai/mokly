//! Authored requests ask for membership and a handle without copying reached sets.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_graph::types::RenderGenerationMock;
use unimock::{MockFn, Unimock, matching};

use crate::backend::{Documents, GraphDocuments};
use crate::public_read::PublicReaderMock;
use crate::warnings::TracingWarnings;

#[test]
fn authored_reads_check_one_membership_and_open_one_handle_per_request() {
    for count in [8, 32] {
        let generation = Unimock::new((
            RenderGenerationMock::plans
                .each_call(matching!())
                .returns(BTreeMap::new()),
            RenderGenerationMock::contains_public_file
                .each_call(matching!("assets/large.bin"))
                .returns(true)
                .n_times(count),
        ));
        let reader = Unimock::new(
            PublicReaderMock::open
                .each_call(matching!("assets/large.bin"))
                .answers(&|_, _| None)
                .n_times(count),
        );
        {
            let documents = GraphDocuments::new(
                Arc::new(generation.clone()),
                Arc::new(reader.clone()),
                Arc::new(TracingWarnings),
            );
            for _ in 0..count {
                assert!(documents.authored("assets/large.bin").is_none());
            }
        }
    }
}
