//! Request recency is bounded by one catalogue's declared document routes.

use std::collections::{BTreeMap, VecDeque};

use crate::evidence::RenderRoute;

pub(crate) struct RequestedRoutes {
    positions: BTreeMap<String, usize>,
    recent: VecDeque<usize>,
    priority: Vec<usize>,
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
        let Some(&position) = self.positions.get(route) else {
            return;
        };
        if let Some(previous) = self.recent.iter().position(|&value| value == position) {
            self.recent.remove(previous);
        }
        self.recent.push_front(position);
    }

    /// Transfer requested routes that still exist, in the order they were requested.
    pub(crate) fn rebuild(&self, previous: &[RenderRoute], next: &[RenderRoute]) -> Self {
        let mut next = Self::new(next);
        next.priority = self
            .recent
            .iter()
            .filter_map(|&position| next.positions.get(&previous[position].route).copied())
            .collect();
        next
    }

    /// Catalogue positions of requests collected before this rebuild.
    pub(crate) fn priority(&self) -> Vec<usize> {
        self.priority.clone()
    }
}
