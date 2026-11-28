//! Assemble and deliver checks while preserving provider retry classifications.

use mkc_domain::app_paths;
use mkc_domain::slug::WorkspaceSlug;
use mkc_github_interface::check::{CheckRun, Conclusion, Error, ErrorResultExt, Result};
use mkc_github_interface::checks::Status;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationFailure, PublicationState};
use mkc_store_interface::publication_event::PublicationEvent;

use crate::check_summary;
use crate::check_worker::PublicationChecks;
use crate::error::{self, Error as PublicationError};
use crate::stored_index::Error as IndexReadError;

/// Shared immutable publication rendering for publication and build outboxes.
#[unimock::unimock(api = CheckRendererMock)]
pub trait CheckRenderer: Send + Sync {
    /// Render an admitted publication result without delivering it to GitHub.
    fn render(
        &self,
        publication: &Publication,
        project: &Project,
        organization: &WorkspaceSlug,
    ) -> Result<Option<CheckRun>>;
}

pub(crate) trait Delivery {
    fn deliver_event(&self, event: &PublicationEvent) -> Result<()>;
}

impl Delivery for PublicationChecks {
    fn deliver_event(&self, event: &PublicationEvent) -> Result<()> {
        let mut context = None;
        self.transactions
            .run(true, &mut |queries| {
                if let Some(publication) = error::ErrorResultExt::context(
                    queries.publication(event.publication_id),
                    "read check publication",
                )? && publication.build_id.is_none()
                    && let Some(project) = error::ErrorResultExt::context(
                        queries.project(publication.project_id),
                        "read check repository",
                    )?
                    && let Some(organization) = error::ErrorResultExt::context(
                        queries.organization(project.organization_id),
                        "read check organization slug",
                    )?
                {
                    context = Some((publication, project, organization.slug));
                }
                Ok(())
            })
            .context("load check delivery context")?;
        if let Some((publication, project, organization)) = context
            && let Some(check) = self.render(&publication, &project, &organization)?
        {
            self.github.upsert(&check)?;
        }
        Ok(())
    }
}

impl CheckRenderer for PublicationChecks {
    fn render(
        &self,
        publication: &Publication,
        project: &Project,
        organization: &WorkspaceSlug,
    ) -> Result<Option<CheckRun>> {
        let Some(metadata) = &publication.metadata else {
            return Ok(None);
        };
        let mut check = CheckRun {
            project_id: project.id,
            repository: project.repository.clone(),
            head_sha: metadata.head_sha.clone(),
            external_id: format!("mokly-publication:{}", publication.id),
            name: "Mokly".to_owned(),
            status: Status::Completed,
            conclusion: Some(Conclusion::Neutral),
            title: "Catalogue published.".to_owned(),
            summary: "Catalogue published.".to_owned(),
            details_url: self
                .locations
                .viewer(organization, &project.slug, publication.id, None)
                .context("build check destination")?,
        };
        if publication.state == PublicationState::Expired {
            check.title = "Open the latest catalogue.".to_owned();
            check.summary = "Open the latest catalogue.".to_owned();
            let path = app_paths::project(organization, &project.slug);
            check.details_url = app_paths::on_origin(&self.locations.app_origin, &path);
        } else if publication.state == PublicationState::Ready {
            let mut file = None;
            self.transactions
                .run(true, &mut |queries| {
                    file = error::ErrorResultExt::context(
                        queries.publication_file(publication.id, INDEX_PATH),
                        "read pinned check catalogue index reference",
                    )?;
                    Ok(())
                })
                .context("load check catalogue index reference")?;
            let file = file.ok_or_else(|| Error::internal(PublicationError::NotFound))?;
            let index = match self.files.load(&file.key) {
                Ok(Some(index)) => index,
                Ok(None) => return Err(Error::internal(PublicationError::NotFound)),
                Err(IndexReadError::Invalid(_)) => return Err(Error::Validation),
                Err(error) => return Err(Error::internal(error)),
            };
            let index = index.index();
            if index.changes_count().is_some() {
                check.conclusion = Some(Conclusion::Success);
                check.title = "Catalogue ready to review.".to_owned();
                check.summary = check_summary::summary(
                    index,
                    &self.locations,
                    organization,
                    &project.slug,
                    publication.id,
                )
                .context("render check summary")?;
            }
        } else if publication.state == PublicationState::Failed
            && publication
                .failure
                .is_some_and(PublicationFailure::delivers_failure_check)
        {
            check.conclusion = Some(Conclusion::Failure);
            check.title = "Publishing failed. Run Mokly publish again.".to_owned();
            check.summary = check.title.clone();
        } else {
            return Ok(None);
        }
        Ok(Some(check))
    }
}
