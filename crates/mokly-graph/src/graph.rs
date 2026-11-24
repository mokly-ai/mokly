//! Compose one immutable render generation from injected runtime boundaries.

use std::collections::{BTreeMap, BTreeSet};
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::names::ModuleNames;
use mokly_css::types::StylesheetBundler;
use mokly_html::composition::Composer;
use mokly_model::canonical::compare_utf16;
use mokly_model::catalogue::EntryContent;
use mokly_source_interface::tree::SourceTree;

use crate::cache::{Artifact, RenderCache};
use crate::delivery_inputs::DeliveryInputs;
use crate::error::Result;
use crate::key::{NodeKind, key};
use crate::policy::{FilePolicy, PublicPolicy};
use crate::route_inventory::RouteInventory;
use crate::session::{Session, SessionInput};
use crate::types::{RenderGeneration, RenderGraph, ResourcePlan};
use crate::workers::{RenderWorkers, check_cancelled};
use crate::{
    config_key, dependency_inputs, error, imported_assets, markdown_assets, markdown_sources,
    planning, styles, stylesheet_keys, watch_rules,
};

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
    #[tracing::instrument(name = "graph.prepare", skip_all, err)]
    fn prepare(
        &self,
        config: ResolvedConfig,
        catalogue: PreparedCatalogue,
        output: Option<&Path>,
    ) -> Result<Arc<dyn RenderGeneration>> {
        match catch_unwind(AssertUnwindSafe(|| {
            self.prepare_generation(config, catalogue, output)
        })) {
            Ok(result) => result,
            Err(_) => Err(error::InternalError::PreparationPanicked.into()),
        }
    }
}

impl Graph {
    fn prepare_generation(
        &self,
        config: ResolvedConfig,
        mut catalogue: PreparedCatalogue,
        output: Option<&Path>,
    ) -> Result<Arc<dyn RenderGeneration>> {
        let config_key = config_key::resolved(&config, &self.version);
        let matchers = styles::Matchers::new(&config)?;
        let markdown_assets = markdown_assets::collect(&config, &catalogue, self.tree.as_ref())?;
        for entry in &mut catalogue.model.entries {
            check_cancelled(self.workers.as_ref())?;
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
        catalogue.dependency_directories.clear();
        if let Some(generation) = &catalogue.javascript.generation {
            catalogue
                .dependency_directories
                .extend(generation.modules.keys().filter_map(|path| {
                    dependency_inputs::directory(path, &self.inputs.dependency_aliases)
                }));
        }
        let mut names = RouteInventory::default();
        let mut module_names = ModuleNames::default();
        let mut resources: BTreeMap<String, ResourcePlan> = BTreeMap::new();
        let mut imported_by = BTreeMap::new();
        let mut plugin_inputs = BTreeMap::new();
        let mut directories = BTreeSet::new();
        let mut stylesheet_resolution_files = BTreeSet::new();
        let mut stylesheet_resolution_roots = BTreeMap::new();
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
        let roots: Vec<_> = roots.into_values().collect();
        let bundles = self.workers.stylesheets(&roots, self)?;
        for (root, bundle) in roots.into_iter().zip(bundles) {
            stylesheet_resolution_files.extend(bundle.resolution_files.iter().cloned());
            stylesheet_resolution_roots.extend(
                bundle
                    .resolution_roots
                    .iter()
                    .map(|(path, root)| (path.clone(), root.clone())),
            );
            styles::register_modules(&config, &mut module_names, &bundle)?;
            names.insert(&bundle.route, false)?;
            let stylesheet_key = stylesheet_keys::input(&config_key, &root, &bundle);
            let document_key = stylesheet_keys::output(&bundle);
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
                    document_key,
                    content_type: "text/css; charset=utf-8".into(),
                    root: root.clone(),
                    asset: None,
                },
            );
            let asset_inputs: Vec<_> = bundle
                .assets
                .values()
                .flat_map(|asset| asset.input_paths().cloned())
                .collect();
            catalogue.dependency_directories.extend(
                bundle
                    .inputs
                    .keys()
                    .chain(bundle.dependency_digests.keys())
                    .chain(asset_inputs.iter())
                    .filter(|path| !bundle.repository_aliases.contains(*path))
                    .filter_map(|path| {
                        dependency_inputs::directory(path, &self.inputs.dependency_aliases)
                    }),
            );
            for (route, asset) in bundle.assets {
                imported_assets::register(route, asset, &root, &mut names, &mut resources)?;
            }
            catalogue.model.sources.extend(
                bundle
                    .inputs
                    .into_keys()
                    .chain(asset_inputs)
                    .chain(bundle.dependency_digests.keys().cloned())
                    .filter(|path| {
                        let reported = bundle.plugin_inputs.contains_key(path);
                        let vite_dependency =
                            config.vite() && bundle.dependency_digests.contains_key(path);
                        let protected = reported || bundle.imported_by.contains_key(path);
                        (!vite_dependency || protected)
                            && (!path.split('/').any(|part| part == "node_modules")
                                || bundle.repository_aliases.contains(path)
                                || reported)
                            && (!markdown_assets.files.contains(path)
                                || original_sources.contains(path)
                                || (vite_dependency && protected))
                    }),
            );
            imported_by.extend(bundle.imported_by);
            plugin_inputs.extend(bundle.plugin_inputs);
            directories.extend(bundle.directories);
        }
        imported_assets::register_imports(
            &self.inputs.imported_assets,
            &self.inputs.dependency_aliases,
            &mut catalogue,
            &mut names,
            &mut resources,
            &mut imported_by,
        )?;
        catalogue
            .model
            .sources
            .sort_by(|left, right| compare_utf16(left, right));
        catalogue.model.sources.dedup();
        let (rebuild, reload) =
            watch_rules::inputs(&config, self.tree.as_ref(), &catalogue.model.sources)?;
        let config_key = if rebuild.is_empty() {
            config_key
        } else {
            key(
                NodeKind::Config,
                &[config_key.0.as_bytes(), rebuild.as_bytes()],
            )
        };
        let plans = planning::documents(
            self,
            &config,
            &catalogue,
            &config_key,
            &resources,
            &matchers,
            &reload,
        )?;
        for plan in plans.values() {
            names.insert(&plan.route, false)?;
        }
        let mut policy = FilePolicy::new(
            self.tree.clone(),
            &config,
            &catalogue.model.sources,
            imported_by,
            output,
        )?;
        policy.plugin_inputs = plugin_inputs;
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
        let mut generation_inputs = vec![config_key.0.as_bytes()];
        for plan in plans.values() {
            generation_inputs.push(plan.key.0.as_bytes());
        }
        for resource in resources.values() {
            generation_inputs.push(resource.document_key.0.as_bytes());
        }
        if let Some(keys) = &self.inputs.render_keys {
            generation_inputs.push(keys.fallback().0.as_bytes());
        }
        let generation_key = key(NodeKind::Document, &generation_inputs).0;
        Ok(Arc::new(Session::new(
            self,
            SessionInput {
                config,
                catalogue,
                plans,
                resources,
                policy,
                generation_key,
                matchers,
                directories: directories.into_iter().collect(),
                stylesheet_resolution_files,
                stylesheet_resolution_roots,
            },
        )))
    }
}
