//! Build coordination through mocked loaders and catalogue builders.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::diagnostic::{Code, Issue, Warning, WarningSubject};
use mokly_catalogue::discovery::Inventory;
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::preparation::{CatalogueBuilderMock, PreparedCatalogue};
use mokly_graph::types::{
    GraphFactory, GraphFactoryMock, RenderGeneration, RenderGenerationMock, RenderGraph,
    RenderGraphMock, RenderSummary,
};
use mokly_model::axes::{ColorScheme, EntryKind};
use mokly_model::catalogue::{
    CatalogueModel, EntryContent, EntryMetadata, ModelEntry, SourceLocation, VisualEntry,
};
use mokly_model::data::Props;
use mokly_model::inference::infer;
use unimock::{MockFn, Unimock, matching};

use crate::build::{BuildError, BuildService, CatalogueBuild};
use crate::grammar::{Build, Common};

fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    }
}

fn options() -> Build {
    Build {
        common: Common::default(),
        out: None,
        strict: false,
        no_changes: true,
    }
}

fn prepared(warnings: Vec<Warning>) -> PreparedCatalogue {
    let entries = ["home", "home/one"]
        .into_iter()
        .map(|path| ModelEntry {
            metadata: EntryMetadata {
                path: path.into(),
                title: "Home".into(),
                description: String::new(),
                tags: Vec::new(),
                rationale: None,
                related_docs: Vec::new(),
                moved_from: None,
                moved_from_source: None,
                variant_of: (path != "home").then(|| "home".into()),
                is_index: false,
                root_index: 0,
                source: SourceLocation {
                    path: "specs/home.screen.html".into(),
                    line: 1,
                    column: 1,
                    export: None,
                },
            },
            content: EntryContent::Screen {
                visual: VisualEntry {
                    color_schemes: vec![ColorScheme::Light],
                    prop_schema: infer(&Props::new(), &[]),
                    props: Props::new(),
                    controls: BTreeMap::new(),
                },
                address: None,
                use_case_paths: Vec::new(),
            },
        })
        .collect();
    PreparedCatalogue {
        model: CatalogueModel {
            entries,
            folders: Vec::new(),
            sources: Vec::new(),
            color_schemes: vec![ColorScheme::Light],
        },
        inventory: Inventory::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        deferred_modules: Vec::new(),
        warnings,
    }
}

fn graphs(warnings: Vec<Warning>) -> Arc<dyn GraphFactory> {
    let generation: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(
        RenderGenerationMock::render_all
            .next_call(matching!())
            .returns(Ok(RenderSummary {
                documents: 4,
                warnings,
                ..Default::default()
            })),
    ));
    let graph: Arc<dyn RenderGraph> = Arc::new(Unimock::new(
        RenderGraphMock::prepare
            .next_call(matching!((config, catalogue, output) if config.file == Path::new("/repo/mokly.config.json") && catalogue.model.entries.len() == 2 && output.is_some()))
            .returns(Ok(generation)),
    ));
    Arc::new(Unimock::new(
        GraphFactoryMock::create
            .next_call(matching!((config) if config.file == Path::new("/repo/mokly.config.json")))
            .returns(Ok(graph)),
    ))
}

#[test]
fn build_passes_the_default_output_and_counts_validated_variants() {
    let loader = Arc::new(Unimock::new(
        ConfigLoaderMock::load
            .next_call(
                matching!((cwd, explicit) if *cwd == Path::new("/repo") && explicit.is_none()),
            )
            .returns(Ok(config())),
    ));
    let builder = Arc::new(Unimock::new(CatalogueBuilderMock::prepare
        .next_call(matching!((config, output) if config.file == Path::new("/repo/mokly.config.json") && *output == Some(Path::new("/repo/mokly-static"))))
        .returns(Ok(prepared(Vec::new())))));
    let service: &dyn BuildService = &CatalogueBuild {
        config: loader,
        catalogue: builder,
        graphs: graphs(Vec::new()),
    };
    let summary = service.run(Path::new("/repo"), &options()).unwrap();
    assert_eq!(summary.counts, BTreeMap::from([(EntryKind::Screen, 2)]));
    assert_eq!(summary.documents, 4);
    assert!(summary.deferred_modules.is_empty());
    assert!(summary.warnings.is_empty());
}

#[test]
fn strict_build_keeps_warnings_and_resolves_explicit_output_from_cwd() {
    let warning = Warning {
        code: "html-unused-props",
        subject: WarningSubject::Entry("home".into()),
        message: "prop \"label\" is not read by the body".into(),
    };
    let loader = Arc::new(Unimock::new(
        ConfigLoaderMock::load
            .next_call(matching!(_, _))
            .returns(Ok(config())),
    ));
    let builder = Arc::new(Unimock::new(
        CatalogueBuilderMock::prepare
            .next_call(matching!((_, output) if *output == Some(Path::new("/repo/nested/preview"))))
            .returns(Ok(prepared(vec![warning.clone()]))),
    ));
    let service: &dyn BuildService = &CatalogueBuild {
        config: loader,
        catalogue: builder,
        graphs: graphs(vec![warning.clone()]),
    };
    let mut options = options();
    options.out = Some("preview".into());
    options.strict = true;
    let BuildError::Strict { warnings } = service
        .run(Path::new("/repo/nested"), &options)
        .unwrap_err()
    else {
        panic!()
    };
    assert_eq!(warnings, [warning]);
}

#[test]
fn a_loader_failure_preserves_the_typed_error_without_preparing_a_catalogue() {
    let loader = Arc::new(Unimock::new(
        ConfigLoaderMock::load
            .next_call(matching!(_, _))
            .returns(Err(CatalogueError::Config(Issue::new(
                Code::ConfigInvalid,
                "bad root",
            )))),
    ));
    let service: &dyn BuildService = &CatalogueBuild {
        config: loader,
        catalogue: Arc::new(Unimock::new(())),
        graphs: Arc::new(Unimock::new(())),
    };
    let BuildError::Catalogue {
        source: CatalogueError::Config(issue),
    } = service.run(Path::new("/repo"), &options()).unwrap_err()
    else {
        panic!()
    };
    assert_eq!(issue.code, Code::ConfigInvalid);
    assert_eq!(issue.message, "bad root");
}

#[test]
fn deferred_definitions_fail_before_graph_creation() {
    let loader = Arc::new(Unimock::new(
        ConfigLoaderMock::load
            .next_call(matching!(_, _))
            .returns(Ok(config())),
    ));
    let mut prepared = prepared(Vec::new());
    prepared.deferred_modules = vec!["specs/later.mockup.tsx".into()];
    let builder = Arc::new(Unimock::new(
        CatalogueBuilderMock::prepare
            .next_call(matching!(_, _))
            .returns(Ok(prepared)),
    ));
    let service: &dyn BuildService = &CatalogueBuild {
        config: loader,
        catalogue: builder,
        graphs: Arc::new(Unimock::new(())),
    };
    let BuildError::Deferred { modules, warnings } =
        service.run(Path::new("/repo"), &options()).unwrap_err()
    else {
        panic!()
    };
    assert_eq!(modules, ["specs/later.mockup.tsx"]);
    assert!(warnings.is_empty());
}
