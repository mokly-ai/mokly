//! Rejected uploads retain identity only after repository and config authorization.

use std::io::Cursor;
use std::sync::Arc;

use mkc_mokly_contract::bundle::UploadValidatorMock;
use mkc_mokly_contract::error::{self, Rejection};
use mkc_store_interface::blob::BlobsMock;
use mkc_store_interface::publication::{PublicationState, PublicationsMock};
use mkc_store_interface::publication_event::PublicationEventsMock;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::ingest::{Ingest, PublicationIngest};
use crate::policy::AccessPolicyMock;

use super::support::{
    PROJECT, bearer, bundle, organization_query, project, runtime, token, transactions,
};

#[test]
fn rejected_upload_retains_identity_only_for_an_authorized_envelope() {
    for scope in ["authorized", "repository", "config"] {
        rejected(scope);
    }
}

fn rejected(scope: &'static str) {
    let common = (
        PublicationsMock::insert_publication
            .some_call(matching!(_))
            .answers(&|_, value| {
                assert_eq!(value.state, PublicationState::Uploading);
                assert!(value.metadata.is_none());
                Ok(())
            }),
        PublicationsMock::fail_publication
            .some_call(matching!(_, _))
            .returns(Ok(true)),
        PublicationEventsMock::insert_publication_event
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        BlobsMock::delete_publication_files
            .some_call(matching!(_))
            .returns(Ok(())),
        organization_query(),
    );
    let validation = PublicationsMock::validate_publication
        .some_call(matching!(_, _))
        .answers(&|_, _, metadata| {
            assert_eq!(metadata.base_ref.as_deref(), Some("HEAD~1"));
            assert_eq!(
                metadata.base_sha.as_deref(),
                Some("4150326c615212f0fc9d9153cde75fae6aaf308f")
            );
            Ok(true)
        });
    let queries = if scope == "authorized" {
        Unimock::new((common, validation))
    } else {
        Unimock::new(common)
    };
    let ingest = PublicationIngest {
        transactions: transactions(queries),
        runtime: runtime(),
        writer: Arc::new(Unimock::new(())),
        files: Arc::new(Unimock::new(())),
        policy: Arc::new(Unimock::new(
            AccessPolicyMock::token
                .each_call(matching!(_, _, _))
                .answers(&|_, _, _, _| Ok((project(), token()))),
        )),
        validator: Arc::new(Unimock::new(
            UploadValidatorMock::validate_with_envelope
                .some_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, envelope| {
                    let mut manifest = bundle().manifest().clone();
                    if scope == "repository" {
                        manifest.repository.owner = "another".into();
                    }
                    if scope == "config" {
                        manifest.config_path = "another.json".into();
                    }
                    *envelope = Some(manifest);
                    Err(error::Error::Invalid {
                        reason: Rejection::PlanFiles,
                    })
                })),
        )),
    };
    let authorization = ingest.authorize(PROJECT, &bearer()).unwrap();
    let result = ingest.preflight(authorization, &mut Cursor::new(b"rejected body"));
    assert!(
        matches!(
            (scope, &result),
            (
                "authorized",
                Err(Error::InvalidBundle {
                    reason: Rejection::PlanFiles
                })
            ) | ("repository" | "config", Err(Error::Forbidden))
        ),
        "rejected envelope outcome for {scope}: {result:?}"
    );
}
