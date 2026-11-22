//! A controlled edit after the first resource read invalidates its real graph document.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_cli::serve::PreparedServe;
use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::types::RenderGraph;
use mokly_watch::error::Error;
use mokly_watch::event::{Action, Batch};
use unimock::Unimock;

use self::support::{Fixture, fixture};
use super::WatchInputs;

#[path = "serve_resource_support.rs"]
mod support;

#[tokio::test]
async fn an_edit_after_the_first_resource_read_recomputes_its_document() {
    edit_recomputes(false, false, 2).await;
}

#[tokio::test]
async fn a_candidate_render_before_adoption_keeps_its_resource_edit() {
    edit_recomputes(true, false, 2).await;
}

#[tokio::test]
async fn a_failed_resource_attachment_stops_reads_and_can_be_retried() {
    edit_recomputes(false, true, 3).await;
}

async fn edit_recomputes(before_adoption: bool, fail_first: bool, expected_renders: usize) {
    let Fixture {
        watch,
        graph,
        prepared,
        catalogue,
        edited,
        renders,
    } = fixture(fail_first);
    let candidate = watch.candidate(&prepared).unwrap();
    if before_adoption {
        prepared.generation.render("page/index.html").unwrap();
        watch.clone().adopt(candidate, &prepared);
    } else {
        watch.clone().adopt(candidate, &prepared);
        if fail_first {
            assert_failed_attachment(&prepared, &edited);
        }
        prepared.generation.render("page/index.html").unwrap();
    }
    let mut batch = Batch::default();
    watch.drain(&mut batch, Arc::new(Unimock::new(()))).await;

    assert_eq!(
        batch.action,
        Some(Action::Reload),
        "the edit in the former read-to-attachment gap must reach Serve"
    );
    assert_eq!(
        batch.events.keys().cloned().collect::<BTreeSet<_>>(),
        BTreeSet::from([Path::new("/repo/assets/new.svg").to_path_buf()])
    );
    let next = PreparedServe {
        generation: graph
            .prepare(prepared.config.clone(), catalogue, None)
            .unwrap(),
        config: prepared.config.clone(),
        summary: prepared.summary.clone(),
    };
    assert_ne!(
        prepared.generation.plans()["page/index.html"].key,
        next.generation.plans()["page/index.html"].key
    );
    let candidate = watch.candidate(&next).unwrap();
    watch.clone().adopt(candidate, &next);
    next.generation.render("page/index.html").unwrap();
    assert_eq!(
        renders.load(Ordering::SeqCst),
        expected_renders,
        "the changed resource must recompute its referencing document"
    );
}

fn assert_failed_attachment(prepared: &PreparedServe, edited: &AtomicBool) {
    let failed = prepared.generation.render("page/index.html");
    assert!(
        matches!(failed, Err(GraphError::Attempt { .. })),
        "attachment failure must stop the render"
    );
    let Err(GraphError::Attempt { failures, .. }) = failed else {
        panic!("failed render")
    };
    assert!(
        matches!(failures.as_slice(), [GraphError::Internal(InternalError::Provider { source })]
        if matches!(source.downcast_ref::<Error>(), Some(Error::Rescan)))
    );
    assert!(
        !edited.load(Ordering::SeqCst),
        "failed attachment must read no resource bytes"
    );
    assert_eq!(
        prepared.generation.watch_files(),
        BTreeSet::new(),
        "a failed attachment stays retryable"
    );
}
