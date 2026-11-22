//! Adoption checks the exact key, head dependency evidence, and clean working inputs.

use std::sync::{Arc, Mutex};

use mokly_compare::base_freshness::FreshnessReadings;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::error::{Error, Result};
use mokly_compare::inputs::Inputs;
use mokly_compare::working_inputs::WorkingInputs;
use mokly_git::source_key::CheckoutIdentity;
use mokly_git::tree::Limits;

use crate::serve_base_key::BaseKey;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct HeadEvidence {
    pub(super) directories: Vec<String>,
    pub(super) unmapped: Vec<String>,
    pub(super) catalogue: Vec<String>,
}

pub(super) trait AdoptionEvidence: Send + Sync {
    /// Return the current readings when all adoption evidence still matches.
    fn current(
        &self,
        request: &BaseRetentionRequest<'_>,
        directories: &[String],
        unmapped: &[String],
    ) -> Result<Option<FreshnessReadings<'_>>>;
}

pub(super) struct NativeEvidence {
    pub(super) key: BaseKey,
    pub(super) working: Arc<dyn WorkingInputs>,
    pub(super) inputs: Option<Inputs>,
    pub(super) checkout: Option<CheckoutIdentity>,
    pub(super) head: Mutex<Option<HeadEvidence>>,
}

impl AdoptionEvidence for NativeEvidence {
    fn current(
        &self,
        request: &BaseRetentionRequest<'_>,
        directories: &[String],
        unmapped: &[String],
    ) -> Result<Option<FreshnessReadings<'_>>> {
        if self.key != BaseKey::new(request)? {
            return Ok(None);
        }
        if let Some(head) = &*self.head.lock().unwrap_or_else(|error| error.into_inner())
            && (head.directories != directories
                || head.unmapped != unmapped
                || head.catalogue
                    != request
                        .head
                        .catalogue()
                        .dependency_directories
                        .iter()
                        .cloned()
                        .collect::<Vec<_>>())
        {
            return Ok(None);
        }
        let Some(checkout) = &self.checkout else {
            return Ok(None);
        };
        let current_checkout = match request
            .selected
            .repository
            .checkout_identity(&request.selected.commit)
        {
            Ok(current) if !current.filtered && &current == checkout => current,
            Err(mokly_git::error::Error::Cancelled) => return Err(Error::Cancelled),
            _ => return Ok(None),
        };
        let Some(inputs) = &self.inputs else {
            return Ok(None);
        };
        match self.working.read(
            request.selected.repository.as_ref(),
            inputs,
            Limits::default(),
        ) {
            Ok(current) if &current == inputs => Ok(Some(FreshnessReadings {
                checkout: current_checkout,
                requested_inputs: inputs,
                working_inputs: current,
            })),
            Ok(_) => Ok(None),
            Err(Error::Cancelled) => Err(Error::Cancelled),
            Err(error) => {
                tracing::debug!(%error, "eager working evidence is unavailable");
                Ok(None)
            }
        }
    }
}
