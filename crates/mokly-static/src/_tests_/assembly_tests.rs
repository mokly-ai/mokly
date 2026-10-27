//! Assembly consumes only the injected generation, source closure, and package inventory.

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
use mokly_model::output::ownership::Ownership;
use mokly_model::readers;
use mokly_model::usage::CatalogueUsage;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::assembly::{Assembler, Assembly, CatalogueAssembler};
use crate::changes::ChangeState;
use crate::error::Error;
use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::public_metadata::ChangesStatus;

struct Disabled;
impl ChangeState for Disabled {
    fn status(&self) -> ChangesStatus {
        ChangesStatus::Disabled
    }
    fn base(&self) -> Option<&str> {
        None
    }
    fn ready(&self) -> Option<&ComparisonResult> {
        None
    }
}
use crate::transaction::CancellationMock;

fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![],
    }
}
fn prepared() -> PreparedCatalogue {
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
fn plan(entry: usize) -> BTreeMap<String, DocumentPlan> {
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
fn request<'a>(
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

fn graph_with_key(key: &str) -> Unimock {
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

fn source_tree() -> Unimock {
    Unimock::new(
        SourceTreeMock::project
            .next_call(matching!((path) if *path == Path::new("/repo/site")))
            .returns(Ok(None)),
    )
}

#[test]
fn builds_complete_current_bytes_from_a_mocked_generation_without_disk_access() {
    let graph = graph_with_key(&"a".repeat(64));
    let assembler: &dyn Assembler = &CatalogueAssembler {
        tree: Arc::new(source_tree()),
    };
    let cancellation = Unimock::new(
        CancellationMock::requested
            .each_call(matching!())
            .returns(false),
    );
    let output = assembler
        .assemble(request(&config(), &graph), &cancellation)
        .unwrap();
    assert_eq!(output.directory, Path::new("/repo/site"));
    let files: BTreeMap<_, _> = output
        .files
        .iter()
        .map(|file| (file.path.as_str(), file.bytes.as_ref()))
        .collect();
    assert_eq!(files["index.html"], files["view/home/index.html"]);
    assert_eq!(files["404.html"], files["index.html"]);
    let index =
        readers::index(std::str::from_utf8(files["mokly-viewer/index.json"]).unwrap()).unwrap();
    let detail =
        readers::detail(std::str::from_utf8(files["mokly-viewer/entries/home.json"]).unwrap())
            .unwrap();
    let deployment =
        readers::deployment(std::str::from_utf8(files["mokly-viewer/deployment.json"]).unwrap())
            .unwrap();
    assert_eq!(detail.deployment_id.as_ref(), Some(&index.deployment_id));
    assert_eq!(deployment.deployment_id, index.deployment_id);
    assert_eq!(deployment.schema_version, 1);
    assert_eq!(
        std::str::from_utf8(files["mokly-viewer/deployment.json"]).unwrap(),
        format!(
            "{{\n  \"deploymentId\": \"{}\",\n  \"schemaVersion\": 1\n}}\n",
            index.deployment_id
        )
    );
    assert_eq!(index.revision, 0);
    let ownership = Ownership::parse(files[".mokly-export-artifact"]).unwrap();
    assert!(
        ownership
            .files
            .iter()
            .any(|entry| entry.path == "mokly-viewer/deployment.json")
    );
    assert_eq!(ownership.files.len() + 1, files.len());
}

#[test]
fn rejects_empty_and_inconsistent_generations_without_panics_or_side_effects() {
    for empty in [true, false] {
        let mut catalogue = prepared();
        if empty {
            catalogue.model.entries.clear();
        }
        let graph = if empty {
            Unimock::new(
                RenderGenerationMock::catalogue
                    .each_call(matching!())
                    .returns(catalogue),
            )
        } else {
            Unimock::new((
                RenderGenerationMock::catalogue
                    .each_call(matching!())
                    .returns(catalogue),
                RenderGenerationMock::plans
                    .each_call(matching!())
                    .returns(plan(9)),
            ))
        };
        let assembler: &dyn Assembler = &CatalogueAssembler {
            tree: Arc::new(Unimock::new(())),
        };
        let error = assembler
            .assemble(request(&config(), &graph), &Unimock::new(()))
            .unwrap_err();
        assert!(if empty {
            matches!(error, Error::Empty)
        } else {
            matches!(error, Error::PlanEntry { entry: 9, .. })
        });
    }
}

#[test]
fn malformed_published_index_preserves_the_reader_diagnostic() {
    let graph = graph_with_key("bad");
    let assembler: &dyn Assembler = &CatalogueAssembler {
        tree: Arc::new(source_tree()),
    };
    let cancellation = Unimock::new(
        CancellationMock::requested
            .each_call(matching!())
            .returns(false),
    );
    let error = assembler
        .assemble(request(&config(), &graph), &cancellation)
        .unwrap_err();
    assert!(
        error.to_string().contains("invalid page document key"),
        "{error}"
    );
    assert!(
        error.to_string().contains("mokly-viewer/index.json"),
        "{error}"
    );
}
