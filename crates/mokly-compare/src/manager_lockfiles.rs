//! Local lockfile references use the same confinement rules as manifest inputs.

use percent_encoding::percent_decode_str;
use yaml_rust2::parser::{Event, Parser};

use crate::error::{Error, Result};
use crate::local_specifications;
use crate::manager_classic;
use crate::manifest;

type ManifestContext<'a> = &'a [(String, Vec<String>)];

pub(crate) fn validate_with_context(
    bytes: &[u8],
    path: &str,
    manifests: ManifestContext<'_>,
) -> Result<()> {
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
    let importers = if path.ends_with("pnpm-lock.yaml") {
        pnpm_importers(text, parent, path)?
    } else {
        Vec::new()
    };
    match yaml_strings(text, path) {
        Ok(values) => {
            for value in values {
                reference(&value, parent, &importers, manifests, classic)?;
            }
        }
        Err(_) if classic => {}
        Err(error) => return Err(error),
    }
    if classic {
        for value in manager_classic::strings(text, path)? {
            reference(&value, parent, &importers, manifests, classic)?;
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
    if value.contains("://") {
        return value;
    }
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

fn reference(
    value: &str,
    project: &str,
    importers: &[(String, String)],
    manifests: ManifestContext<'_>,
    classic: bool,
) -> Result<()> {
    let mut pending = Some(value.to_owned());
    while let Some(value) = pending {
        let parent = importer(&value, project)?;
        let value_range = range(&value);
        if value_range.starts_with("patch:") {
            local_specifications::validate(value_range, &parent, project)?;
        } else {
            let reference = value_range.split("::").next().unwrap_or(value_range);
            let (source, selector) = reference
                .split_once('#')
                .map(|(source, selector)| (source, Some(selector)))
                .unwrap_or((reference, None));
            let importer_paths = importers
                .iter()
                .filter(|(reference, _)| reference == source)
                .map(|(_, parent)| parent.as_str())
                .collect::<Vec<_>>();
            if !importer_paths.is_empty() {
                for parent in importer_paths {
                    local_specifications::validate(source, parent, project)?;
                }
                return Ok(());
            }
            if classic {
                for (parent, specifications) in manifests {
                    if specifications
                        .iter()
                        .any(|specification| specification == source)
                    {
                        local_specifications::validate(source, parent, project)?;
                        return Ok(());
                    }
                }
            }
            local_specifications::validate(source, &parent, project)?;
            if !source.contains(':') && source.contains('/') {
                manifest::target(&parent, source)?;
            }
            if manifest::local(source).is_some()
                && let Some(selector) = selector
            {
                manifest::target(&parent, selector)?;
            }
        }
        pending = locator(&value)?;
    }
    Ok(())
}

fn pnpm_importers(text: &str, project: &str, path: &str) -> Result<Vec<(String, String)>> {
    let mut active = false;
    let mut importer = None;
    let mut values = Vec::new();
    for line in text.lines() {
        let indent = line.bytes().take_while(|byte| *byte == b' ').count();
        let value = line.trim();
        if indent == 0 && value == "importers:" {
            active = true;
            importer = None;
            continue;
        }
        if !active {
            continue;
        }
        if indent < 2 && value != "importers:" {
            if indent == 0 {
                active = false;
                importer = None;
            }
            continue;
        }
        let key = value
            .split_once('#')
            .map(|(key, _)| key.trim())
            .unwrap_or(value);
        if indent == 2 && key.ends_with(':') {
            let name = key[..key.len() - 1].trim_matches(['"', '\'']);
            importer = Some(manifest::target(project, name)?);
            continue;
        }
        let Some((_, raw)) = value.split_once(':') else {
            continue;
        };
        let raw = raw.trim().trim_matches(['"', '\'']);
        if raw.starts_with("link:")
            && let Some(parent) = &importer
        {
            values.push((raw.to_owned(), parent.clone()));
        }
    }
    if text.contains("importers:") && values.is_empty() {
        let _ = path;
    }
    Ok(values)
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
