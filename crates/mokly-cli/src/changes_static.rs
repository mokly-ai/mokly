//! Static base preparation checks input evidence before admitting document callbacks.

use std::sync::Arc;

use mokly_compare::error::{Error, Result};
use mokly_graph::error::{GraphError, InternalError};
use mokly_static::error;
use mokly_static::fingerprint::InputTree;

use crate::base_render_admission::BaseRenderAdmission;

pub(super) struct StaticBase {
    pub(super) inputs: Arc<dyn InputTree>,
}

impl BaseRenderAdmission for StaticBase {
    fn check(&self) -> Result<()> {
        match self.inputs.verify() {
            Ok(()) => Ok(()),
            Err(error::Error::InputsChanged { path }) => Err(Error::Graph {
                source: GraphError::InputsChanged { path },
            }),
            Err(source) => Err(Error::Graph {
                source: GraphError::Internal(InternalError::Provider {
                    source: Box::new(source),
                }),
            }),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/changes_static_tests.rs"]
mod changes_static_tests;
