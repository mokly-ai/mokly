//! Projects for scenarios whose subject is not the installation flow itself.

use mkc_domain::ids::{OrganizationId, ProjectId, RepositoryId};
use mkc_domain::values::Visibility;
use mkc_store_interface::project::Project;
use reqwest::Method;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::installed::seed_installed_repository;

use super::harness::{Harness, json as response_json};

impl Harness {
    /// Create a project through the API from an installation seeded in the
    /// store for `workspace`, which holds no recorded installation.
    pub(super) fn seeded_project(&self, workspace: &str, slug: &str, full_name: &str) -> Value {
        let workspace: OrganizationId = workspace.parse::<Uuid>().unwrap().into();
        let mut repository = None;
        self.queries(&mut |queries| {
            repository = Some(seed_installed_repository(queries, workspace, full_name)?);
            Ok(())
        });
        let repository: RepositoryId = repository.unwrap();
        response_json(
            self.request(
                Method::POST,
                &format!("/v1/workspaces/{workspace}/projects"),
            )
            .json(&json!({
                "name": slug,
                "slug": slug,
                "repositoryId": repository.0,
                "configPath": "mokly.config.json",
            }))
            .send()
            .unwrap(),
            201,
        )
    }

    /// Insert a project with no repository link, as rows created before every
    /// project required an installed repository still are, and read it back.
    pub(super) fn unlinked_project(&self, workspace: &str, slug: &str, repository: &str) -> Value {
        let project = Project {
            id: ProjectId(Uuid::now_v7()),
            organization_id: workspace.parse::<Uuid>().unwrap().into(),
            name: slug.into(),
            slug: slug.parse().unwrap(),
            repository: repository.to_ascii_lowercase(),
            config_path: "mokly.config.json".into(),
            visibility: Visibility::Public,
            require_approval: false,
            automatic_builds: false,
            version: 1,
        };
        self.queries(&mut |queries| {
            queries.insert_project(&project)?;
            Ok(())
        });
        response_json(
            self.request(Method::GET, &format!("/v1/projects/{}", project.id))
                .send()
                .unwrap(),
            200,
        )
    }
}
