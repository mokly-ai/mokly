//! Historical entry fields use the same metadata and prop contracts as current records.

use std::collections::BTreeSet;

use crate::axes::ColorScheme;
use crate::canonical::compare_utf16;
use crate::diagnostic::{AuthoringKind, Context};
use crate::paths::is_entry_path;
use crate::snapshot_records::{EntryRecord, RecordVisual};
use crate::validation::PropValidator;
use crate::wire_decode;

pub(crate) fn valid(record: &EntryRecord) -> bool {
    let metadata = record.metadata();
    if !is_entry_path(&metadata.path)
        || metadata.title.is_empty()
        || metadata.title.trim() != metadata.title
        || !relative(&metadata.source_path)
    {
        return false;
    }
    let mut tags = BTreeSet::new();
    if metadata.tags.iter().flatten().any(|tag| {
        !tags.insert(tag)
            || !tag.split('-').all(|part| {
                !part.is_empty()
                    && part
                        .bytes()
                        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
            })
    }) {
        return false;
    }
    match record {
        EntryRecord::Screen {
            visual,
            use_case_paths,
            ..
        } => {
            visual_valid(visual, &metadata.path)
                && use_case_paths.iter().all(|path| is_entry_path(path))
        }
        EntryRecord::Component {
            visual,
            slots,
            supplied_slots,
            ..
        } => {
            visual_valid(visual, &metadata.path)
                && ordered(slots)
                && ordered(supplied_slots)
                && supplied_slots.iter().all(|slot| slots.contains(slot))
        }
        EntryRecord::Document {
            color_schemes,
            resources,
            ..
        } => {
            schemes(color_schemes)
                && ordered(resources)
                && resources.iter().all(|path| relative(path))
        }
        EntryRecord::Page { .. } => true,
    }
}

fn visual_valid(visual: &RecordVisual, path: &str) -> bool {
    if !schemes(&visual.color_schemes)
        || visual.variant_of.as_ref().is_some_and(|parent| {
            !is_entry_path(parent)
                || !path
                    .strip_prefix(parent)
                    .and_then(|rest| rest.strip_prefix('/'))
                    .is_some_and(|slug| !slug.is_empty() && !slug.contains('/'))
        })
    {
        return false;
    }
    let context = Context {
        entry: path.into(),
        variant: None,
        kind: AuthoringKind::JavaScript,
    };
    let Ok(schema) = serde_json::to_value(&visual.prop_schema) else {
        return false;
    };
    let Ok(validator) = PropValidator::compile(&schema, &context) else {
        return false;
    };
    let Ok(props) = wire_decode::decode(&visual.props) else {
        return false;
    };
    let Ok(props) = serde_json::to_value(props) else {
        return false;
    };
    validator.validate(&props, &context).is_ok()
}

fn schemes(schemes: &[ColorScheme]) -> bool {
    schemes == [ColorScheme::Light] || schemes == [ColorScheme::Light, ColorScheme::Dark]
}
fn ordered(values: &[String]) -> bool {
    values.iter().all(|value| !value.is_empty())
        && values
            .windows(2)
            .all(|pair| compare_utf16(&pair[0], &pair[1]).is_lt())
}
fn relative(path: &str) -> bool {
    !path.is_empty()
        && !path.starts_with('/')
        && !path.contains(['\\', ':', '\0'])
        && path.split('/').all(|part| !matches!(part, "" | "." | ".."))
}
