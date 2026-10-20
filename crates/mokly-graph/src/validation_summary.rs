//! Complete-validation facts retain original failure, warning, and namespace order.

use std::collections::BTreeMap;

use mokly_catalogue::diagnostic::normalize_warnings;

use crate::error::{GraphError, Result};
use crate::route_inventory::RouteInventory;
use crate::session::Session;
use crate::types::RenderSummary;
use crate::validation;
use crate::workers::ValidatedView;

pub(crate) struct Summary {
    pub(crate) value: RenderSummary,
    failures: Vec<GraphError>,
    views: BTreeMap<String, ValidatedView>,
}

impl Summary {
    pub(crate) fn new(session: &Session) -> Self {
        Self {
            value: RenderSummary {
                documents: session.state.plans.len(),
                warnings: session.state.catalogue.warnings.clone(),
                ..Default::default()
            },
            failures: Vec::new(),
            views: BTreeMap::new(),
        }
    }

    pub(crate) fn record(&mut self, result: Result<ValidatedView>) {
        match result {
            Ok(view) => {
                self.value.closure.extend(view.closure.clone());
                self.value.warnings.extend(view.warnings.clone());
                self.views.insert(view.route.clone(), view);
            }
            Err(source) => self.failures.push(source),
        }
    }

    pub(crate) fn finish(mut self, session: &Session) -> Result<RenderSummary> {
        if !self.failures.is_empty() {
            return Err(GraphError::Attempt {
                failures: self.failures,
                warnings: self.value.warnings,
            });
        }
        if let Err(source) = validation::completed(session, &self.views) {
            return Err(GraphError::Attempt {
                failures: vec![source],
                warnings: self.value.warnings,
            });
        }
        let mut names = RouteInventory::default();
        for path in &self.value.closure {
            if let Err(source) = names.insert(path, true) {
                return Err(GraphError::Attempt {
                    failures: vec![source],
                    warnings: self.value.warnings,
                });
            }
        }
        normalize_warnings(&mut self.value.warnings);
        Ok(self.value)
    }
}
