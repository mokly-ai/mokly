//! Build check context and reuse of immutable publication Changes rendering.

use mkc_domain::app_paths;
use mkc_domain::ids::BuildId;
use mkc_github_interface::check::{CheckRun, Error, ErrorResultExt, Result};
use mkc_store_interface::build_state::BuildState;

use crate::build_check_summary::{self, BuildCheckOutput};
use crate::build_check_worker::BuildCheckDelivery;
use crate::error;

pub(crate) trait BuildDelivery {
    fn deliver_build(&self, build: BuildId) -> Result<()>;
}

impl BuildDelivery for BuildCheckDelivery {
    fn deliver_build(&self, id: BuildId) -> Result<()> {
        let mut context = None;
        self.transactions
            .run(true, &mut |queries| {
                let Some(build) = error::ErrorResultExt::context(
                    queries.build_by_id(id),
                    "read current check build",
                )?
                else {
                    return Ok(());
                };
                let Some(project) = error::ErrorResultExt::context(
                    queries.project(build.project_id),
                    "read check build project",
                )?
                else {
                    return Ok(());
                };
                let Some(organization) = error::ErrorResultExt::context(
                    queries.organization(project.organization_id),
                    "read check build organization",
                )?
                else {
                    return Ok(());
                };
                let publication = match build.publication_id {
                    Some(id) => error::ErrorResultExt::context(
                        queries.publication(id),
                        "read published build result",
                    )?,
                    None => None,
                };
                context = Some((build, project, organization, publication));
                Ok(())
            })
            .context("load build check context")?;
        let Some((build, project, organization, publication)) = context else {
            return Ok(());
        };
        let path = format!(
            "{}/builds/{}",
            app_paths::project(&organization.slug, &project.slug),
            build.id
        );
        let details_url = app_paths::on_origin(&self.locations.app_origin, &path);
        let mut check = if build.state == BuildState::Published {
            let publication = publication.ok_or_else(|| Error::internal(error::Error::NotFound))?;
            let Some(check) =
                self.publications
                    .render(&publication, &project, &organization.slug)?
            else {
                return Ok(());
            };
            check
        } else {
            let tail = self.output_tail(&build)?;
            let (status, conclusion, title, summary) = build_check_summary::render(&build, &tail);
            CheckRun {
                project_id: project.id,
                repository: project.repository.clone(),
                head_sha: build.head_sha.clone(),
                external_id: String::new(),
                name: "Mokly".to_owned(),
                status,
                conclusion,
                title,
                summary,
                details_url: String::new(),
            }
        };
        check.external_id = format!("mokly-build:{}", build.id);
        check.details_url = details_url;
        check.head_sha = build.head_sha;
        self.github.upsert(&check)
    }
}
