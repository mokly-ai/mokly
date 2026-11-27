//! Preview password dispatch with async waiting between blocking phases.

use std::sync::Arc;

use mkc_auth::service::PreviewPasswordCheck;
use mkc_domain::client_origins::ClientOrigin;
use mkc_domain::validation;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

use crate::dispatch::{ApiDispatcher, Request, cookie};
use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::input::PreviewCredential;
use crate::payload::{Payload, Reply};
use crate::platform::service::Platform;
use crate::views::account::SessionIssuedView;

const PREVIEW_HASH_SLOTS: usize = 2;
const PREVIEW_WAITING_SLOTS: usize = 8;
const PREVIEW_ATTEMPT_PLACES: usize = PREVIEW_HASH_SLOTS + PREVIEW_WAITING_SLOTS;

/// Limits password attempts and concurrent checks for one API dispatcher.
pub(crate) struct PreviewHashSlots {
    /// Permits for the checks that can run concurrently.
    pub(crate) checks: Arc<Semaphore>,
    places: Arc<Semaphore>,
}

impl Default for PreviewHashSlots {
    fn default() -> Self {
        Self {
            checks: Arc::new(Semaphore::new(PREVIEW_HASH_SLOTS)),
            places: Arc::new(Semaphore::new(PREVIEW_ATTEMPT_PLACES)),
        }
    }
}

/// An exchange with a reserved place and committed peer admission.
pub(crate) struct AdmittedPreview {
    check_password: PreviewPasswordCheck,
    input: PreviewCredential,
    client: ClientOrigin,
    platform: Arc<dyn Platform>,
    hash_slots: Arc<Semaphore>,
    place: OwnedSemaphorePermit,
}

impl ApiDispatcher {
    /// Validate the password length, reserve a place and commit peer admission.
    pub(crate) fn admit_preview(
        &self,
        request: Request,
        client: ClientOrigin,
        input: PreviewCredential,
    ) -> Result<AdmittedPreview> {
        if !(1..=1024).contains(&input.password.len()) {
            return Err(ApiError::ValidationFailed);
        }
        let place = self
            .preview_hash_slots
            .places
            .clone()
            .try_acquire_owned()
            .ok()
            .ok_or(ApiError::Unavailable)?;
        let check_password = self
            .auth
            .clone()
            .preview(request.credential, &request.peer)?;
        Ok(AdmittedPreview {
            check_password,
            input,
            client,
            platform: self.platform.clone(),
            hash_slots: self.preview_hash_slots.checks.clone(),
            place,
        })
    }
}

impl AdmittedPreview {
    /// Wait without a worker, then keep the place with the worker until the exchange ends.
    pub(crate) async fn finish(self) -> Result<Reply> {
        let permit = self
            .hash_slots
            .acquire_owned()
            .await
            .context("wait for preview password check")?;
        tokio::task::spawn_blocking(move || {
            let _place = self.place;
            let issue_session = {
                let _permit = permit;
                let password = self.input.password;
                (self.check_password)(&password)?
            };
            let result = issue_session()?;
            let session = self.platform.session(&result.identity)?;
            Ok(Reply {
                status: 200,
                payload: Payload::SessionIssued(SessionIssuedView {
                    session,
                    return_to: validation::return_to(self.input.return_to.as_deref()),
                }),
                cookie: Some(cookie(&result.credential, 2_592_000, self.client)),
                effects: Vec::new(),
            })
        })
        .await
        .context("finish preview password exchange")?
    }
}
