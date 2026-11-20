//! Admission, validation and replay tests at injected boundaries.

use std::sync::Arc;

use mkc_auth::runtime::hash;
use mkc_mokly_contract::bundle::{PlanBundle, UploadValidatorMock};
use unimock::{MockFn, Unimock, matching};

use crate::ingest::{PublicationIngest, UploadAuthorization};
use crate::policy::AccessPolicyMock;
use crate::upload_authorization::Credential;

use super::support::{PROJECT, bearer, clock, project, runtime, token, transactions};

mod admission_tests;
mod blob_tests;
mod completion_tests;
mod index_observation_tests;
mod plan_tests;
mod replay_success_tests;
mod stored_index_tests;

fn service(queries: Unimock, validator: Unimock, writer: Unimock) -> PublicationIngest {
    service_with_files(queries, validator, writer, Unimock::new(()))
}

fn service_with_files(
    queries: Unimock,
    validator: Unimock,
    writer: Unimock,
    files: Unimock,
) -> PublicationIngest {
    PublicationIngest {
        transactions: transactions(queries),
        runtime: runtime(),
        policy: Arc::new(Unimock::new(
            AccessPolicyMock::token
                .each_call(matching!(_, &PROJECT, _))
                .answers(&|_, _, _, _| Ok((project(), token()))),
        )),
        validator: Arc::new(validator),
        writer: Arc::new(writer),
        files: Arc::new(files),
    }
}

/// A service for blob and completion requests: a clock, and ids only when `ids` is set.
fn exchange(queries: Unimock, writer: Unimock, ids: bool) -> PublicationIngest {
    PublicationIngest {
        transactions: transactions(queries),
        runtime: if ids { runtime() } else { clock() },
        ..writing(writer)
    }
}

/// A service whose only collaborator is the writer.
fn writing(writer: Unimock) -> PublicationIngest {
    PublicationIngest {
        transactions: Arc::new(Unimock::new(())),
        runtime: Arc::new(Unimock::new(())),
        policy: Arc::new(Unimock::new(())),
        validator: Arc::new(Unimock::new(())),
        writer: Arc::new(writer),
        files: Arc::new(Unimock::new(())),
    }
}

fn authorization() -> UploadAuthorization {
    UploadAuthorization {
        project: PROJECT,
        credential: Credential::Project(hash(&bearer())),
        build_id: None,
        organization_slug: super::support::organization_slug(),
        project_slug: super::support::project_slug(),
    }
}

fn validator(bundle: PlanBundle) -> Unimock {
    Unimock::new(
        UploadValidatorMock::validate_with_envelope
            .next_call(matching!(_, _))
            .returns(Ok(bundle)),
    )
}
