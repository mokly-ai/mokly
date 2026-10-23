//! Portable output names reject case-folded file and directory collisions.

use std::collections::BTreeMap;

use crate::error;
use crate::error::{Result, invalid};

/// One generated or authored output namespace, independent of filesystem behavior.
#[derive(Default)]
pub struct RouteInventory {
    files: BTreeMap<String, String>,
    directories: BTreeMap<String, String>,
}

impl RouteInventory {
    /// Register one file. A shared asset may repeat its exact spelling.
    pub fn insert(&mut self, route: &str, shared: bool) -> Result<()> {
        let folded = route.to_ascii_lowercase();
        if let Some(first) = self.files.get(&folded) {
            if shared && first == route {
                return Ok(());
            }
            return Err(collision(route, first));
        }
        if let Some(first) = self.directories.get(&folded) {
            return Err(collision(route, first));
        }
        let parts: Vec<_> = route.split('/').collect();
        for length in 1..parts.len() {
            let directory = parts[..length].join("/");
            let key = directory.to_ascii_lowercase();
            if let Some(first) = self.files.get(&key) {
                return Err(collision(route, first));
            }
            self.directories.insert(key, directory);
        }
        self.files.insert(folded, route.into());
        Ok(())
    }
}

fn collision(route: &str, first: &str) -> error::GraphError {
    let message = if route.starts_with("styles/") {
        format!(
            "stylesheet route collision: {route}; give each root module a distinct repository path"
        )
    } else {
        format!("output route collision: {route} conflicts with {first}")
    };
    invalid(route, message)
}
