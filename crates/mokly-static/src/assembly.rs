//! Assemble a complete static catalogue from the render graph's immutable bytes.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_compare::projection_index;
use mokly_graph::policy::{FilePolicy, PublicPolicy};
use mokly_graph::types::RenderGeneration;
use mokly_model::namespace;
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::projection::{self, Publication, ViewKey};
use mokly_model::usage::CatalogueUsage;
use mokly_model::{detail_context, projection_usage, readers, shell};
use mokly_source_interface::tree::SourceTree;

use crate::changes::{ChangeState, PublicationInput};
use crate::error::{Error, InternalError, Result};
use crate::identity;
use crate::inspector;
use crate::inventory::Inventory;
use crate::modules;
use crate::transaction::Cancellation;
use crate::{comparison_details, comparison_output, resource_bytes};

/// Inputs pinned by the command; the comparison adapter supplies its complete generation.
pub struct Assembly<'a> {
    /// Configured source boundary.
    pub config: &'a ResolvedConfig,
    /// One complete validated generation.
    pub generation: &'a dyn RenderGeneration,
    /// Repository-relative configuration identity.
    pub config_path: String,
    /// Physical destination pinned by the transaction.
    pub directory: PathBuf,
    /// Exact built package inventory.
    pub viewer: Vec<File>,
    /// The exact comparison state retained by the command.
    pub changes: &'a dyn ChangeState,
    /// Publication identity, excluded from browser identity.
    pub publication: Option<PublicationInput>,
}

