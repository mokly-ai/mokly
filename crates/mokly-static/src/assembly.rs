//! Assemble a complete static catalogue from the render graph's immutable bytes.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_compare::projection_index;
use mokly_graph::policy::{FilePolicy, PublicPolicy};
use mokly_graph::types::RenderGeneration;
use mokly_model::deployment::DeploymentFileV1;
use mokly_model::namespace;
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::projection::{self, Publication, ViewKey};
use mokly_model::{projection_usage, shell, versions};
use mokly_source_interface::tree::SourceTree;

use crate::changes::{ChangeState, PublicationInput};
use crate::error::{Error, InternalError, Result};
use crate::identity;
use crate::inspector;
use crate::inventory::Inventory;
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
        let model = &input.generation.catalogue().model;
        if model.entries.is_empty() {
            return Err(Error::Empty);
        }
        let mut keys = Vec::new();
        for plan in input.generation.plans().values() {
            let entry = &model.entries[plan.entry];
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
        let mut index =
            tracing::info_span!("index.build").in_scope(|| projection::index(model, &keys, &state));
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
            let document = rendered
                .document
                .as_ref()
                .expect("A rendered document plan retains its composed document");
            let entry = &model.entries[plan.entry];
            if let Some(detail) = details.get_mut(&entry.metadata.path)
                && let Some(view) = detail.views.iter_mut().find(|view| {
                    Some(view.viewport) == plan.viewport && view.color_scheme == plan.color_scheme
                })
            {
                view.usage = document.usage.clone();
            }
            inventory.insert(
                namespace::generated(&plan.route),
                inspector::inject(document, &plan.route)?.into(),
            )?;
        }
        for route in input.generation.resource_routes() {
            checkpoint(cancellation)?;
            let path = namespace::generated(&route);
            let bytes =
                resource_bytes::generated(input.generation, &route, &path)?.ok_or_else(|| {
                    Error::Invalid {
                        path: route.clone(),
                    }
                })?;
            inventory.insert(path, bytes.into())?;
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
            .map(|publication| publication.metadata(input.changes))
            .transpose()?;
        for file in identity::finalize(&mut index, &mut details, inventory.files()) {
            inventory.insert(file.path, file.bytes)?;
        }
        inventory.insert(
            namespace::viewer("deployment.json"),
            identity::json(&DeploymentFileV1 {
                schema_version: versions::DEPLOYMENT_FILE,
                deployment_id: index.deployment_id.clone(),
            })
            .into(),
        )?;
        match Artifact::finalize(input.directory, inventory.into_files(), metadata) {
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
