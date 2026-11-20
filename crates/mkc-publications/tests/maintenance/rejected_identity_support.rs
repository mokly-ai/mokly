//! Validator refusals and stored size-conflict setup for the rejected identity test.

use std::collections::BTreeMap;
use std::io::Cursor;
use std::sync::Arc;

use chrono::Utc;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::ProjectId;
use mkc_mokly_contract::archive::GzipTarReader;
use mkc_mokly_contract::bundle::{
    ContractValidator, PlanBundle, UploadValidator, UploadValidatorMock,
};
use mkc_mokly_contract::error::{self, ArtifactKind, Limit, Rejection};
use mkc_mokly_contract::limits::Limits;
use mkc_mokly_contract::manifest::UploadManifest;
use mkc_store_interface::blob::Blob;
use mkc_store_interface::publication::PublicationFailure;
use mkc_store_interface::store::{Callback, Store};
use mkc_upload_memory::budget::ProcessUploadMemoryBudget;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

/// Refusals with either an authorized or a foreign fixture identity.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Refusal {
    /// A stored blob has a different size for the same hash.
    StoredSizeConflict,
    /// A declared file is absent.
    MissingFile,
    /// A file exceeds the upload limit.
    TooLarge,
    /// The index version is unsupported.
    UnsupportedVersion,
    /// The parsed envelope names another repository owner.
    ForeignRepository,
    /// The parsed envelope names another config path.
    ForeignConfig,
}

/// The released plan archive that contains the fixture comparison identity.
pub(super) const PLAN: &[u8] = include_bytes!("../../../mkc-mokly-contract/fixtures/plan.tar.gz");

/// Compose the real size conflict or a validator refusal with a parsed envelope.
pub(super) fn validator(
    refusal: Refusal,
    mut manifest: UploadManifest,
    store: &dyn Store,
    project_id: ProjectId,
) -> (Arc<dyn UploadValidator>, Option<BlobHash>) {
    if refusal == Refusal::StoredSizeConflict {
        let receiver = Arc::new(ContractValidator {
            reader: Arc::new(GzipTarReader::new(Arc::new(
                ProcessUploadMemoryBudget::new(536_870_912),
            ))),
            limits: Limits::default(),
        });
        let bundle = receiver.validate(&mut Cursor::new(PLAN)).unwrap();
        let absent = seed_size_conflict(store, project_id, &bundle);
        return (receiver, Some(absent));
    }
    match refusal {
        Refusal::ForeignRepository => manifest.repository.owner = "another".into(),
        Refusal::ForeignConfig => manifest.config_path = "another.json".into(),
        _ => {}
    }
    let validator = Unimock::new(
        UploadValidatorMock::validate_with_envelope
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, envelope| {
                *envelope = Some(manifest.clone());
                Err(match refusal {
                    Refusal::MissingFile => error::Error::Invalid {
                        reason: Rejection::MissingFile,
                    },
                    Refusal::ForeignRepository | Refusal::ForeignConfig => error::Error::Invalid {
                        reason: Rejection::PlanFiles,
                    },
                    Refusal::TooLarge => error::Error::TooLarge { limit: Limit::File },
                    Refusal::UnsupportedVersion => error::Error::UnsupportedVersion {
                        artifact: ArtifactKind::Index,
                        version: Some(8),
                    },
                    Refusal::StoredSizeConflict => unreachable!(),
                })
            })),
    );
    (Arc::new(validator), None)
}

/// Only authorized refusals have specified stored failure classifications.
pub(super) fn assert_failure_code(refusal: Refusal, actual: Option<PublicationFailure>) {
    let expected = match refusal {
        Refusal::MissingFile | Refusal::StoredSizeConflict => PublicationFailure::InvalidBundle,
        Refusal::TooLarge => PublicationFailure::TooLarge,
        Refusal::UnsupportedVersion => PublicationFailure::UnsupportedVersion,
        Refusal::ForeignRepository | Refusal::ForeignConfig => return,
    };
    assert_eq!(actual, Some(expected), "stored failure for {refusal:?}");
}

fn seed_size_conflict(store: &dyn Store, project_id: ProjectId, bundle: &PlanBundle) -> BlobHash {
    let mut declared: BTreeMap<BlobHash, i64> = bundle
        .inventory()
        .files
        .iter()
        .map(|file| (file.sha256.parse().unwrap(), file.size as i64))
        .collect();
    for artifact in bundle.artifacts() {
        declared.insert(
            BlobHash::digest(&artifact.bytes),
            artifact.bytes.len() as i64,
        );
    }
    let mut ordered = declared.into_iter();
    let (absent, _) = ordered.next().unwrap();
    let (hash, size) = ordered.next().unwrap();
    let conflicting = Blob {
        project_id,
        key: BlobKey {
            hash,
            incarnation: Uuid::now_v7(),
        },
        size: size + 1,
        content_type: "application/octet-stream".into(),
        ref_count: 0,
        deleting: false,
        unreferenced_at: Some(Utc::now()),
        stored_at: None,
    };
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_blob(&conflicting)
        }))
        .unwrap();
    absent
}
