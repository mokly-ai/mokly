//! Exact run status and proof, serialized only through the seed storage boundary.

use chrono::{DateTime, SecondsFormat, Utc};
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_publications::ingest::Ingested;
use mkc_publications::locations::Locations;
use mkc_store_interface::publication::PublicationState;
use serde::Serialize;

use super::error::{Error, ErrorResultExt, Failure, Result, require};
use super::identity::{PROJECT_SLUG, WORKSPACE_SLUG};
use super::request::Request;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Status {
    schema_version: u32,
    environment: String,
    revision: String,
    pub(super) sign_in: SignIn,
    pub(super) project: Project,
    pub(super) checked_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub(super) enum SignIn {
    Refused,
    Accepted,
}

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub(super) enum Project {
    Failed,
    Seeded,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Proof {
    schema_version: u32,
    environment: String,
    revision: String,
    workspace_slug: String,
    project_slug: String,
    project_id: ProjectId,
    publication_id: PublicationId,
    publication_state: PublicationState,
    pull_request: Option<i64>,
    viewer_url: String,
    upload_status: u16,
    checked_at: String,
}

impl Status {
    pub(super) fn new(request: &Request, now: DateTime<Utc>) -> Self {
        Self {
            schema_version: 1,
            environment: request.environment.clone(),
            revision: request.revision.clone(),
            sign_in: SignIn::Refused,
            project: Project::Failed,
            checked_at: checked_at(now),
        }
    }
}

impl Proof {
    pub(super) fn verified(
        request: &Request,
        project: ProjectId,
        ingested: Ingested,
        locations: &Locations,
        now: DateTime<Utc>,
    ) -> Result<Self> {
        let publication = ingested.publication;
        require("projectId", project, publication.project_id)?;
        require("publicationState", "ready", publication.state.as_str())?;
        require(
            "workspaceSlug",
            WORKSPACE_SLUG,
            ingested.organization_slug.as_str(),
        )?;
        require("projectSlug", PROJECT_SLUG, ingested.project_slug.as_str())?;
        let metadata = publication
            .metadata
            .ok_or_else(|| Error::internal(Failure::MetadataMissing))?;
        require(
            "headSha",
            request.revision.as_str(),
            metadata.head_sha.as_str(),
        )?;
        let expected = request.pull_request.map(i64::from);
        if expected != metadata.pull_request {
            return Err(Error::internal(Failure::PullRequest {
                expected,
                received: metadata.pull_request,
            }));
        }
        let viewer_url = locations
            .viewer(
                &ingested.organization_slug,
                &ingested.project_slug,
                publication.id,
                None,
            )
            .context("render seed publication destination")?;
        require(
            "viewerUrl app origin",
            true,
            viewer_url.starts_with(&format!("{}/", locations.app_origin)),
        )?;
        Ok(Self {
            schema_version: 1,
            environment: request.environment.clone(),
            revision: metadata.head_sha,
            workspace_slug: ingested.organization_slug.into_string(),
            project_slug: ingested.project_slug.into_string(),
            project_id: publication.project_id,
            publication_id: publication.id,
            publication_state: publication.state,
            pull_request: metadata.pull_request,
            viewer_url,
            upload_status: if ingested.replay { 200 } else { 201 },
            checked_at: checked_at(now),
        })
    }
}

pub(super) fn checked_at(now: DateTime<Utc>) -> String {
    now.to_rfc3339_opts(SecondsFormat::Secs, true)
}
