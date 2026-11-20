//! Ordered seed steps with final evidence and unconditional project-token cleanup.

use std::sync::Arc;

use bytes::Bytes;
use mkc_auth::runtime::Runtime;
use mkc_auth::service::Authenticator;
use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::seed_name::SeedName;
use mkc_publications::locations::Locations;
use serde::Serialize;

use crate::action::Action;
use crate::platform::service::Platform;

use super::catalogue::SeedCatalogue;
use super::error::{Error, ErrorResultExt, Failure, Result};
use super::evidence::{Project, Proof, SignIn, Status, checked_at};
use super::request::Request;
use super::upload::CatalogueUpload;

/// Run one seed without starting the HTTP server or background workers.
pub trait PreviewSeeder: Send + Sync {
    /// Read the run request, seed its project, write evidence and exit on failure.
    fn run(&self, run: &str) -> Result<()>;
}

#[cfg(test)]
#[path = "_tests_/service/mod.rs"]
mod tests;

pub(crate) struct SeedService {
    pub(super) auth: Arc<dyn Authenticator>,
    pub(super) platform: Arc<dyn Platform>,
    pub(super) files: Arc<dyn SeedStore>,
    pub(super) catalogue: Arc<dyn SeedCatalogue>,
    pub(super) uploader: Arc<dyn CatalogueUpload>,
    pub(super) runtime: Arc<dyn Runtime>,
    pub(super) locations: Locations,
    pub(super) revision: &'static str,
}

impl PreviewSeeder for SeedService {
    fn run(&self, run: &str) -> Result<()> {
        if !self.auth.preview_sign_in_available() {
            return Err(Error::Configuration);
        }
        let request = self.step("1 read request", || {
            let bytes = self
                .read(run, "request.json")?
                .ok_or_else(|| Error::internal(Failure::RequestMissing))?;
            Request::parse(&bytes)
        })?;
        let mut status = Status::new(&request, self.runtime.now());
        let result = self
            .step("2 initial status", || {
                self.write(run, "seed-status.json", &status)
            })
            .and_then(|_| self.seed(run, &request, &mut status))
            .and_then(|proof| {
                self.step("12 write proof", || {
                    self.write(run, "seed-proof.json", &proof)
                })
            });
        if result.is_ok() {
            status.project = Project::Seeded;
        }
        status.checked_at = checked_at(self.runtime.now());
        let final_status = self.step("12 final status", || {
            self.write(run, "seed-status.json", &status)
        });
        result?;
        final_status
    }
}

impl SeedService {
    fn seed(&self, run: &str, request: &Request, status: &mut Status) -> Result<Proof> {
        self.step("3 build revision", || {
            request.verify_revision(self.revision)
        })?;
        let user = self.step("4 preview account", || {
            self.auth
                .preview_account()
                .context("find or create preview account")
        })?;
        status.sign_in = SignIn::Accepted;
        let workspace = self.step("5 workspace", || self.workspace(user.id))?;
        let project = self.step("6 project", || self.project(user.id, workspace))?;
        let archive = self.step("7 catalogue revision", || {
            self.catalogue.read(run, &request.revision)
        })?;
        let token = self.step("8 project token", || self.token(user.id, project))?;
        let result = self
            .step("9 catalogue upload", || {
                self.uploader.publish(run, project, &token.secret, &archive)
            })
            .and_then(|publication| {
                self.step("10 publication", || {
                    Proof::verified(
                        request,
                        project,
                        publication,
                        &self.locations,
                        self.runtime.now(),
                    )
                })
            });
        let cleanup = self.step("11 revoke token", || {
            self.execute(user.id, Action::RevokeToken(project, token.token.id))
                .context("revoke seed project token")?;
            Ok(())
        });
        cleanup?;
        result
    }

    fn read(&self, run: &str, file: &str) -> Result<Option<Vec<u8>>> {
        let name = SeedName::new(run, file).context("validate seed object name")?;
        self.files
            .get(&name, name.max_bytes())
            .context("read seed object")
    }

    fn write(&self, run: &str, file: &str, value: &impl Serialize) -> Result<()> {
        let name = SeedName::new(run, file).context("validate seed result name")?;
        let bytes = serde_json::to_vec(value).context("encode seed evidence")?;
        self.files
            .put(&name, Bytes::from(bytes))
            .context("write seed evidence")
    }

    fn step<T>(&self, step: &'static str, operation: impl FnOnce() -> Result<T>) -> Result<T> {
        tracing::info!(step, "preview seed step");
        let result = operation();
        if let Err(error) = &result {
            tracing::error!(step, reason = %error, "preview seed step failed");
        }
        result
    }
}
