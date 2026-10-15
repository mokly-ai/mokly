//! Compose one immutable render generation from injected runtime boundaries.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::names::ModuleNames;
use mokly_css::paths;
use mokly_css::types::StylesheetBundler;
use mokly_html::composition::Composer;
use mokly_model::canonical::compare_utf16;
use mokly_model::catalogue::EntryContent;
use mokly_model::material::digest;
use mokly_source_interface::tree::SourceTree;
use serde_json::json;

use crate::cache::{Artifact, RenderCache};
use crate::delivery_inputs::DeliveryInputs;
use crate::error::{GraphError, Result};
use crate::key::{NodeKind, data_key, key};
use crate::policy::{FilePolicy, PublicPolicy};
use crate::route_inventory::RouteInventory;
use crate::session::Session;
use crate::types::{RenderGeneration, RenderGraph, ResourcePlan};
use crate::workers::RenderWorkers;
use crate::{config_key, error, markdown_assets, markdown_sources, planning, styles};

/// Render graph composition root, reused for working-tree and base-side generations.
pub struct Graph {
    /// Consumer graph and registered stylesheet metadata; empty for HTML-only catalogues.
    pub inputs: DeliveryInputs,
    /// Read-only source tree.
    pub tree: Arc<dyn SourceTree>,
    /// HTML and fragment composition service.
    pub composer: Arc<dyn Composer>,
    /// Stylesheet delivery with the matching source and PostCSS boundaries.
    pub stylesheets: Arc<dyn StylesheetBundler>,
    /// Process-memory cache shared across generations and comparison sides.
    pub cache: Arc<dyn RenderCache>,
    /// Dedicated parallel worker scheduler.
    pub workers: Arc<dyn RenderWorkers>,
    /// Current Mokly package version in every config node key.
    pub version: String,
}

impl RenderGraph for Graph {
    fn prepare(
        &self,
        config: ResolvedConfig,
        mut catalogue: PreparedCatalogue,
        output: Option<&Path>,
    ) -> Result<Arc<dyn RenderGeneration>> {
        let config_key = config_key::resolved(&config, &self.version)?;
        let markdown_assets = markdown_assets::collect(&config, &catalogue, self.tree.as_ref())?;
        for entry in &mut catalogue.model.entries {
            if let EntryContent::Document { resources, .. } = &mut entry.content {
                *resources = markdown_assets
                    .documents
                    .get(&entry.metadata.path)
                    .map_or_else(Vec::new, |paths| paths.iter().cloned().collect());
            }
        }
        catalogue.model.sources.extend(markdown_sources::collect(
            &config,
            &catalogue,
            self.tree.as_ref(),
        ));
        let original_sources: BTreeSet<_> = catalogue.model.sources.iter().cloned().collect();
        let mut names = RouteInventory::default();
        let mut module_names = ModuleNames::default();
        let mut resources: BTreeMap<String, ResourcePlan> = BTreeMap::new();
        let mut imported_by = BTreeMap::new();
        let roots = styles::roots(&config, &self.inputs);
        let configured: Vec<_> = styles::roots(&config, &DeliveryInputs::default())
            .into_keys()
            .collect();
        let private_before: BTreeSet<_> = catalogue
            .model
            .sources
            .iter()
            .filter(|path| !configured.contains(path))
            .cloned()
            .collect();
        let local_roots: Vec<_> = roots
            .values()
            .filter(|root| root.local_css)
            .map(|root| root.path.clone())
            .collect();
        for root in roots.into_values() {
            let bundle = match self.stylesheets.bundle(&root) {
                Ok(bundle) => bundle,
                Err(source) => return Err(GraphError::Css { source }),
            };
            if let Err(source) = module_names.register(&bundle.css_modules) {
                return Err(GraphError::Css { source });
            }
            names.insert(&bundle.route, false)?;
            let input_keys: Vec<_> = bundle
                .inputs
                .iter()
                .map(|(path, bytes)| format!("{path}:{}", digest(bytes)))
                .collect();
            let recipe = data_key(
                NodeKind::Stylesheet,
                json!({"path":root.path,"stylesheets":root.stylesheets,"excluded":root.excluded,"localCss":root.local_css}),
            )?;
            let mut inputs = vec![config_key.0.as_bytes(), recipe.0.as_bytes()];
            inputs.extend(input_keys.iter().map(|key| key.as_bytes()));
            let stylesheet_key = key(NodeKind::Stylesheet, &inputs);
            self.cache.insert(
                stylesheet_key.clone(),
                Arc::new(Artifact {
                    bytes: bundle.css.into_bytes(),
                    document: None,
                    fragment: None,
                    content_type: "text/css; charset=utf-8".into(),
                }),
            );
            resources.insert(
                bundle.route,
                ResourcePlan {
                    key: stylesheet_key,
                    content_type: "text/css; charset=utf-8".into(),
                    root: root.clone(),
                    asset: None,
                },
            );
            for (route, bytes) in bundle.assets {
                names.insert(&route, true)?;
                let asset_key = key(NodeKind::Stylesheet, &[route.as_bytes(), &bytes]);
                if resources
                    .get(&route)
                    .is_some_and(|previous| previous.key != asset_key)
                {
                    return Err(error::invalid(
                        &route,
                        format!(
                            "CSS asset bytes disagree at {route}; keep shared asset inputs stable during the build"
                        ),
                    ));
                }
                let content_type = paths::content_type(&route)
                    .unwrap_or("application/octet-stream")
                    .into();
                self.cache.insert(
                    asset_key.clone(),
                    Arc::new(Artifact {
                        bytes,
                        document: None,
                        fragment: None,
                        content_type,
                    }),
                );
                resources.insert(
                    route.clone(),
                    ResourcePlan {
                        key: asset_key,
                        content_type: paths::content_type(&route)
                            .unwrap_or("application/octet-stream")
                            .into(),
                        root: root.clone(),
                        asset: Some(route),
                    },
                );
            }
            catalogue
                .model
                .sources
                .extend(bundle.inputs.into_keys().filter(|path| {
                    !markdown_assets.files.contains(path) || original_sources.contains(path)
                }));
            imported_by.extend(bundle.imported_by);
        }
        catalogue
            .model
            .sources
            .sort_by(|left, right| compare_utf16(left, right));
        catalogue.model.sources.dedup();
        let plans = planning::documents(
            &config,
            &catalogue,
            self.tree.as_ref(),
            &config_key,
            &resources,
            &self.inputs,
        )?;
        for plan in plans.values() {
            names.insert(&plan.route, false)?;
        }
        let policy = FilePolicy::new(
            self.tree.clone(),
            &config,
            &catalogue.model.sources,
            imported_by,
            output,
        )?;
        for path in local_roots {
            if let Err(reason) = policy.stylesheet_input(&path, !private_before.contains(&path)) {
                return Err(error::invalid(
                    &path,
                    format!(
                        "stylesheet is not a public file: {path} ({})",
                        reason.reason()
                    ),
                ));
            }
        }
        let policy: Arc<dyn PublicPolicy> = Arc::new(policy);
        Ok(Arc::new(Session::new(
            config, catalogue, plans, resources, self, policy,
        )))
    }
}
