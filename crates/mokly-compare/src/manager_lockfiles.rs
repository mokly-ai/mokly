//! Local lockfile references use the same confinement rules as manifest inputs.

use percent_encoding::percent_decode_str;
use yaml_rust2::parser::{Event, Parser};

use crate::error::{Error, Result};
use crate::local_specifications;
use crate::manager_classic;
use crate::manifest;

pub(crate) fn validate(bytes: &[u8], path: &str) -> Result<()> {
    let text = match str::from_utf8(bytes) {
        Ok(text) => text,
        Err(_) => return Err(Error::InvalidInput { path: path.into() }),
    };
    let parent = path
        .rsplit_once('/')
        .map(|(parent, _)| parent)
        .unwrap_or("");
    let classic =
        path.ends_with("yarn.lock") && text.lines().any(|line| line.trim() == "# yarn lockfile v1");
    match yaml_strings(text, path) {
        Ok(values) => {
            for value in values {
                reference(&value, parent)?;
            }
        }
        Err(_) if classic => {}
        Err(error) => return Err(error),
    }
    if classic {
        for value in manager_classic::strings(text, path)? {
            reference(&value, parent)?;
        }
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

fn range(value: &str) -> &str {
    if manifest::local(value).is_some() || value.starts_with("patch:") {
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

fn reference(value: &str, project: &str) -> Result<()> {
    let mut pending = Some(value.to_owned());
    while let Some(value) = pending {
        let parent = importer(&value, project)?;
        let value_range = range(&value);
        if value_range.starts_with("patch:") {
            local_specifications::validate(value_range, &parent, project)?;
        } else {
            let source = value_range.split("::").next().unwrap_or(value_range);
            let source = source.split('#').next().unwrap_or(source);
            local_specifications::validate(source, &parent, project)?;
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
        let source = value_range.split("::").next().unwrap_or(value_range);
        let source = source.split('#').next().unwrap_or(source);
        if let Some(workspace) = source.strip_prefix("workspace:") {
            parent = manifest::target(project, workspace)?;
            break;
        }
        if let Some(local) = manifest::local(source) {
            paths.push(local.to_owned());
        }
        pending = locator(&value)?;
    }
    for path in paths.iter().rev() {
        parent = manifest::target(&parent, path)?;
    }
    Ok(parent)
}
