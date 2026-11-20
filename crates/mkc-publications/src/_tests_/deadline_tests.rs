//! An elapsed attempt deadline stops plan-time artifact writes and closes the attempt.

use std::collections::HashSet;
use std::io::Cursor;
use std::sync::Arc;

use mkc_auth::runtime::hash;
use mkc_domain::blob::BlobHash;
use mkc_mokly_contract::bundle::UploadValidatorMock;
use mkc_store_interface::blob::BlobsMock;
use mkc_store_interface::publication::{PublicationFailure, PublicationsMock};
use mkc_store_interface::publication_event::PublicationEventsMock;
use unimock::{MockFn, Unimock, matching};

use crate::blob_writer::BlobWriterMock;
use crate::error::Error;
use crate::ingest::{Ingest, PublicationIngest, UploadAuthorization};
use crate::policy::AccessPolicyMock;
use crate::upload_authorization::Credential;

use super::support::{PROJECT, PUBLICATION, bearer, bundle, project, runtime, token, transactions};

#[test]
fn elapsed_attempt_deadline_stops_before_writing_more_objects() {
    let bundle = bundle();
    let count = bundle.inventory().files.len() + 1;
    let distinct = bundle
        .inventory()
        .files
        .iter()
        .map(|file| file.sha256.clone())
        .chain(
            bundle
                .artifacts()
                .iter()
                .map(|artifact| BlobHash::digest(&artifact.bytes).to_string()),
        )
        .collect::<HashSet<_>>()
        .len();
    let queries = Unimock::new((
        PublicationsMock::insert_publication
            .next_call(matching!(_))
            .returns(Ok(())),
        PublicationEventsMock::insert_publication_event
            .each_call(matching!(_))
            .answers(&|_, _| Ok(()))
            .n_times(3),
        PublicationsMock::validate_publication
            .next_call(matching!(_, _))
            .returns(Ok(true)),
        PublicationsMock::publication_by_identity
            .next_call(matching!(_, _, _))
            .returns(Ok(None)),
        BlobsMock::blob
            .each_call(matching!(_))
            .answers(&|_, _, _| Ok(None))
            .n_times(distinct),
        BlobsMock::insert_blob
            .each_call(matching!(_))
            .answers(&|_, _| Ok(()))
            .n_times(distinct),
        BlobsMock::insert_publication_file
            .each_call(matching!(_))
            .answers(&|_, _| Ok(()))
            .n_times(count),
        PublicationsMock::fail_publication
            .next_call(matching!(&PUBLICATION, PublicationFailure::Expired))
            .returns(Ok(true)),
        BlobsMock::delete_publication_files
            .next_call(matching!(&PUBLICATION))
            .returns(Ok(())),
    ));
    let ingest = PublicationIngest {
        transactions: transactions(queries),
        runtime: runtime(),
        policy: Arc::new(Unimock::new(
            AccessPolicyMock::token
                .each_call(matching!(_, _, _))
                .answers(&|_, _, _, _| Ok((project(), token()))),
        )),
        validator: Arc::new(Unimock::new(
            UploadValidatorMock::validate_with_envelope
                .next_call(matching!(_, _))
                .returns(Ok(bundle)),
        )),
        writer: Arc::new(Unimock::new(
            BlobWriterMock::write
                .next_call(matching!(_, _, _))
                .returns(Err(Error::Expired)),
        )),
        files: Arc::new(Unimock::new(())),
    };
    let authorization = UploadAuthorization {
        project: PROJECT,
        credential: Credential::Project(hash(&bearer())),
        build_id: None,
        organization_slug: super::support::organization_slug(),
        project_slug: super::support::project_slug(),
    };
    assert!(matches!(
        ingest.preflight(authorization, &mut Cursor::new([])),
        Err(Error::Expired)
    ));
}
