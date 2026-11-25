//! Private JSON records preserve metadata without public catalogue persistence rules.

use mokly_catalogue::diagnostic::{STORY_RENDER_FAILED, Warning, WarningSubject};
use mokly_model::usage::{
    CatalogueUsage, ComponentInstanceRecord, ComponentRangeRecord, ComponentSlotRecord,
};
use serde::{Deserialize, Serialize};
use std::mem;

use crate::document_annotations::ReferenceRecord;
use crate::document_capacity;
use crate::document_codec::EncodedView;

#[derive(Deserialize, Serialize)]
pub(crate) enum Usage {
    Pending,
    Unavailable,
    Ready {
        instances: Vec<ComponentInstanceRecord>,
        slots: Vec<ComponentSlotRecord>,
        ranges: Vec<ComponentRangeRecord>,
    },
}

impl From<&CatalogueUsage> for Usage {
    fn from(value: &CatalogueUsage) -> Self {
        match value {
            CatalogueUsage::Pending => Self::Pending,
            CatalogueUsage::Unavailable => Self::Unavailable,
            CatalogueUsage::Ready {
                instances,
                slots,
                ranges,
            } => Self::Ready {
                instances: instances.clone(),
                slots: slots.clone(),
                ranges: ranges.clone(),
            },
        }
    }
}

impl From<Usage> for CatalogueUsage {
    fn from(value: Usage) -> Self {
        match value {
            Usage::Pending => Self::Pending,
            Usage::Unavailable => Self::Unavailable,
            Usage::Ready {
                instances,
                slots,
                ranges,
            } => Self::Ready {
                instances,
                slots,
                ranges,
            },
        }
    }
}

#[derive(Deserialize, Serialize)]
enum Subject {
    Route(String),
    Entry(String),
    Component(String),
    Folder(String),
    Configuration(String),
}

#[derive(Deserialize, Serialize)]
pub(crate) struct StoredWarning {
    code: String,
    subject: Subject,
    message: String,
}

fn warning_code(code: &str) -> Option<&'static str> {
    match code {
        "html-foster-parented" => Some("html-foster-parented"),
        "html-ignore-attribute" => Some("html-ignore-attribute"),
        "html-unused-props" => Some("html-unused-props"),
        "link-control-ancestor" => Some("link-control-ancestor"),
        "link-control-descendant" => Some("link-control-descendant"),
        "marker-in-raw-text" => Some("marker-in-raw-text"),
        "props-unsafe-integer" => Some("props-unsafe-integer"),
        "props-control-bounds" => Some("props-control-bounds"),
        "props-not-data" => Some("props-not-data"),
        "duplicate-component-stylesheet" => Some("duplicate-component-stylesheet"),
        "stylesheet-extglob" => Some("stylesheet-extglob"),
        STORY_RENDER_FAILED => Some(STORY_RENDER_FAILED),
        "vite-replaced-setting" => Some("vite-replaced-setting"),
        _ => None,
    }
}

impl StoredWarning {
    fn encode(value: &Warning) -> Option<Self> {
        let subject = match &value.subject {
            WarningSubject::Route(value) => Subject::Route(value.clone()),
            WarningSubject::Entry(value) => Subject::Entry(value.clone()),
            WarningSubject::Component(value) => Subject::Component(value.clone()),
            WarningSubject::Folder(value) => Subject::Folder(value.clone()),
            WarningSubject::Configuration(value) => Subject::Configuration(value.clone()),
        };
        Some(Self {
            code: warning_code(value.code)?.into(),
            subject,
            message: value.message.clone(),
        })
    }
    pub(crate) fn restore(self) -> Option<Warning> {
        let subject = match self.subject {
            Subject::Route(value) => WarningSubject::Route(value),
            Subject::Entry(value) => WarningSubject::Entry(value),
            Subject::Component(value) => WarningSubject::Component(value),
            Subject::Folder(value) => WarningSubject::Folder(value),
            Subject::Configuration(value) => WarningSubject::Configuration(value),
        };
        Some(Warning {
            code: warning_code(&self.code)?,
            subject,
            message: self.message,
        })
    }
}

#[derive(Deserialize, Serialize)]
pub(crate) struct StoredMetadata {
    pub(crate) usage: Usage,
    pub(crate) resources: Vec<String>,
    pub(crate) components: Vec<String>,
    pub(crate) links: Vec<ReferenceRecord>,
    pub(crate) warnings: Vec<StoredWarning>,
    pub(crate) content_type: String,
}

impl StoredMetadata {
    pub(crate) fn known_bytes(&self) -> (usize, usize) {
        let (usage, charge) = match &self.usage {
            Usage::Ready {
                instances,
                slots,
                ranges,
            } => document_capacity::usage(instances, slots, ranges),
            _ => (0, 0),
        };
        let warnings = self.warnings.capacity() * mem::size_of::<StoredWarning>()
            + self
                .warnings
                .iter()
                .map(|warning| {
                    warning.code.capacity()
                        + warning.message.capacity()
                        + match &warning.subject {
                            Subject::Route(value)
                            | Subject::Entry(value)
                            | Subject::Component(value)
                            | Subject::Folder(value)
                            | Subject::Configuration(value) => value.capacity(),
                        }
                })
                .sum::<usize>();
        (
            usage
                + warnings
                + document_capacity::strings(&self.resources)
                + document_capacity::strings(&self.components)
                + document_capacity::links(&self.links)
                + self.content_type.capacity(),
            charge,
        )
    }
    pub(crate) fn new(value: &EncodedView) -> Option<Self> {
        let metadata = value.metadata.document.as_ref()?;
        if metadata
            .warnings
            .iter()
            .any(|warning| warning_code(warning.code).is_none())
        {
            return None;
        }
        Some(Self {
            usage: Usage::from(&metadata.usage),
            resources: metadata.resources.clone(),
            components: metadata.components.clone(),
            links: metadata.links.clone(),
            warnings: metadata
                .warnings
                .iter()
                .map(StoredWarning::encode)
                .collect::<Option<Vec<_>>>()?,
            content_type: value.metadata.content_type.clone(),
        })
    }
}
