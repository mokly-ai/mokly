//! Build checks retain released index moves and current screen-path links.

use std::sync::Arc;

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::values::Plan;
use mkc_file_store_interface::store::FileStoreMock;
use mkc_github_interface::check::{CheckRunsMock, Conclusion};
use mkc_github_interface::checks::Status;
use mkc_mokly_contract::index::{CatalogueIndex, INDEX_PATH};
use mkc_mokly_contract::limits::Limits;
use mkc_store_interface::blob::{BlobsMock, PublicationFile};
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_check::BuildChecksMock;
use mkc_store_interface::build_state::BuildState;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::publication::PublicationsMock;
use unimock::{MockFn, Unimock, matching};

use crate::build_check_worker::{BuildCheckDelivery, BuildChecksWorker};
use crate::check_worker::PublicationChecks;
use crate::tests::build_fixtures::{
    BUILD, OPERATION, build, check, clock_runtime, locations, organization, project, publication,
    transactions,
};

const INDEX_BYTES: &[u8] =
    include_bytes!("../../../../mkc-mokly-contract/fixtures/moves-index-v9.json");

#[test]
fn published_build_renders_shared_moves_fixture_without_losing_its_identity() {
    let index = CatalogueIndex::parse(INDEX_BYTES, Limits::default()).unwrap();
    let path = INDEX_PATH;
    let mut publication = publication();
    let metadata = publication.metadata.as_mut().unwrap();
    metadata.base_ref = index.base().map(str::to_owned);
    metadata.base_sha = index.base_commit().map(str::to_owned);
    publication.build_id = Some(BUILD);
    let mut published = build(BuildState::Published);
    published.publication_id = Some(publication.id);
    let mut claimed = check();
    claimed.attempts = 1;
    let queries = Unimock::new((
        BuildChecksMock::pending_build_checks
            .some_call(matching!(_, 100, None))
            .returns(Ok(vec![check()])),
        BuildChecksMock::claim_build_check
            .some_call(matching!(_, 0, _))
            .returns(Ok(Some(claimed))),
        BuildsMock::build_by_id
            .some_call(matching!(_))
            .returns(Ok(Some(published))),
        ProjectsMock::project
            .some_call(matching!(_))
            .returns(Ok(Some(project()))),
        OrganizationsMock::organization
            .some_call(matching!(_))
            .returns(Ok(Some(organization(Plan::Free)))),
        PublicationsMock::publication
            .some_call(matching!(_))
            .returns(Ok(Some(publication.clone()))),
        BlobsMock::publication_file
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, id, requested| {
                assert_eq!(id, publication.id);
                assert_eq!(requested, path);
                Ok(Some(PublicationFile {
                    publication_id: id,
                    project_id: publication.project_id,
                    path: path.into(),
                    key: BlobKey {
                        hash: BlobHash::digest(INDEX_BYTES),
                        incarnation: OPERATION,
                    },
                    content_type: "application/json".into(),
                    size: INDEX_BYTES.len() as i64,
                }))
            })),
        BuildChecksMock::deliver_build_check
            .some_call(matching!(_, 1, 1))
            .returns(Ok(true)),
    ));
    let store = transactions(queries);
    let runtime = clock_runtime();
    let renderer = PublicationChecks {
        transactions: store.clone(),
        files: Arc::new(Unimock::new(
            FileStoreMock::get
                .some_call(matching!(_))
                .returns(Ok(Some(INDEX_BYTES.to_vec()))),
        )),
        github: Arc::new(Unimock::new(())),
        runtime: runtime.clone(),
        locations: locations(),
    };
    let github = Unimock::new(CheckRunsMock::upsert.some_call(matching!(_)).answers(
        &|_, check| {
            assert_eq!(check.status, Status::Completed);
            assert_eq!(check.conclusion, Some(Conclusion::Success));
            assert_eq!(check.external_id, format!("mokly-build:{BUILD}"));
            assert!(check.details_url.ends_with(&format!("/builds/{BUILD}")));
            assert!(
                check
                    .summary
                    .starts_with("9 changed, 5 added, 8 removed.\n5 moved.")
            );
            assert!(check.summary.contains("catalogueScreen=move-after"));
            assert!(check.summary.contains("catalogueScreen=reuse-after"));
            assert!(
                check
                    .summary
                    .contains("catalogueScreen=variant-target%2Fsaved")
            );
            assert!(!check.summary.contains("catalogueScreen=move-before"));
            Ok(())
        },
    ));
    let worker = BuildCheckDelivery {
        transactions: store,
        github: Arc::new(github),
        publications: Arc::new(renderer),
        runtime,
        locations: locations(),
    };
    assert_eq!(worker.run_batch(None).unwrap(), 1);
}
