//! Confinement of local specifications wrapped by Yarn patch descriptors.

use std::borrow::Cow;

use percent_encoding::percent_decode_str;

use crate::error::{Error, Result};
use crate::manifest;

pub(crate) fn validate(value: &str, parent: &str, project: &str) -> Result<()> {
    let mut pending = value.to_owned();
    loop {
        let Some(patch) = pending.strip_prefix("patch:") else {
            if let Some(local) = manifest::local(&pending) {
                manifest::target(parent, local)?;
            }
            return Ok(());
        };
        let Some((source, selector)) = patch.split_once('#') else {
            return Err(Error::InvalidInput { path: value.into() });
        };
        let source = decode(source)?;
        let selector = decode(selector.split("::").next().unwrap_or(""))?;
        for path in selector.split('&').filter(|path| !path.is_empty()) {
            let path = path.rsplit('!').next().unwrap_or(path);
            if path.starts_with("builtin<") && path.ends_with('>') {
                continue;
            }
            if let Some(path) = path.strip_prefix("~/") {
                manifest::target(project, path)?;
            } else {
                manifest::target(parent, path)?;
            }
        }
        let name = if source.starts_with('@') {
            source.get(1..).unwrap_or("")
        } else {
            &source
        };
        pending = name
            .split_once('@')
            .map(|(_, range)| range)
            .unwrap_or(name)
            .to_owned();
    }
}

fn decode(value: &str) -> Result<Cow<'_, str>> {
    match percent_decode_str(value).decode_utf8() {
        Ok(value) => Ok(value),
        Err(_) => Err(Error::InvalidInput { path: value.into() }),
    }
}
