//! One composition pipeline for saved catalogue views and transient prop renders.

use std::sync::Arc;

use mokly_html::composition::ComposeRequest;
use mokly_html::error::HtmlError;
use mokly_model::axes::Viewport;
use mokly_model::catalogue::{EntryContent, ModelEntry};

use crate::cache::Artifact;
use crate::error::{GraphError, Result};
use crate::session::Session;
use crate::types::DocumentPlan;
use crate::{markdown_links, rendering, styles};

pub(crate) fn document(
    session: &Session,
    plan: &DocumentPlan,
    entry: &ModelEntry,
) -> Result<Arc<Artifact>> {
    let route = plan.route.as_str();
    let mut composed = if matches!(entry.content, EntryContent::Document { .. }) {
        let resolver = markdown_links::Resolver {
            tree: session.state.tree.clone(),
            config: &session.state.config,
            catalogue: &session.state.catalogue,
            entry,
            route,
            policy: session.state.policy.as_ref(),
        };
        rendering::markdown(&session.state.catalogue, entry, plan, &resolver)?
    } else {
        match session.state.composer.compose(&ComposeRequest {
            catalogue: &session.state.catalogue,
            entry,
            viewport: plan.viewport.unwrap_or(Viewport::Desktop),
            color_scheme: plan.color_scheme,
            stylesheets: plan.stylesheets.clone(),
        }) {
            Ok(composed) => composed,
            Err(source) => {
                return Err(GraphError::Html {
                    source: HtmlError::Route {
                        route: route.into(),
                        source: Box::new(source),
                    },
                });
            }
        }
    };
    if plan.viewport.is_some() {
        let parent = entry
            .metadata
            .variant_of
            .as_ref()
            .unwrap_or(&entry.metadata.path);
        let hrefs = styles::links(&styles::LinkInput {
            matchers: &session.state.matchers,
            config: &session.state.config,
            path: &entry.metadata.path,
            route,
            scheme: plan.color_scheme,
            components: &composed.components,
            inputs: &session.state.inputs,
            resources: &session.state.resources,
            module: session
                .state
                .inputs
                .entry_modules
                .get(parent)
                .map_or(entry.metadata.source.path.as_str(), String::as_str),
        })?;
        styles::install(&mut composed.tree, &hrefs);
    }
    rendering::finish(composed, plan, entry, &session.state.catalogue)
}
