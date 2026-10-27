//! Shared mocks for the static assembly tests.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::discovery::Inventory;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::cache::Artifact;
use mokly_graph::key::NodeKey;
use mokly_graph::types::{DocumentPlan, RenderGenerationMock};
use mokly_html::{composition::Composed, parse};
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::{
    CatalogueModel, EntryContent, EntryMetadata, ModelEntry, SourceLocation,
};
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::usage::CatalogueUsage;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::assembly::{Assembly, CatalogueAssembler};
use crate::changes::ChangeState;

struct Disabled;

impl ChangeState for Disabled {
    fn status(&self) -> ChangesStatus {
        ChangesStatus::Disabled
    }

    fn base(&self) -> Option<&str> {
        None
    }

    fn ready(&self) -> Option<&mokly_compare::comparison_types::ComparisonResult> {
        None
    }
}

pub(crate) fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![],
    }
}

pub(crate) fn prepared() -> PreparedCatalogue {
    PreparedCatalogue {
        model: CatalogueModel {
            entries: vec![ModelEntry {
                metadata: EntryMetadata {
                    path: "home".into(),
                    title: "Home".into(),
                    description: String::new(),
                    tags: vec![],
                    rationale: None,
                    related_docs: vec![],
                    moved_from: None,
                    moved_from_source: None,
                    variant_of: None,
                    is_index: false,
                    source: SourceLocation {
                        path: "specs/home.page.html".into(),
                        line: 1,
                        column: 1,
                        export: None,
                    },
                    root_index: 0,
                },
                content: EntryContent::Page,
            }],
            sources: vec![],
            folders: vec![],
            color_schemes: vec![ColorScheme::Light],
        },
        inventory: Inventory::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        javascript: Default::default(),
        dependency_directories: Default::default(),
        deferred_modules: vec![],
        warnings: vec![],
    }
}

pub(crate) fn plan(entry: usize) -> BTreeMap<String, DocumentPlan> {
    BTreeMap::from([(
        "home/index.html".into(),
        DocumentPlan {
            route: "home/index.html".into(),
            key: NodeKey("a".repeat(64)),
            resource_key: "a".repeat(64),
            entry,
            viewport: None,
            color_scheme: ColorScheme::Light,
            stylesheets: vec![],
        },
    )])
}

pub(crate) fn request<'a>(
    config: &'a ResolvedConfig,
    generation: &'a dyn mokly_graph::types::RenderGeneration,
) -> Assembly<'a> {
    Assembly {
        config,
        generation,
        config_path: "mokly.config.json".into(),
        directory: "/repo/site".into(),
        viewer: vec![],
        changes: &Disabled,
        publication: None,
    }
}

pub(crate) fn graph_with_key(key: &str) -> Unimock {
    let mut plans = plan(0);
    plans.get_mut("home/index.html").unwrap().key = NodeKey(key.into());
    Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(prepared()),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
        RenderGenerationMock::render
            .next_call(matching!("home/index.html"))
            .returns(Ok(Arc::new(Artifact {
                bytes: vec![],
                document: Some(Composed {
                    tree: parse::document("<h1>Home</h1>"),
                    usage: CatalogueUsage::Ready {
                        instances: vec![],
                        slots: vec![],
                        ranges: vec![],
                    },
                    warnings: vec![],
                    resources: vec![],
                    components: vec![],
                    links: vec![],
                }),
                fragment: None,
                content_type: "text/html".into(),
            }))),
        RenderGenerationMock::resource_routes
            .next_call(matching!())
            .returns(Vec::<String>::new()),
        RenderGenerationMock::public_files
            .next_call(matching!())
            .returns(BTreeSet::<String>::new()),
    ))
}

pub(crate) fn source_tree() -> Unimock {
    Unimock::new(
        SourceTreeMock::project
            .next_call(matching!((path) if *path == Path::new("/repo/site")))
            .returns(Ok(None)),
    )
}

pub(crate) fn assembler() -> CatalogueAssembler {
    CatalogueAssembler {
        tree: Arc::new(source_tree()),
    }
}

pub(crate) fn empty_assembler() -> CatalogueAssembler {
    CatalogueAssembler {
        tree: Arc::new(Unimock::new(())),
    }
}
