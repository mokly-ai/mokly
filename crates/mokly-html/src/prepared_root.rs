//! Owned, single-attempt JavaScript roots cross into existing render workers.

use std::fmt;

use crate::compose_start::Start;
use crate::composition::ComposeRequest;
use crate::error::{HtmlError, Result};
use crate::fragment::{Fragment, FragmentRenderer, FragmentRequest};
use crate::javascript_request::{self, Invocation};
use crate::root_context_weight;

/// Opaque start state, exact request, and its one successful or failed response.
/// Only HtmlComposer prepares or consumes this owner. It contains no parsed tree.
pub struct PreparedRoot {
    pub(crate) start: Start,
    pub(crate) request: FragmentRequest,
    pub(crate) result: Result<Fragment>,
}

impl PreparedRoot {
    pub(crate) fn prepare(
        request: &ComposeRequest<'_>,
        renderer: &dyn FragmentRenderer,
    ) -> Result<Option<Self>> {
        if !Start::eligible(request.catalogue, request.entry) {
            return Ok(None);
        }
        let start = match Start::new(request) {
            Ok(start) => start,
            Err(source) => return Err(attempt(source)),
        };
        let fragment_request = match javascript_request::request(
            request,
            Invocation {
                path: &start.parent,
                kind: start.kind.clone(),
                props: &start.context.props,
                ignore_enabled: start.context.ignore,
                slots: start.context.slots.keys().map(String::as_str).collect(),
            },
        ) {
            Ok(request) => request,
            Err(source) => return Err(attempt(source)),
        };
        let result = renderer.render(&fragment_request);
        Ok(Some(Self {
            start,
            request: fragment_request,
            result,
        }))
    }

    /// Return the original composition failure before any completion admission.
    pub fn into_ready(self) -> Result<Self> {
        match self.result {
            Ok(_) => Ok(self),
            Err(source) => Err(attempt(source)),
        }
    }

    /// Retained start and request capacities, excluding the fragment payload.
    pub fn input_bytes(&self) -> usize {
        root_context_weight::prepared(&self.start.parent, &self.start.context, &self.request)
    }

    /// Read the successful root for capacity accounting without copying it.
    pub fn fragment(&self) -> Option<&Fragment> {
        self.result.as_ref().ok()
    }
}

impl fmt::Debug for PreparedRoot {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("PreparedRoot")
    }
}

fn attempt(source: HtmlError) -> HtmlError {
    HtmlError::Attempt {
        source: Box::new(source),
        warnings: Vec::new(),
    }
}
