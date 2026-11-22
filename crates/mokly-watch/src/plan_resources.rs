//! Render-discovered resources extend exact classification with Reload actions.

use std::collections::BTreeSet;

use crate::event::Action;
use crate::plan::Plan;

impl Plan {
    /// Newly rendered closures become observable before the background pass completes.
    pub fn resources(&mut self, paths: &BTreeSet<String>) {
        for path in paths {
            self.resource(path);
        }
    }

    /// Extend exact classification for one synchronously attached resource.
    pub fn resource(&mut self, path: &str) {
        self.required(self.repository.join(path), Action::Reload);
    }
}
