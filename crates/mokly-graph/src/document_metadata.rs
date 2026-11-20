//! Complete retained codec metadata also supplies the comparison identity.

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_html::composition::Composed;
use mokly_html::links::Reference;
use mokly_html::tree::Node;
use mokly_model::usage::CatalogueUsage;
use serde::ser::SerializeSeq;
use serde::{Serialize, Serializer};

use crate::cache::Artifact;
use crate::document_annotations::ReferenceRecord;

#[derive(Serialize)]
pub(crate) struct Metadata {
    pub(crate) content_type: String,
    pub(crate) document: Option<DocumentMetadata>,
}

#[derive(Serialize)]
pub(crate) struct DocumentMetadata {
    pub(crate) usage: CatalogueUsage,
    #[serde(serialize_with = "warnings")]
    warnings: Vec<Warning>,
    resources: Vec<String>,
    components: Vec<String>,
    links: Vec<ReferenceRecord>,
}

impl Metadata {
    pub(crate) fn capture(artifact: &Artifact) -> Self {
        let Artifact {
            bytes: _,
            document,
            fragment: _,
            content_type,
        } = artifact;
        Self {
            content_type: content_type.clone(),
            document: document.as_ref().map(|document| {
                let Composed {
                    tree: _,
                    usage,
                    warnings,
                    resources,
                    components,
                    links,
                } = document;
                DocumentMetadata {
                    usage: usage.clone(),
                    warnings: warnings.clone(),
                    resources: resources.clone(),
                    components: components.clone(),
                    links: links.iter().map(ReferenceRecord::from).collect(),
                }
            }),
        }
    }

    pub(crate) fn restore(&self, tree: Vec<Node>) -> Option<Composed> {
        self.document.as_ref().map(|metadata| Composed {
            tree,
            usage: metadata.usage.clone(),
            warnings: metadata.warnings.clone(),
            resources: metadata.resources.clone(),
            components: metadata.components.clone(),
            links: metadata
                .links
                .iter()
                .cloned()
                .map(Reference::from)
                .collect(),
        })
    }
}

fn warnings<S: Serializer>(warnings: &[Warning], serializer: S) -> Result<S::Ok, S::Error> {
    let mut sequence = serializer.serialize_seq(Some(warnings.len()))?;
    for Warning {
        code,
        subject,
        message,
    } in warnings
    {
        let subject = match subject {
            WarningSubject::Route(path) => (0, path),
            WarningSubject::Entry(path) => (1, path),
            WarningSubject::Component(path) => (2, path),
            WarningSubject::Folder(path) => (3, path),
            WarningSubject::Configuration(path) => (4, path),
        };
        sequence.serialize_element(&(code, subject, message))?;
    }
    sequence.end()
}
