//! Deployment-owned build profile rules for the API composition root.

use mkc_build_interface::error::{Error, Result};
use sandbox_interface::EgressDestination;

use crate::failure::Failure;

/// Rules added to the adapter's built-in private network deny list.
pub const BUILD_DENIED_DESTINATIONS: &[&str] =
    &["0.0.0.0/8", "240.0.0.0/4", "64:ff9b::/96", "ff00::/8"];

/// Produce canonical, sorted, unique profile rules with all required build denies.
///
/// The API passes these to the build profile with public egress enabled.
/// The backend adds its own private, loopback and link-local rules.
pub fn denied_destinations(additional: &[EgressDestination]) -> Result<Vec<String>> {
    if additional.len() > 32 {
        return Err(Error::internal(Failure::Deployment));
    }
    let mut result: Vec<_> = BUILD_DENIED_DESTINATIONS
        .iter()
        .map(|value| (*value).to_owned())
        .collect();
    for value in additional {
        if matches!(value, EgressDestination::Domain(_)) {
            return Err(Error::internal(Failure::Deployment));
        }
        let Ok(value) = value.validated() else {
            return Err(Error::internal(Failure::Deployment));
        };
        result.push(value.to_string());
    }
    result.sort();
    result.dedup();
    Ok(result)
}

#[cfg(test)]
#[path = "_tests_/policy_tests.rs"]
mod policy_tests;
