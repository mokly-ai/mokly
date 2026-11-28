//! Read rollback, incomplete upstream metadata and expiry during artifact IO.

use std::sync::Arc;

use mkc_domain::values::Visibility;
use mkc_file_store_interface::store::FileStoreMock;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_publications::stored_index::BoundedStoredIndexReader;
use mkc_store_interface::blob::BlobsMock;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use mkc_store_interface::viewer::ViewerReadsMock;
use unimock::{MockFn, Unimock, matching};

use crate::payload::Payload;
use crate::platform::error::Error;
use crate::viewer::artifacts::StoredArtifacts;
use crate::viewer::input::{Action, Query, Read};
use crate::viewer::service::{Viewer, ViewerService};

use super::support::{
    INDEX_BYTES, PROJECT, PUBLICATION, file, locations, project, viewer_publication, workspace,
};

#[test]
fn denial_rolls_back_and_never_reads_publication_metadata() {
    let service = ViewerService {
        store: Arc::new(Unimock::new(
            StoreMock::read
                .next_call(matching!(_))
                .answers(&|_, work: &mut dyn Transaction| {
                    let mut queries = Unimock::new(
                        ProjectsMock::project
                            .next_call(matching!(_))
                            .returns(Ok(Some(project(Visibility::Private)))),
                    );
                    assert_eq!(work.run(&mut queries).unwrap(), Decision::Rollback);
                    Ok(())
                })
                .once(),
        )),
        artifacts: Arc::new(Unimock::new(())),
        locations: locations(),
    };
    let action = Action {
        project: PROJECT,
        read: Read::Publication(PUBLICATION),
    };
    assert!(matches!(
        service.execute(None, action, Query::parse(action, "").unwrap()),
        Err(Error::NotFound)
    ));
}

#[test]
fn current_only_screen_metadata_is_explicitly_unavailable_until_upstream_release() {
    for read in [Read::Screens(PUBLICATION), Read::Share(PUBLICATION)] {
        let service = ViewerService {
            store: Arc::new(Unimock::new(
                StoreMock::read
                    .next_call(matching!(_))
                    .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                        let mut queries = Unimock::new((
                            ProjectsMock::project
                                .next_call(matching!(_))
                                .returns(Ok(Some(project(Visibility::Public)))),
                            OrganizationsMock::organization
                                .next_call(matching!(_))
                                .returns(Ok(Some(workspace()))),
                            ViewerReadsMock::viewer_publication
                                .next_call(matching!(_, _))
                                .returns(Ok(Some(viewer_publication(false)))),
                        ));
                        assert_eq!(
                            work.run(&mut queries).unwrap(),
                            if matches!(read, Read::Share(_)) {
                                Decision::Rollback
                            } else {
                                Decision::Commit
                            }
                        );
                        Ok(())
                    }))
                    .once(),
            )),
            artifacts: Arc::new(Unimock::new(())),
            locations: locations(),
        };
        let action = Action {
            project: PROJECT,
            read,
        };
        let query = Query::parse(
            action,
            if matches!(read, Read::Share(_)) {
                "catalogueScreen=start"
            } else {
                ""
            },
        )
        .unwrap();
        assert!(matches!(
            service.execute(None, action, query),
            Err(Error::OperationUnavailable)
        ));
    }
}

#[test]
fn artifact_reads_recheck_retention_before_returning_screens() {
    for (expired, missing_bytes) in [(false, false), (true, false), (true, true), (false, true)] {
        let store = Unimock::new((
            StoreMock::read
                .next_call(matching!(_))
                .answers(&|_, work: &mut dyn Transaction| {
                    let mut queries = Unimock::new((
                        ProjectsMock::project
                            .next_call(matching!(_))
                            .returns(Ok(Some(project(Visibility::Public)))),
                        OrganizationsMock::organization
                            .next_call(matching!(_))
                            .returns(Ok(Some(workspace()))),
                        ViewerReadsMock::viewer_publication
                            .next_call(matching!(_, _))
                            .returns(Ok(Some(viewer_publication(true)))),
                        BlobsMock::publication_file
                            .next_call(matching!((_, path) if *path == INDEX_PATH))
                            .returns(Ok(Some(file()))),
                    ));
                    assert_eq!(work.run(&mut queries).unwrap(), Decision::Commit);
                    Ok(())
                })
                .once(),
            StoreMock::read
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                    let mut queries = Unimock::new((
                        ProjectsMock::project
                            .next_call(matching!(_))
                            .returns(Ok(Some(project(Visibility::Public)))),
                        ViewerReadsMock::viewer_publication
                            .next_call(matching!(_, _))
                            .returns(Ok((!expired).then(|| viewer_publication(true)))),
                    ));
                    assert_eq!(
                        work.run(&mut queries).unwrap(),
                        if expired {
                            Decision::Rollback
                        } else {
                            Decision::Commit
                        }
                    );
                    Ok(())
                }))
                .once(),
        ));
        let files = Arc::new(Unimock::new(
            FileStoreMock::get
                .some_call(matching!((key) if *key == &file().key))
                .returns(Ok((!missing_bytes).then(|| INDEX_BYTES.to_vec()))),
        ));
        let service = ViewerService {
            store: Arc::new(store),
            artifacts: Arc::new(StoredArtifacts {
                files: Arc::new(BoundedStoredIndexReader::new(files)),
            }),
            locations: locations(),
        };
        let action = Action {
            project: PROJECT,
            read: Read::Screens(PUBLICATION),
        };
        let result = service.execute(None, action, Query::parse(action, "limit=1").unwrap());
        if expired {
            assert!(matches!(result, Err(Error::NotFound)));
        } else if missing_bytes {
            assert!(matches!(result, Err(Error::Internal(_))));
        } else {
            let Payload::Screens(page) = result.unwrap().payload else {
                panic!("screens response");
            };
            assert_eq!(page.items.len(), 1);
            assert!(page.next_cursor.is_some());
        }
    }
}
