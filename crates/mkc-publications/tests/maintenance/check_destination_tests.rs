//! Check destinations retain both retired slug claims after a rename.

use std::sync::{Arc, Mutex};

use bytes::Bytes;
use chrono::Utc;
use mkc_auth::runtime::RuntimeMock;
use mkc_file_store_interface::deadline::{MAX_OPERATION_DURATION, OperationDeadline};
use mkc_file_store_local::directory::{FileStoreFactory, LocalFileStoreFactory};
use mkc_github_interface::check::CheckRunsMock;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_publications::check_worker::{ChecksWorker, PublicationChecks};
use mkc_publications::locations::Locations;
use mkc_publications::stored_index::BoundedStoredIndexReader;
use mkc_publications::transaction::StoreTransactions;
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::store::Callback;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use super::fixtures::{blob, current_index, file, project, publication, store};

#[test]
fn a_minted_check_destination_resolves_after_both_slugs_are_renamed() {
    let Some((store, _schema)) = store() else {
        return;
    };
    let project = project(store.as_ref());
    let publication = publication(&project, PublicationState::Validating, 0, "feature");
    let bytes = current_index();
    let stored = blob(project.id, &bytes);
    let mut reference = file(project.id, publication.id, stored.key.clone());
    reference.path = INDEX_PATH.into();
    reference.size = stored.size;
    let root = tempfile::tempdir().unwrap();
    let files = LocalFileStoreFactory.open(root.path()).unwrap();
    files
        .put(
            &stored.key,
            Bytes::from(bytes),
            OperationDeadline::new(MAX_OPERATION_DURATION),
        )
        .unwrap();
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_publication(&publication)?;
            queries.insert_blob(&stored)?;
            assert!(queries.mark_blob_stored(&stored.key)?);
            queries.insert_publication_file(&reference)?;
            assert!(queries.ready_publication(publication.id, Changes::NoComparison)?);
            Ok(())
        }))
        .unwrap();
    let mut old_organization = None;
    store
        .read(&mut Callback(&mut |queries| {
            old_organization = queries.organization(project.organization_id)?;
            Ok(())
        }))
        .unwrap();
    let old_organization = old_organization.unwrap();
    let old_organization_slug = old_organization.slug.clone();
    let old_project_slug = project.slug.clone();
    let captured = Arc::new(Mutex::new(None));
    let capture = captured.clone();
    let runtime = Arc::new(Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(Utc::now()),
        RuntimeMock::id
            .each_call(matching!())
            .answers(&|_| Uuid::now_v7()),
    )));
    let checks = PublicationChecks {
        transactions: Arc::new(StoreTransactions {
            store: store.clone(),
        }),
        files: Arc::new(BoundedStoredIndexReader::new(files)),
        runtime,
        locations: Locations {
            app_origin: "https://app.example.com".into(),
            catalogue_domain: "catalogues.example.net".into(),
            catalogue_scheme: "https".into(),
            catalogue_port: None,
        },
        github: Arc::new(Unimock::new(
            CheckRunsMock::upsert
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, check| {
                    *capture.lock().unwrap() = Some(check.details_url.clone());
                    Ok(())
                })),
        )),
    };
    checks
        .rerequest(
            publication.id,
            &project.repository,
            &publication.metadata.as_ref().unwrap().head_sha,
        )
        .unwrap();
    assert_eq!(checks.run_batch(None).unwrap(), 1);
    let old_url = captured.lock().unwrap().clone().unwrap();
    assert_eq!(
        old_url,
        format!(
            "https://app.example.com/{old_organization_slug}/{old_project_slug}/publications/{}?view=changes",
            publication.id
        )
    );

    store
        .transaction(&mut Callback(&mut |queries| {
            let mut organization = queries.organization(project.organization_id)?.unwrap();
            organization.slug = "renamed-organization".parse().unwrap();
            organization.version += 1;
            queries.save_organization(&organization)?;
            let mut renamed_project = queries.project(project.id)?.unwrap();
            renamed_project.slug = "renamed-project".parse().unwrap();
            renamed_project.version += 1;
            queries.save_project(&renamed_project)?;
            let organization_lookup = queries
                .find_organization_by_slug(&old_organization_slug)?
                .unwrap();
            let project_lookup = queries
                .find_project_by_slug(project.organization_id, &old_project_slug)?
                .unwrap();
            assert!(organization_lookup.retired && project_lookup.retired);
            assert_eq!(project_lookup.value.id, project.id);
            assert_eq!(
                queries.publication(publication.id)?.unwrap().id,
                publication.id
            );
            queries.delete_organization(project.organization_id)
        }))
        .unwrap();
}
