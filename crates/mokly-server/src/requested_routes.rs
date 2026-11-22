//! Request recency is bounded by one catalogue's declared document routes.

use std::collections::{BTreeMap, VecDeque};

use crate::evidence::RenderRoute;

pub(crate) struct RequestedRoutes {
    positions: BTreeMap<String, usize>,
    recent: VecDeque<String>,
    priority: Vec<String>,
}

impl RequestedRoutes {
    /// An initial catalogue has an empty request list and uses catalogue order.
    pub(crate) fn new(routes: &[RenderRoute]) -> Self {
        Self {
            positions: routes
                .iter()
                .enumerate()
                .map(|(position, route)| (route.route.clone(), position))
                .collect(),
            recent: VecDeque::new(),
            priority: Vec::new(),
        }
    }

    /// Move one known route to the front, keeping at most one request per route.
    pub(crate) fn record(&mut self, route: &str) {
        if !self.positions.contains_key(route) {
            return;
        }
        let recorded = self.recent.iter().position(|name| name == route);
        let name = recorded
            .and_then(|position| self.recent.remove(position))
            .unwrap_or_else(|| route.to_owned());
        self.recent.push_front(name);
    }

    /// Transfer requested routes that still exist, in the order they were requested.
    pub(crate) fn rebuild(&self, next: &[RenderRoute]) -> Self {
        let mut next = Self::new(next);
        next.priority = self
            .recent
            .iter()
            .filter(|route| next.positions.contains_key(route.as_str()))
            .cloned()
            .collect();
        next
    }

    /// Catalogue positions of requests collected before this rebuild.
    pub(crate) fn priority(&self) -> Vec<usize> {
        self.priority
            .iter()
            .filter_map(|route| self.positions.get(route).copied())
            .collect()
    }
}