/// Non-pure output assembly boundary, consumed through dyn at the command root.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = AssemblerMock))]
pub trait Assembler: Send + Sync {
    /// Capture documents and closure without reading prior output.
    fn assemble(&self, input: Assembly<'_>, cancellation: &dyn Cancellation) -> Result<Artifact>;
}

/// Graph-driven writer. Source reads use the generation's captured source boundary.
pub struct CatalogueAssembler {
    /// Read-only confined source bytes, shared with preparation and rendering.
    pub tree: Arc<dyn SourceTree>,
}

impl Assembler for CatalogueAssembler {
    fn assemble(&self, input: Assembly<'_>, cancellation: &dyn Cancellation) -> Result<Artifact> {
        modules::validate(&input.viewer)?;
        let model = &input.generation.catalogue().model;
        if model.entries.is_empty() {
            return Err(Error::Empty);
        }
        let mut keys = Vec::new();
        for plan in input.generation.plans().values() {
            let entry = model
                .entries
                .get(plan.entry)
                .ok_or_else(|| Error::PlanEntry {
                    route: plan.route.clone(),
                    entry: plan.entry,
                })?;
            keys.push(ViewKey {
                path: entry.metadata.path.clone(),
                viewport: plan.viewport,
                color_scheme: plan.color_scheme,
                key: plan.key.0.clone(),
            });
        }
        let state = Publication {
            config_path: input.config_path.clone(),
            deployment_id: "0".repeat(64),
            revision: 0,
            changes_status: input.changes.status(),
            base: input.changes.base().map(str::to_owned),
            live_generation: None,
        };
        let mut index = match tracing::info_span!("index.build")
            .in_scope(|| projection::index(model, &keys, &state))
        {
            Ok(index) => index,
            Err(source) => return Err(InternalError::Model { source }.into()),
        };
        let mut details = projection::pending_details(model, &index, &keys);
        let mut inventory = Inventory::default();
        let stub = shell::html(&index.identity.title);
        for path in ["index.html", "404.html"] {
            inventory.insert(path.into(), stub.clone().into())?;
        }
        for entry in &model.entries {
            inventory.insert(
                format!("view/{}/index.html", entry.metadata.path),
                stub.clone().into(),
            )?;
        }
        for file in input.viewer {
            inventory.insert(file.path, file.bytes)?;
        }
        for plan in input.generation.plans().values() {
            checkpoint(cancellation)?;
            let rendered = match input.generation.render(&plan.route) {
                Ok(rendered) => rendered,
                Err(source) => {
                    return Err(Error::Render {
                        source: Box::new(source),
                    });
                }
            };
            let document = rendered.document.as_ref().ok_or_else(|| Error::Invalid {
                path: plan.route.clone(),
            })?;
            let entry = model
                .entries
                .get(plan.entry)
                .ok_or_else(|| Error::PlanEntry {
                    route: plan.route.clone(),
                    entry: plan.entry,
                })?;
            if let Some(detail) = details.get_mut(&entry.metadata.path)
                && let Some(view) = detail.views.iter_mut().find(|view| {
                    Some(view.viewport) == plan.viewport && view.color_scheme == plan.color_scheme
                })
            {
                if !matches!(document.usage, CatalogueUsage::Ready { .. }) {
                    return Err(Error::Invalid {
                        path: plan.route.clone(),
                    });
                }
                view.usage = document.usage.clone();
            }
            inventory.insert(
                namespace::generated(&plan.route),
                inspector::inject(document, &plan.route)?.into(),
            )?;
        }
        for route in input.generation.resource_routes() {
            checkpoint(cancellation)?;
            let bytes = resource_bytes::generated(input.generation, &route)?.ok_or_else(|| {
                Error::Invalid {
                    path: route.clone(),
                }
            })?;
            inventory.insert(namespace::generated(&route), bytes.into())?;
        }
        let policy: &dyn PublicPolicy = &match FilePolicy::new(
            self.tree.clone(),
            input.config,
            &model.sources,
            BTreeMap::new(),
            Some(&input.directory),
        ) {
            Ok(policy) => policy,
            Err(source) => {
                return Err(Error::Render {
                    source: Box::new(source),
                });
            }
        };
        for path in input.generation.public_files() {
            checkpoint(cancellation)?;
            let file = match policy.recheck(&path) {
                Ok(file) => file,
                Err(_) => return Err(Error::Invalid { path }),
            };
            let bytes = match self.tree.read(&file.absolute) {
                Ok(bytes) => bytes,
                Err(source) => return Err(InternalError::Source { source }.into()),
            };
            inventory.insert(format!("static/{path}"), bytes.into())?;
        }
        let references = details
            .iter()
            .map(|(path, detail)| (path.clone(), detail))
            .collect();
        for (path, workspace) in projection_usage::workspaces(&references, &index) {
            if let Some(detail) = details.get_mut(&path) {
                detail.workspace = Some(workspace);
            }
        }
        if let Some(changes) = input.changes.ready() {
            projection_index::apply(&mut index, changes);
            comparison_details::current(&mut details, changes)?;
            comparison_output::append(
                changes,
                &mut index,
                &mut inventory,
                &stub,
                &input.config_path,
                cancellation,
            )?;
        }
        let metadata = input
            .publication
            .as_ref()
            .map(|publication| publication.metadata(input.changes, index.comparison_url.as_deref()))
            .transpose()?;
        let mut files = inventory.into_files();
        files.extend(identity::finalize(&mut index, &mut details, &files)?);
        if let Err(source) = readers::index(&String::from_utf8_lossy(&identity::json(&index)?)) {
            return Err(InternalError::Index {
                path: namespace::viewer("index.json"),
                source,
            }
            .into());
        }
        for (path, detail) in &details {
            if detail_context::validate(detail, &index).is_err() {
                return Err(Error::Invalid {
                    path: namespace::viewer(&format!("entries/{path}.json")),
                });
            }
        }
        let mut final_inventory = Inventory::default();
        for file in files {
            final_inventory.insert(file.path, file.bytes)?;
        }
        match Artifact::finalize(input.directory, final_inventory.into_files(), metadata) {
            Ok(artifact) => Ok(artifact),
            Err(source) => Err(InternalError::Format { source }.into()),
        }
    }
}

fn checkpoint(cancellation: &dyn Cancellation) -> Result<()> {
    if cancellation.requested() {
        Err(Error::Cancelled)
    } else {
        Ok(())
    }
}
