//! Semantic validation of public identity and entry relationships after the version gate.

use std::collections::BTreeSet;

use crate::axes::{ColorScheme, Viewport};
use crate::diagnostic::{AuthoringKind, Context};
use crate::paths::is_entry_path;
use crate::public_index::CatalogueReadModel;
use crate::public_metadata::CatalogueEntry;
use crate::public_records::CatalogueVisual;
use crate::readers::ReadError;
use crate::tree_validation;
use crate::validation::PropValidator;
use crate::wire_decode;

pub(crate) fn invalid(message: &'static str) -> ReadError {
    ReadError::Contract {
        boundary: "catalogue index",
        message,
    }
}

pub(crate) fn hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}

pub(crate) fn validate(index: &CatalogueReadModel) -> Result<(), ReadError> {
    if !hash(&index.identity.id)
        || index.identity.title != "Mokly"
        || !hash(&index.deployment_id)
        || index.revision > 9_007_199_254_740_991
    {
        return Err(invalid("invalid catalogue or deployment identity"));
    }
    if index
        .live
        .as_ref()
        .is_some_and(|live| !hash(&live.generation))
    {
        return Err(invalid("invalid live generation"));
    }
    let mut seen = BTreeSet::new();
    for entry in entries(index) {
        metadata(entry)?;
        if !seen.insert(entry.path.to_ascii_lowercase()) {
            return Err(invalid("duplicate or case-colliding current entry path"));
        }
    }
    let screen_paths: BTreeSet<_> = index
        .screens
        .iter()
        .map(|entry| entry.entry.path.as_str())
        .collect();
    for screen in &index.screens {
        visual(&screen.visual)?;
        if let Some(parent) = &screen.variant_of
            && (!index
                .screens
                .iter()
                .any(|candidate| candidate.entry.path == *parent && candidate.variant_of.is_none())
                || !variant_path(&screen.entry.path, parent))
        {
            return Err(invalid("invalid screen variant relationship"));
        }
        for path in &screen.use_case_paths {
            if !index.use_cases.iter().any(|flow| {
                flow.entry.path == *path
                    && flow
                        .steps
                        .iter()
                        .any(|step| step.screen_path == screen.entry.path)
            }) {
                return Err(invalid("nonreciprocal use-case membership"));
            }
        }
    }
    for component in &index.components {
        visual(&component.visual)?;
        if let Some(parent) = &component.variant_of {
            if !index
                .components
                .iter()
                .any(|candidate| candidate.entry.path == *parent && candidate.variant_of.is_none())
                || !variant_path(&component.entry.path, parent)
            {
                return Err(invalid("invalid component variant relationship"));
            }
        } else if !component.supplied_slots.is_empty() {
            return Err(invalid("component parent supplies variant slots"));
        }
    }
    for flow in &index.use_cases {
        if flow.steps.iter().any(|step| {
            !screen_paths.contains(step.screen_path.as_str())
                || !index.screens.iter().any(|screen| {
                    screen.entry.path == step.screen_path
                        && screen.use_case_paths.contains(&flow.entry.path)
                })
        }) {
            return Err(invalid("invalid or nonreciprocal use-case step"));
        }
    }
    for page in &index.pages {
        if !hash(&page.document_key) {
            return Err(invalid("invalid page document key"));
        }
    }
    for document in &index.documents {
        schemes(&document.color_schemes)?;
        if document
            .document_keys
            .iter()
            .map(|key| key.color_scheme)
            .collect::<Vec<_>>()
            != document.color_schemes
            || document
                .document_keys
                .iter()
                .any(|key| !hash(&key.document_key))
        {
            return Err(invalid("invalid document scheme keys"));
        }
    }
    tree_validation::validate(index)?;
    Ok(())
}

pub(crate) fn entries(index: &CatalogueReadModel) -> Vec<&CatalogueEntry> {
    index
        .screens
        .iter()
        .map(|entry| &entry.entry)
        .chain(index.components.iter().map(|entry| &entry.entry))
        .chain(index.pages.iter().map(|entry| &entry.entry))
        .chain(index.documents.iter().map(|entry| &entry.entry))
        .chain(index.use_cases.iter().map(|entry| &entry.entry))
        .collect()
}

fn metadata(entry: &CatalogueEntry) -> Result<(), ReadError> {
    if !is_entry_path(&entry.path)
        || entry
            .previous_path
            .as_deref()
            .is_some_and(|path| !is_entry_path(path))
        || entry.title.is_empty()
        || entry.title.trim() != entry.title
    {
        return Err(invalid("invalid entry path or title"));
    }
    if entry.details.source_path.is_empty()
        || entry.details.source_path.starts_with('/')
        || entry.details.source_path.contains(['\\', ':'])
        || entry
            .details
            .source_path
            .split('/')
            .any(|segment| matches!(segment, "" | "." | ".."))
    {
        return Err(invalid("invalid source metadata path"));
    }
    let mut tags = BTreeSet::new();
    if entry.tags.iter().any(|tag| {
        !tags.insert(tag)
            || !tag.split('-').all(|part| {
                !part.is_empty()
                    && part
                        .bytes()
                        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
            })
    }) {
        return Err(invalid("invalid or duplicate tag"));
    }
    Ok(())
}

fn visual(visual: &CatalogueVisual) -> Result<(), ReadError> {
    schemes(&visual.color_schemes)?;
    let expected: Vec<_> = [Viewport::Mobile, Viewport::Desktop]
        .into_iter()
        .flat_map(|viewport| {
            visual
                .color_schemes
                .iter()
                .map(move |scheme| (viewport, *scheme))
        })
        .collect();
    if visual
        .views
        .iter()
        .map(|view| (view.viewport, view.color_scheme))
        .collect::<Vec<_>>()
        != expected
        || visual.views.iter().any(|view| !hash(&view.document_key))
    {
        return Err(invalid("invalid view order or document key"));
    }
    let context = Context {
        entry: "public entry".into(),
        variant: None,
        kind: AuthoringKind::JavaScript,
    };
    let schema = match serde_json::to_value(&visual.prop_schema) {
        Ok(value) => value,
        Err(_) => return Err(invalid("invalid schema encoding")),
    };
    let validator = match PropValidator::compile(&schema, &context) {
        Ok(validator) => validator,
        Err(_) => return Err(invalid("invalid public prop schema")),
    };
    let props = match wire_decode::decode(&visual.props) {
        Ok(props) => props,
        Err(_) => return Err(invalid("invalid tagged props")),
    };
    let props = match serde_json::to_value(props) {
        Ok(value) => value,
        Err(_) => return Err(invalid("invalid prop encoding")),
    };
    if validator.validate(&props, &context).is_err() {
        return Err(invalid("recorded props fail the schema"));
    }
    Ok(())
}

fn schemes(schemes: &[ColorScheme]) -> Result<(), ReadError> {
    if schemes != [ColorScheme::Light] && schemes != [ColorScheme::Light, ColorScheme::Dark] {
        return Err(invalid("invalid color scheme order"));
    }
    Ok(())
}

fn variant_path(path: &str, parent: &str) -> bool {
    path.strip_prefix(parent)
        .and_then(|suffix| suffix.strip_prefix('/'))
        .is_some_and(|slug| !slug.contains('/') && !slug.is_empty())
}
