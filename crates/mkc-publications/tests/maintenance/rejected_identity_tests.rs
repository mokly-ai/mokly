//! Refusals retain and deliver only an authorized envelope identity through Postgres.

use std::io::Cursor;
use std::sync::Arc;

use chrono::Utc;
use diesel::prelude::*;
use diesel::sql_types::Nullable;
use diesel::sql_types::Text;
use mkc_auth::runtime::{SystemRuntime, hash};
use mkc_db::schema::publication_events::publication_events;
use mkc_github_interface::check::{CheckRunsMock, Conclusion};
use mkc_mokly_contract::error::{ArtifactKind, Limit, Rejection};
use mkc_mokly_contract::limits::Limits;
use mkc_mokly_contract::manifest::UploadManifest;
use mkc_publications::check_worker::{ChecksWorker, PublicationChecks};
use mkc_publications::error::Error;
use mkc_publications::ingest::{Ingest, PublicationIngest};
use mkc_publications::locations::Locations;
use mkc_publications::policy::DatabaseAccessPolicy;
use mkc_publications::transaction::StoreTransactions;
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::store::Callback;
use mkc_store_interface::token::Token;
use mkc_store_interface::viewer::HistoryFilter;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use self::support::{PLAN, Refusal, assert_failure_code, validator};
use super::fixtures::{project, store};

#[path = "rejected_identity_support.rs"]
mod support;

#[test]
fn refused_comparison_upload_retains_its_authorized_base_identity() {
    for refusal in [
        Refusal::StoredSizeConflict,
        Refusal::MissingFile,
        Refusal::TooLarge,
        Refusal::UnsupportedVersion,
        Refusal::ForeignRepository,
        Refusal::ForeignConfig,
    ] {
        refused(refusal);
    }
}

#[derive(QueryableByName)]
struct Generation {
    #[diesel(sql_type = Nullable<Text>)]
    comparison_path: Option<String>,
}

fn refused(refusal: Refusal) {
    let Some((store, schema)) = store() else {
        return;
    };
    let project = project(store.as_ref());
    let bearer = format!("mkc_{}", "a".repeat(64));
    let token = Token {
        id: Uuid::now_v7().into(),
        project_id: project.id,
        name: "Refused comparison".into(),
        prefix: "mkc_aaaa".into(),
        token_hash: hash(&bearer),
        created_at: Utc::now(),
        last_used_at: None,
        revoked_at: None,
    };
    store
        .transaction(&mut Callback(&mut |queries| queries.insert_token(&token)))
        .unwrap();
    let manifest = UploadManifest::parse(
        include_bytes!("../../../mkc-mokly-contract/fixtures/mokly-upload.json"),
        Limits::default(),
    )
    .unwrap();
    let expected_head = manifest.head_sha.clone();
    let expected = match refusal {
        Refusal::ForeignRepository | Refusal::ForeignConfig => None,
        _ => Some(manifest.clone()),
    };
    let (validator, rolled_back) = validator(refusal, manifest, store.as_ref(), project.id);
    let empty = Arc::new(Unimock::new(()));
    let ingest = PublicationIngest {
        transactions: Arc::new(StoreTransactions {
            store: store.clone(),
        }),
        runtime: Arc::new(SystemRuntime),
        policy: Arc::new(DatabaseAccessPolicy),
        validator,
        writer: empty.clone(),
        files: empty,
    };
    let authorization = ingest.authorize(project.id, &bearer).unwrap();
    let result = ingest.preflight(authorization, &mut Cursor::new(PLAN));
    assert!(
        matches!(
            (refusal, &result),
            (
                Refusal::MissingFile,
                Err(Error::InvalidBundle {
                    reason: Rejection::MissingFile
                })
            ) | (
                Refusal::StoredSizeConflict,
                Err(Error::InvalidBundle {
                    reason: Rejection::ArtifactDigest
                })
            ) | (
                Refusal::TooLarge,
                Err(Error::TooLarge { limit: Limit::File })
            ) | (
                Refusal::UnsupportedVersion,
                Err(Error::UnsupportedVersion {
                    artifact: ArtifactKind::Index,
                    version: Some(8)
                })
            ) | (
                Refusal::ForeignRepository | Refusal::ForeignConfig,
                Err(Error::Forbidden)
            )
        ),
        "refused comparison outcome for {refusal:?}: {result:?}"
    );
    store
        .read(&mut Callback(&mut |queries| {
            let rows =
                queries.viewer_publications(project.id, &HistoryFilter::default(), None, 10)?;
            assert_eq!(rows.len(), 1);
            let publication = &rows[0].publication;
            let metadata = publication.metadata.as_ref();
            assert_eq!(
                metadata.is_some(),
                expected.is_some(),
                "stored metadata for {refusal:?}"
            );
            assert_eq!(
                metadata.map(|metadata| metadata.head_sha.as_str()),
                expected.as_ref().map(|manifest| manifest.head_sha.as_str()),
                "retained head for {refusal:?}"
            );
            assert_eq!(
                metadata.map(|metadata| &metadata.head_sha),
                expected.as_ref().map(|manifest| &manifest.head_sha)
            );
            assert_eq!(
                metadata.map(|metadata| &metadata.base_ref),
                expected.as_ref().map(|manifest| &manifest.base_ref)
            );
            assert_eq!(
                metadata.map(|metadata| &metadata.base_sha),
                expected.as_ref().map(|manifest| &manifest.base_sha)
            );
            assert_eq!(publication.state, PublicationState::Failed);
            assert_failure_code(refusal, publication.failure);
            assert_eq!(queries.publication_files(publication.id)?.len(), 0);
            for hash in rolled_back.iter() {
                assert_eq!(queries.blob(project.id, hash)?.map(|blob| blob.size), None);
            }
            Ok(())
        }))
        .unwrap();
    let stored = diesel::sql_query("SELECT comparison_path FROM publications")
        .get_result::<Generation>(&mut schema.connection())
        .unwrap();
    assert_eq!(stored.comparison_path, None);
    let events = publication_events::table
        .select(publication_events::kind)
        .order((publication_events::created_at, publication_events::id))
        .load::<String>(&mut schema.connection())
        .unwrap();
    let expected_events: &[&str] = match refusal {
        Refusal::ForeignRepository | Refusal::ForeignConfig => &["uploading", "failed"],
        _ => &["uploading", "validating", "failed"],
    };
    assert_eq!(events, expected_events, "stored events for {refusal:?}");
    let delivery = CheckRunsMock::upsert
        .some_call(matching!(_))
        .answers_arc(Arc::new(move |_, check| {
            assert_eq!(check.head_sha, expected_head);
            assert_eq!(check.conclusion, Some(Conclusion::Failure));
            Ok(())
        }))
        .once();
    let github = match expected {
        Some(_) => Unimock::new(delivery),
        None => Unimock::new(()),
    };
    let checks = PublicationChecks {
        transactions: ingest.transactions.clone(),
        files: Arc::new(Unimock::new(())),
        github: Arc::new(github),
        runtime: Arc::new(SystemRuntime),
        locations: Locations {
            app_origin: "https://app.mokly.test".into(),
            catalogue_domain: "catalogue.mokly.test".into(),
            catalogue_scheme: "https".into(),
            catalogue_port: None,
        },
    };
    assert_eq!(
        checks.run_batch(Some(project.id)).unwrap(),
        1,
        "delivered batch count for {refusal:?}"
    );
}
