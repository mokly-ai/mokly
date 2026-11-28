//! Publication context and history must have constant database-only read cost.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mkc_domain::values::Visibility;
use mkc_file_store_interface::store::FileStoreMock;
use mkc_publications::stored_index::BoundedStoredIndexReader;
use mkc_store_interface::blob::BlobsMock;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::publication_screens::PublicationScreensMock;
use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use mkc_store_interface::viewer::ViewerReadsMock;
use unimock::{MockFn, Unimock, matching};

use crate::viewer::artifacts::StoredArtifacts;
use crate::viewer::input::{Action, Query, Read};
use crate::viewer::service::{Viewer, ViewerService};

use super::support::{
    PROJECT, PUBLICATION, file, locations, project, viewer_publication, workspace,
};

#[test]
fn history_and_publication_never_read_files_or_recheck_each_row() {
    for read in [
        Read::History,
        Read::Publication(PUBLICATION),
        Read::Share(PUBLICATION),
    ] {
        let file_reads = Arc::new(AtomicUsize::new(0));
        let index_reads = Arc::new(AtomicUsize::new(0));
        let transactions = Arc::new(AtomicUsize::new(0));
        let publication_reads = Arc::new(AtomicUsize::new(0));
        let files = {
            let calls = file_reads.clone();
            Unimock::new(
                FileStoreMock::get
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, _| {
                        calls.fetch_add(1, Ordering::SeqCst);
                        Ok(Some(
                            include_bytes!("../../../../mkc-mokly-contract/fixtures/index-v9.json")
                                .to_vec(),
                        ))
                    }))
                    .at_least_times(0),
            )
            .no_verify_in_drop()
        };
        let queries = {
            let calls = index_reads.clone();
            let publication_calls = publication_reads.clone();
            Unimock::new((
                ProjectsMock::project
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok(Some(project(Visibility::Public)))),
                OrganizationsMock::organization
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok(Some(workspace()))),
                ViewerReadsMock::viewer_publications
                    .each_call(matching!(_, _, _, _))
                    .answers(&|_, _, _, _, _| Ok(vec![viewer_publication(true); 100]))
                    .at_least_times(0),
                ViewerReadsMock::viewer_publication
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, _, _| {
                        publication_calls.fetch_add(1, Ordering::SeqCst);
                        Ok(Some(viewer_publication(true)))
                    }))
                    .at_least_times(0),
                PublicationScreensMock::publication_screen_selection
                    .each_call(matching!(_, _))
                    .answers(&|_, _, _| Ok(true))
                    .at_least_times(0),
                BlobsMock::publication_file
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, _, _| {
                        calls.fetch_add(1, Ordering::SeqCst);
                        Ok(Some(file()))
                    }))
                    .at_least_times(0),
            ))
            .no_verify_in_drop()
        };
        let calls = transactions.clone();
        let service = ViewerService {
            store: Arc::new(Unimock::new(
                StoreMock::read
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                        calls.fetch_add(1, Ordering::SeqCst);
                        assert_eq!(work.run(&mut queries.clone()).unwrap(), Decision::Commit);
                        Ok(())
                    })),
            )),
            artifacts: Arc::new(StoredArtifacts {
                files: Arc::new(BoundedStoredIndexReader::new(Arc::new(files))),
            }),
            locations: locations(),
        };
        let action = Action {
            project: PROJECT,
            read,
        };
        let query = Query::parse(
            action,
            match read {
                Read::History => "limit=100",
                Read::Share(_) => "catalogueScreen=start&viewport=desktop&scheme=light",
                _ => "",
            },
        )
        .unwrap();
        service.execute(None, action, query).unwrap();
        assert_eq!(file_reads.load(Ordering::SeqCst), 0, "{read:?}");
        assert_eq!(index_reads.load(Ordering::SeqCst), 0, "{read:?}");
        assert_eq!(transactions.load(Ordering::SeqCst), 1, "{read:?}");
        assert_eq!(
            publication_reads.load(Ordering::SeqCst),
            usize::from(!matches!(read, Read::History)),
            "{read:?}"
        );
    }
}
