//! After the step, the first edit shares every unchanged detail and serves the same bytes.

use std::sync::Arc;

use mokly_graph::types::RenderGeneration;
use mokly_test_support::capture::Trace;
use tokio::sync::watch;

use crate::background::Background;
use crate::detail_encoding::EncodedDetails;
use crate::publication::Publications;
use crate::publication_sequence::support::{generation, narrow};

use super::support::{changed, primed, same_bytes};

/// A generation of a number of entries after an edit.
type Edit = fn(usize, usize) -> Arc<dyn RenderGeneration>;

#[tokio::test]
async fn the_first_edit_after_the_step_encodes_no_unchanged_detail() {
    let edits: [(&str, Edit); 2] = [
        ("an edit that moves every view", generation),
        ("a narrow edit", narrow),
    ];
    for (case, edit) in edits {
        let session = changed(4);
        let reference = changed(4);
        let (_stop, stop) = watch::channel(false);
        session.step(Arc::new(EncodedDetails)).run(stop).await;
        assert_eq!(primed(&session.shared.current()), 4, "{case}: primed paths");
        let traces = Trace::default();
        let builds = || traces.closed("detail.build").len();
        let edited = traces.in_scope(|| session.rebuild(edit(4, 1)));
        assert_eq!(builds(), 0, "{case}: details that the first edit encodes");
        let full = reference.rebuild(edit(4, 1));
        same_bytes(&edited, &full, case).await;
    }
}
