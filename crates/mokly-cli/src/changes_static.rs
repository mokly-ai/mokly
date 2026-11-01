//! Static base preparation checks input evidence before admitting document callbacks.

use std::sync::Arc;

use mokly_compare::base_render::{
    BasePreparationError, BasePreparationResult, BaseProvider, BaseRequest,
};
use mokly_compare::error::Error;
use mokly_graph::error::{GraphError, InternalError};
use mokly_static::error;
use mokly_static::fingerprint::InputTree;

pub(super) struct StaticBase {
    pub(super) inner: Arc<dyn BaseProvider>,
    pub(super) inputs: Arc<dyn InputTree>,
}

impl BaseProvider for StaticBase {
    fn prepare(&self, request: &BaseRequest<'_>) -> BasePreparationResult {
        let prepared = self.inner.prepare(request)?;
        match self.inputs.verify() {
            Ok(()) => Ok(prepared),
            Err(error::Error::InputsChanged { path }) => Err(BasePreparationError::new(
                prepared.scripts_off,
                Error::Graph {
                    source: GraphError::InputsChanged { path },
                },
            )),
            Err(source) => Err(BasePreparationError::new(
                prepared.scripts_off,
                Error::Graph {
                    source: GraphError::Internal(InternalError::Provider {
                        source: Box::new(source),
                    }),
                },
            )),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/changes_static_tests.rs"]
mod changes_static_tests;
