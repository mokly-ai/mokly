//! Build scheduling prepared outside, then reconciled inside durable webhook effects.

use std::sync::Arc;

use mkc_publications::build_scheduler::{BuildReference, BuildSchedule, BuildScheduler};
use mkc_store_interface::build_state::BuildTrigger;
use mkc_store_interface::store::{Callback, Queries};

use crate::error::{ApiErrorResultExt, Result};

use super::handlers::GitHubHandlers;

pub(crate) trait PreparedBuildEffects: Send + Sync {
    fn apply(&self, queries: &mut dyn Queries, reference: &BuildReference) -> Result<()>;
}

struct PreparedBuilds {
    scheduler: Arc<dyn BuildScheduler>,
    requests: Vec<BuildSchedule>,
}

impl GitHubHandlers {
    pub(super) fn builds(
        &self,
        reference: BuildReference,
        trigger: BuildTrigger,
    ) -> Result<Option<Arc<dyn PreparedBuildEffects>>> {
        let Some(scheduler) = &self.build_scheduler else {
            return Ok(None);
        };
        let repository = match &reference {
            BuildReference::Branch(branch) => branch.repository_id,
            BuildReference::PullRequest(pull) => pull.repository_id,
        };
        let mut projects = Vec::new();
        self.store
            .read(&mut Callback(&mut |queries| {
                projects = queries.github_repository_projects(repository)?;
                Ok(())
            }))
            .context("read webhook build projects")?;
        let at = self.runtime.now();
        let requests = projects
            .into_iter()
            .map(|project| BuildSchedule {
                id: self.runtime.id().into(),
                project_id: project.id,
                reference: reference.clone(),
                trigger,
                at,
                rerun_base_ref: None,
            })
            .collect();
        Ok(Some(Arc::new(PreparedBuilds {
            scheduler: scheduler.clone(),
            requests,
        })))
    }
}

impl PreparedBuildEffects for PreparedBuilds {
    fn apply(&self, queries: &mut dyn Queries, reference: &BuildReference) -> Result<()> {
        for request in &self.requests {
            let mut current = request.clone();
            current.reference = reference.clone();
            self.scheduler
                .schedule(queries, &current)
                .context("apply webhook build schedule")?;
        }
        Ok(())
    }
}
