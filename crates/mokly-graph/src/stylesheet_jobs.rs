//! Graph preparation bundles each stylesheet root as one render-worker job.

use mokly_css::types::{Bundle, StylesheetRoot};

use crate::error::{GraphError, Result};
use crate::graph::Graph;
use crate::workers::{StylesheetWorker, check_cancelled};

impl StylesheetWorker for Graph {
    fn stylesheet(&self, root: &StylesheetRoot) -> Result<Bundle> {
        check_cancelled(self.workers.as_ref())?;
        match self.stylesheets.bundle(root) {
            Ok(bundle) => Ok(bundle),
            Err(source) => Err(GraphError::Css { source }),
        }
    }
}
