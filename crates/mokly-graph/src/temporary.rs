//! Transient props share composition and resource checks without changing saved views.

use std::sync::Arc;

use mokly_html::error::HtmlError;
use mokly_model::catalogue::EntryContent;
use mokly_model::controls;
use mokly_model::data::Props;
use mokly_model::diagnostic::{AuthoringKind, Context};
use mokly_model::validation::PropValidator;

use crate::cache::Artifact;
use crate::closure::{Closure, ClosureBuilder};
use crate::document_composition;
use crate::error::{GraphError, InternalError, Result, invalid};
use crate::session::Session;
use crate::types::TemporaryDocument;
use crate::validation;
use crate::workers::ArtifactWorker;

/// Render one view with validated transient props through the catalogue's document
/// pipeline. Its fragments use the shared memo cache under the normal fragment key, and
/// saved props reuse the cached saved document, so a repeat render costs a cache hit.
pub(crate) fn render(session: &Session, route: &str, props: &Props) -> Result<TemporaryDocument> {
    let job = PropsJob { session, props };
    let artifact = session.state.workers.document(route, &job)?;
    let rendered = Rendered {
        session,
        artifact: artifact.clone(),
    };
    let closure = session.state.workers.closure(route, &rendered)?;
    Ok(TemporaryDocument { artifact, closure })
}

struct PropsJob<'a> {
    session: &'a Session,
    props: &'a Props,
}

impl ArtifactWorker for PropsJob<'_> {
    fn artifact(&self, route: &str) -> Result<Arc<Artifact>> {
        let plan = self
            .session
            .state
            .plans
            .get(route)
            .ok_or_else(|| invalid(route, "document route is absent from this generation"))?;
        let mut entry = self.session.state.catalogue.model.entries[plan.entry].clone();
        let visual = match &mut entry.content {
            EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => visual,
            _ => {
                return Err(invalid(
                    route,
                    "temporary props require a screen or component",
                ));
            }
        };
        let context = Context {
            entry: entry.metadata.path.clone(),
            variant: entry
                .metadata
                .variant_of
                .as_ref()
                .and_then(|_| entry.metadata.path.rsplit('/').next())
                .map(str::to_owned),
            kind: if entry.metadata.source.export.is_some() {
                AuthoringKind::JavaScript
            } else {
                AuthoringKind::Html
            },
        };
        let schema = match serde_json::to_value(&visual.prop_schema) {
            Ok(value) => value,
            Err(source) => return Err(InternalError::Json { source }.into()),
        };
        let props = match serde_json::to_value(self.props) {
            Ok(value) => value,
            Err(source) => return Err(InternalError::Json { source }.into()),
        };
        let validator = match PropValidator::compile(&schema, &context) {
            Ok(validator) => validator,
            Err(source) => {
                return Err(GraphError::Html {
                    source: HtmlError::Props { source },
                });
            }
        };
        if let Err(source) = validator.validate(&props, &context) {
            return Err(GraphError::Html {
                source: HtmlError::Props { source },
            });
        }
        let schema = match serde_json::to_value(controls::with_bounds(
            &visual.prop_schema,
            &visual.controls,
        )) {
            Ok(value) => value,
            Err(source) => return Err(InternalError::Json { source }.into()),
        };
        let validator = match PropValidator::compile(&schema, &context) {
            Ok(validator) => validator,
            Err(source) => {
                return Err(GraphError::Html {
                    source: HtmlError::Props { source },
                });
            }
        };
        if let Err(source) = validator.validate(&props, &context) {
            return Err(GraphError::Html {
                source: HtmlError::Props { source },
            });
        }
        if &visual.props == self.props
            && let Some(artifact) = self.session.state.cache.get(&plan.key)
        {
            return Ok(artifact);
        }
        visual.props = self.props.clone();
        document_composition::document(self.session, plan, &entry)
    }

    fn closure_job(&self, route: &str) -> Result<Closure> {
        let artifact = self.artifact(route)?;
        let document = artifact
            .document
            .as_ref()
            .ok_or_else(|| invalid(route, "temporary document has no tree"))?;
        validation::links(self.session, &document.links)?;
        self.session
            .preview_walker()
            .collect(route, &document.tree, &document.resources)
    }
}

struct Rendered<'a> {
    session: &'a Session,
    artifact: Arc<Artifact>,
}

impl ArtifactWorker for Rendered<'_> {
    fn artifact(&self, _route: &str) -> Result<Arc<Artifact>> {
        Ok(self.artifact.clone())
    }
    fn closure_job(&self, route: &str) -> Result<Closure> {
        let document = self
            .artifact
            .document
            .as_ref()
            .ok_or_else(|| invalid(route, "temporary document has no tree"))?;
        validation::links(self.session, &document.links)?;
        self.session
            .preview_walker()
            .collect(route, &document.tree, &document.resources)
    }
}
