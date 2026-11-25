//! The reservation attaches the full content type to each publication path.

use std::io::{Read, empty};
use std::sync::Arc;

use mkc_domain::blob::BlobHash;
use mkc_mokly_contract::archive::{ArchiveFiles, TarballReader};
use mkc_mokly_contract::bundle::{ContractValidator, PlanBundle, UploadValidator};
use mkc_mokly_contract::error::Result;
use mkc_mokly_contract::inventory::MARKER_PATH;
use mkc_mokly_contract::limits::Limits;
use mkc_mokly_contract::manifest::UploadManifest;
use mkc_mokly_contract::scanned_archive::ScannedArchive;
use mkc_store_interface::blob::BlobsMock;
use mkc_store_interface::publication::PublicationsMock;
use mkc_store_interface::publication_event::PublicationEventsMock;
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};

use crate::ingest::PublicationIngest;
use crate::policy::AccessPolicyMock;
use crate::reservation::Reservation;
use crate::tests::support::{
    PROJECT, PUBLICATION, bundle, project, publication, runtime, token, transactions,
};

use super::{authorization, distinct_hashes};

const IMAGE: &str = "static/mokly-generated/assets/photo.pjp";
const TEXT: &str = "static/notice.txt";

struct PlanArchive(ArchiveFiles);

impl TarballReader for PlanArchive {
    fn read(&self, _source: &mut dyn Read, limits: Limits) -> Result<ScannedArchive> {
        ScannedArchive::from_files(self.0.clone(), limits)
    }

    fn read_with_envelope(
        &self,
        source: &mut dyn Read,
        limits: Limits,
        _envelope: &mut Option<UploadManifest>,
    ) -> Result<ScannedArchive> {
        self.read(source, limits)
    }
}

fn bundle_with_assets() -> PlanBundle {
    let mut files: ArchiveFiles = bundle()
        .artifacts()
        .into_iter()
        .map(|artifact| (artifact.path, artifact.bytes))
        .collect();
    let marker = files.get_mut(MARKER_PATH).unwrap();
    let mut inventory: Value = serde_json::from_slice(marker).unwrap();
    let entries = inventory["files"].as_array_mut().unwrap();
    let bytes = b"shared asset contents";
    let hash = BlobHash::digest(bytes).to_string();
    for path in [IMAGE, TEXT] {
        entries.push(json!({
            "path": path,
            "sha256": hash,
            "size": bytes.len(),
        }));
    }
    *marker = serde_json::to_vec(&inventory).unwrap().into();
    ContractValidator {
        reader: Arc::new(PlanArchive(files)),
        limits: Limits::default(),
    }
    .validate(&mut empty())
    .unwrap()
}

#[test]
fn reservation_stores_declared_types_and_charset_parameters() {
    let bundle = bundle_with_assets();
    let hash_count = distinct_hashes(&bundle).len();
    let expected_types = [
        (IMAGE, "image/jpeg"),
        (TEXT, "text/plain; charset=utf-8"),
        ("index.html", "text/html; charset=utf-8"),
        ("mokly-viewer/index.json", "application/json; charset=utf-8"),
    ];
    let queries = Unimock::new((
        PublicationsMock::validate_publication
            .some_call(matching!(&PUBLICATION, _))
            .returns(Ok(true)),
        PublicationsMock::publication_by_identity
            .some_call(matching!(&PROJECT, _, _))
            .returns(Ok(None)),
        BlobsMock::blob
            .each_call(matching!(&PROJECT, _))
            .answers(&|_, _, _| Ok(None))
            .n_times(hash_count),
        BlobsMock::insert_blob
            .each_call(matching!(_))
            .answers(&|_, _| Ok(()))
            .n_times(hash_count),
        BlobsMock::insert_publication_file.stub(|inserts| {
            for (path, expected) in expected_types {
                inserts
                    .call(&|matching| matching.func(move |file, _| file.path == path))
                    .answers_arc(Arc::new(move |_, file| {
                        assert_eq!(file.content_type, expected, "{path}");
                        Ok(())
                    }))
                    .once();
            }
            inserts
                .call(matching!(_))
                .answers(&|_, _| Ok(()))
                .n_times(bundle.inventory().files.len() + 1 - expected_types.len());
        }),
        PublicationEventsMock::insert_publication_event
            .some_call(matching!(_))
            .returns(Ok(())),
    ));
    let ingest = PublicationIngest {
        transactions: transactions(queries),
        runtime: runtime(),
        policy: Arc::new(Unimock::new(
            AccessPolicyMock::token
                .some_call(matching!(_, &PROJECT, _))
                .returns(Ok((project(), token()))),
        )),
        validator: Arc::new(Unimock::new(())),
        writer: Arc::new(Unimock::new(())),
        files: Arc::new(Unimock::new(())),
    };
    ingest
        .reserve(&authorization(), &publication(), &bundle)
        .unwrap();
}
