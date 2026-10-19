//! Confined reads of public resource routes for comparison and static capture.

use mokly_model::material::digest;

use crate::closure::GeneratedResources;
use crate::error::{Result, invalid};
use crate::public_denial::PublicDenial;
use crate::session::Session;

impl Session {
    pub(crate) fn digest_resource(&self, route: &str) -> Result<Option<String>> {
        if let Some(generated) = route.strip_prefix("static/mokly-generated/") {
            if let Some(asset) = self
                .state
                .resources
                .get(generated)
                .and_then(|plan| plan.asset.as_ref())
            {
                return Ok(Some(asset.digest.clone()));
            }
            return Ok(self.read_resource(route)?.as_deref().map(digest));
        }
        let path = route
            .strip_prefix("static/")
            .ok_or_else(|| invalid(route, "resource is outside the static namespace"))?;
        let file = match self.state.policy.check(path) {
            Ok(file) => file,
            Err(PublicDenial::Missing) => return Ok(None),
            Err(reason) => {
                return Err(invalid(
                    route,
                    format!("protected target {route}: {}", reason.reason()),
                ));
            }
        };
        match self.state.tree.digest(&file.absolute) {
            Ok(hash) => Ok(Some(hash)),
            Err(source) if source.is_vanished() => Ok(None),
            Err(source) => Err(invalid(
                route,
                format!("resource {route} could not be hashed: {source}"),
            )),
        }
    }

    pub(crate) fn read_resource(&self, route: &str) -> Result<Option<Vec<u8>>> {
        if let Some(generated) = route.strip_prefix("static/mokly-generated/") {
            return self.resource(generated);
        }
        let Some(path) = route.strip_prefix("static/") else {
            return Err(invalid(route, "resource is outside the static namespace"));
        };
        let file = match self.state.policy.check(path) {
            Ok(file) => file,
            Err(PublicDenial::Missing) => return Ok(None),
            Err(reason) => {
                return Err(invalid(
                    route,
                    format!("protected target {route}: {}", reason.reason()),
                ));
            }
        };
        match self.state.tree.read_public(&file.absolute) {
            Ok(bytes) => Ok(Some(bytes)),
            Err(source) if source.is_vanished() => Ok(None),
            Err(source) => Err(invalid(
                route,
                format!("resource {route} could not be read: {source}"),
            )),
        }
    }
}
