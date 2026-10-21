//! Local lockfile references use the same confinement rules as manifest inputs.
//!
//! Each value resolves from the folder its manager uses. pnpm values follow
//! their YAML position, Yarn Classic values use the lockfile folder, and Yarn
//! Berry values use the workspace that their locator names.

use percent_encoding::percent_decode_str;
use yaml_rust2::parser::{Event, Parser};

use crate::error::{Error, Result};
use crate::local_specifications;
use crate::manager_classic;
use crate::manifest;
use crate::pnpm_lockfile;

pub(crate) fn validate(bytes: &[u8], path: &str) -> Result<()> {
    let Ok(text) = str::from_utf8(bytes) else {
        return Err(Error::InvalidInput { path: path.into() });
    };
    let folder = path
        .rsplit_once('/')
        .map(|(parent, _)| parent)
        .unwrap_or("");
    if path.rsplit('/').next() == Some("pnpm-lock.yaml") {
        return pnpm_lockfile::walk(text, folder, path, &mut |value, base, field| {
            if field && !value.is_empty() {
                manifest::target(base, value)?;
            }
            descriptors(value, |descriptor| plain(descriptor, base, folder))
        });
    }
    if manager_classic::lockfile(bytes) {
        for value in yaml_strings(text, path)
            .unwrap_or_default()
            .into_iter()
            .chain(manager_classic::strings(text, path)?)
        {
            descriptors(&value, |descriptor| plain(descriptor, folder, folder))?;
        }
        return Ok(());
    }
    for value in yaml_strings(text, path)? {
        descriptors(&value, |descriptor| berry(descriptor, folder))?;
    }
    Ok(())
}

fn yaml_strings(text: &str, path: &str) -> Result<Vec<String>> {
    let mut parser = Parser::new_from_str(text);
    let mut values = Vec::new();
    loop {
        match parser.next_token() {
            Ok((Event::StreamEnd, _)) => return Ok(values),
            Ok((Event::Scalar(value, _, _, _), _)) => values.push(value),
            Ok(_) => {}
            Err(_) => return Err(Error::InvalidInput { path: path.into() }),
        }
    }
}

fn descriptors(value: &str, check: impl FnMut(&str) -> Result<()>) -> Result<()> {
    value
        .split(',')
        .map(str::trim)
        .filter(|descriptor| !descriptor.is_empty())
        .try_for_each(check)
}

fn url(value: &str) -> bool {
    value.split_once("://").is_some_and(|(scheme, _)| {
        scheme.starts_with(|character: char| character.is_ascii_alphabetic())
            && scheme.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '+' | '-' | '.')
            })
    })
}

fn range(value: &str) -> &str {
    if url(value) || manifest::local(value).is_some() || value.starts_with("patch:") {
        return value;
    }
    value
        .strip_prefix('@')
        .unwrap_or(value)
        .split_once('@')
        .map(|(_, range)| range)
        .unwrap_or(value)
}

fn locator(value: &str) -> Result<Option<String>> {
    let Some((_, parameters)) = value.split_once("::") else {
        return Ok(None);
    };
    let Some(locator) = parameters
        .split('&')
        .find_map(|parameter| parameter.strip_prefix("locator="))
    else {
        return Ok(None);
    };
    match percent_decode_str(locator).decode_utf8() {
        Ok(locator) => Ok(Some(locator.into_owned())),
        Err(_) => Err(Error::InvalidInput { path: value.into() }),
    }
}

fn plain(value: &str, base: &str, project: &str) -> Result<()> {
    let value = range(value);
    if value.starts_with("patch:") {
        return local_specifications::validate(value, base, project);
    }
    source(value, base, project)
}

fn source(value: &str, base: &str, project: &str) -> Result<()> {
    let (source, selector) = value
        .split_once('#')
        .map(|(source, selector)| (source, Some(selector)))
        .unwrap_or((value, None));
    local_specifications::validate(source, base, project)?;
    if !source.contains(':') && source.contains('/') {
        manifest::target(base, source)?;
    }
    if manifest::local(source).is_some()
        && let Some(selector) = selector
    {
        manifest::target(base, selector)?;
    }
    Ok(())
}

fn berry(value: &str, project: &str) -> Result<()> {
    let mut pending = Some(value.to_owned());
    while let Some(value) = pending {
        let parent = importer(&value, project)?;
        let value_range = range(&value);
        if value_range.starts_with("patch:") {
            local_specifications::validate(value_range, &parent, project)?;
        } else {
            let reference = value_range.split("::").next().unwrap_or(value_range);
            source(reference, &parent, project)?;
        }
        pending = locator(&value)?;
    }
    Ok(())
}

fn importer(value: &str, project: &str) -> Result<String> {
    let mut pending = locator(value)?;
    let mut paths = Vec::new();
    let mut parent = project.to_owned();
    while let Some(value) = pending {
        let value_range = range(&value);
        let reference = value_range.split("::").next().unwrap_or(value_range);
        let (source, selector) = reference
            .split_once('#')
            .map(|(source, selector)| (source, Some(selector)))
            .unwrap_or((reference, None));
        if let Some(workspace) = source.strip_prefix("workspace:") {
            parent = manifest::target(project, workspace)?;
            break;
        }
        if let Some(local) = manifest::local(source) {
            paths.push(selector.unwrap_or(local).to_owned());
        }
        pending = locator(&value)?;
    }
    for path in paths.iter().rev() {
        parent = manifest::target(&parent, path)?;
    }
    Ok(parent)
}
