//! Reviewable metadata projection excludes sources, folders, and move declarations.

use std::collections::BTreeMap;

use mokly_model::axes::ColorScheme;
use mokly_model::canonical;
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry, UseCaseStep, VisualEntry};
use mokly_model::controls::ComponentControl;
use mokly_model::data::Props;
use mokly_model::prop_schema::PropSchema;
use serde::Serialize;

use crate::comparison_error::CompareResult;
use crate::error::Result;
use crate::material::mapped;

#[derive(Serialize)]
struct Metadata<'a> {
    path: String,
    title: &'a str,
    description: &'a str,
    rationale: &'a Option<String>,
    tags: &'a [String],
    related_docs: Vec<String>,
    variant_of: Option<String>,
    parent_title: Option<&'a str>,
    content: Content<'a>,
}

#[derive(Serialize)]
enum Content<'a> {
    Screen {
        visual: Visual<'a>,
        address: &'a Option<String>,
        memberships: Vec<String>,
    },
    Component {
        visual: Visual<'a>,
        #[serde(skip_serializing_if = "Option::is_none")]
        slots: Option<&'a [String]>,
        supplied: &'a [String],
    },
    Page,
    Document(&'a [ColorScheme]),
    UseCase(Vec<UseCaseStep>),
}

#[derive(Serialize)]
struct Visual<'a> {
    schemes: &'a [ColorScheme],
    #[serde(skip_serializing_if = "Option::is_none")]
    schema: Option<&'a PropSchema>,
    props: &'a Props,
    #[serde(skip_serializing_if = "Option::is_none")]
    controls: Option<&'a BTreeMap<String, ComponentControl>>,
}

pub(crate) fn projection(
    entry: &ModelEntry,
    catalogue: &CatalogueModel,
    paths: &BTreeMap<String, String>,
) -> Result<String> {
    let shared_fields = entry.metadata.variant_of.is_none();
    let content = match &entry.content {
        EntryContent::Screen {
            visual: fields,
            address,
            use_case_paths,
        } => Content::Screen {
            visual: visual(fields, shared_fields),
            address,
            memberships: path_set(use_case_paths, paths),
        },
        EntryContent::Component {
            visual: fields,
            slots,
            supplied_slots,
            ..
        } => Content::Component {
            visual: visual(fields, shared_fields),
            slots: shared_fields.then_some(slots.as_slice()),
            supplied: supplied_slots,
        },
        EntryContent::Page => Content::Page,
        EntryContent::Document { color_schemes, .. } => Content::Document(color_schemes),
        EntryContent::UseCase { steps } => Content::UseCase(
            steps
                .iter()
                .map(|step| UseCaseStep {
                    screen_path: mapped(&step.screen_path, paths),
                    title: step.title.clone(),
                    description: step.description.clone(),
                })
                .collect(),
        ),
    };
    let metadata = &entry.metadata;
    let parent = metadata.variant_of.as_ref().and_then(|path| {
        catalogue
            .entries
            .iter()
            .find(|entry| entry.metadata.path.eq_ignore_ascii_case(path))
    });
    let related_docs = metadata
        .related_docs
        .iter()
        .map(|label| {
            catalogue
                .entries
                .iter()
                .find(|entry| {
                    matches!(entry.content, EntryContent::Document { .. })
                        && entry.metadata.source.path == *label
                })
                .map_or_else(
                    || label.clone(),
                    |entry| format!("mock:{}", mapped(&entry.metadata.path, paths)),
                )
        })
        .collect();
    canonical::to_string(&Metadata {
        path: {
            let path = mapped(&metadata.path, paths);
            if path.eq_ignore_ascii_case(&metadata.path) {
                metadata.path.clone()
            } else {
                path
            }
        },
        title: &metadata.title,
        description: &metadata.description,
        rationale: &metadata.rationale,
        tags: &metadata.tags,
        related_docs,
        variant_of: metadata.variant_of.as_ref().map(|path| mapped(path, paths)),
        parent_title: parent.map(|entry| entry.metadata.title.as_str()),
        content,
    })
    .compare()
}

fn visual(visual: &VisualEntry, shared_fields: bool) -> Visual<'_> {
    Visual {
        schemes: &visual.color_schemes,
        schema: shared_fields.then_some(&visual.prop_schema),
        props: &visual.props,
        controls: shared_fields.then_some(&visual.controls),
    }
}

fn path_set(values: &[String], paths: &BTreeMap<String, String>) -> Vec<String> {
    let mut values: Vec<_> = values.iter().map(|path| mapped(path, paths)).collect();
    values.sort_by(|left, right| canonical::compare_utf16(left, right));
    values.dedup();
    values
}
