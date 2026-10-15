//! Assemble a complete static catalogue from the render graph's immutable bytes.
//!
//! TODO(M12/M9): apply the comparison engine's completed index, detail evidence,
//! removed records, and generation files before deployment identity finalization.
//! The Assembler boundary receives the exact current render generation for that join.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_graph::policy::{FilePolicy, PublicPolicy};
use mokly_graph::types::RenderGeneration;
use mokly_model::namespace;
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::upload::UploadMetadata;
use mokly_model::projection::{self, Publication, ViewKey};
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::usage::CatalogueUsage;
use mokly_model::{detail_context, projection_usage, readers, shell};
use mokly_source_interface::tree::SourceTree;

use crate::error::{Error, InternalError, Result};
use crate::identity;
use crate::inspector;
use crate::inventory::Inventory;
use crate::transaction::Cancellation;

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
    /// Selected base; omitted only for --no-changes.
    pub base: Option<String>,
    /// Publication envelope, excluded from browser identity.
    pub metadata: Option<UploadMetadata>,
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
        crate::modules::validate(&input.viewer)?;
        let model = &input.generation.catalogue().model;
        if model.entries.is_empty() {
            return Err(Error::Empty);
        }
        let keys: Vec<_> = input
            .generation
            .plans()
            .values()
            .map(|plan| ViewKey {
                path: model.entries[plan.entry].metadata.path.clone(),
                viewport: plan.viewport,
                color_scheme: plan.color_scheme,
                key: plan.key.0.clone(),
            })
            .collect();
        let state = Publication {
            config_path: input.config_path,
            deployment_id: "0".repeat(64),
            revision: 0,
            changes_status: if input.base.is_some() {
                ChangesStatus::Unavailable
            } else {
                ChangesStatus::Disabled
            },
            base: input.base,
            live_generation: None,
        };
        let mut index = match projection::index(model, &keys, &state) {
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
            if let Some(detail) = details.get_mut(&model.entries[plan.entry].metadata.path)
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
                inspector::inject(document)?.into(),
            )?;
        }
        for route in input.generation.resource_routes() {
            checkpoint(cancellation)?;
            let bytes = match input.generation.resource(&route) {
                Ok(Some(bytes)) => bytes,
                Ok(None) => return Err(Error::Invalid { path: route }),
                Err(source) => {
                    return Err(Error::Render {
                        source: Box::new(source),
                    });
                }
            };
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
        let mut files = inventory.into_files();
        files.extend(identity::finalize(&mut index, &mut details, &files)?);
        if readers::index(&String::from_utf8_lossy(&identity::json(&index)?)).is_err() {
            return Err(Error::Invalid {
                path: namespace::viewer("index.json"),
            });
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
        match Artifact::finalize(
            input.directory,
            final_inventory.into_files(),
            input.metadata,
        ) {
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
