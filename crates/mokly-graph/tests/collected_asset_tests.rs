//! Collected CSS and rule attribution resolve asset tokens in each final document.

use std::fs;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_css::compiler::Compiler;
use mokly_css::resolver::SourceResolver;
use mokly_css::types::{IdentityProcessor, OpaqueAsset};
use mokly_graph::cache::MemoryCache;
use mokly_graph::delivery_inputs::{DeliveryInputs, ImportedAsset};
use mokly_graph::graph::Graph;
use mokly_graph::types::RenderGraph;
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::{Fragment, FragmentRendererMock, OwnedStyle, StyleAttribution};
use mokly_html::tree::{self, Node};
use mokly_model::material::digest;
use mokly_source_interface::tree::SourceTree;
use tempfile::TempDir;
use unimock::{MockFn, Unimock, matching};

#[path = "support/definitions.rs"]
mod definitions;

#[test]
fn collected_styles_rewrite_text_and_attribution_at_each_document_depth_and_reach_the_asset() {
    let directory = TempDir::new().unwrap();
    let root = directory.path();
    fs::create_dir_all(root.join("specs/nested")).unwrap();
    fs::create_dir(root.join("media")).unwrap();
    fs::write(root.join("mokly.config.json"), "{}").unwrap();
    fs::write(root.join("media/logo.png"), [0, 255, 10, 128]).unwrap();
    for name in ["home", "nested/home"] {
        fs::write(
            root.join(format!("specs/{name}.screen.html")),
            "---\ntitle: Collected assets\n---\n<ui-card></ui-card>",
        )
        .unwrap();
    }
    fs::write(
        root.join("specs/card.component.html"),
        "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<div class=card>Card</div>",
    )
    .unwrap();

    let background = ".card{background-image:url(mokly-asset:[media/logo.png]?size=2#background)}";
    let overlay = ".marker{mask-image:url(mokly-asset:[media/logo.png]#overlay)}";
    let fragment = Fragment {
        html: "<div class=card>Card</div>".into(),
        styles: vec![OwnedStyle {
            owners: vec!["card".into()],
            css: format!("{background}\n{overlay}"),
            attribution: Some(vec![
                StyleAttribution {
                    css: background.into(),
                    owners: vec!["card".into()],
                },
                StyleAttribution {
                    css: overlay.into(),
                    owners: vec![],
                },
            ]),
        }],
        ..Default::default()
    };
    let renderer = Arc::new(Unimock::new(
        FragmentRendererMock::render
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(fragment.clone()))),
    ));
    let tree: Arc<dyn SourceTree> = Arc::new(WorkingTree);
    let config = Loader { tree: tree.clone() }.load(root, None).unwrap();
    let mut catalogue = Builder {
        tree: tree.clone(),
        discovery: Arc::new(Discoverer { tree: tree.clone() }),
        definitions: Arc::new(definitions::EmptyDefinitions),
    }
    .prepare(&config, None)
    .unwrap();
    catalogue.templates.remove("card");
    let graph = Graph {
        inputs: DeliveryInputs {
            imported_assets: vec![ImportedAsset {
                module: "specs/card.component.html".into(),
                asset: OpaqueAsset {
                    path: "media/logo.png".into(),
                    source: root.join("media/logo.png"),
                    digest: digest(&[0, 255, 10, 128]),
                    aliases: vec![],
                },
            }],
            ..Default::default()
        },
        tree: tree.clone(),
        composer: Arc::new(HtmlComposer {
            fragments: renderer,
        }),
        stylesheets: Arc::new(Compiler {
            tree: tree.clone(),
            repo_root: config.repo_root.clone(),
            resolver: Arc::new(SourceResolver {
                settings: Default::default(),
                tree,
                repo_root: config.repo_root.clone(),
            }),
            processor: Arc::new(IdentityProcessor),
        }),
        cache: Arc::new(MemoryCache::new(1024 * 1024, 0)),
        workers: Arc::new(ThreadWorkers::new(1).unwrap()),
        version: "fixture".into(),
    };
    let generation = graph.prepare(config, catalogue, None).unwrap();
    for (route, prefix) in [
        ("home/index.mobile.html", "../"),
        ("nested/home/index.mobile.html", "../../"),
    ] {
        let artifact = generation.comparison_document(route).unwrap();
        let styles: Vec<_> = tree::walk(&artifact.document.as_ref().unwrap().tree)
            .filter_map(|node| match node {
                Node::Element(element) if element.name == "style" => Some(element),
                _ => None,
            })
            .collect();
        assert_eq!(styles.len(), 1);
        let style = styles[0];
        let background = format!(
            ".card{{background-image:url({prefix}assets/media/logo.png?size=2#background)}}"
        );
        let overlay = format!(".marker{{mask-image:url({prefix}assets/media/logo.png#overlay)}}");
        let css: String = style
            .children
            .iter()
            .filter_map(|node| match node {
                Node::Text(text) => Some(text.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(css, format!("{background}\n{overlay}"));
        assert_eq!(
            style.style_attribution,
            Some(vec![
                StyleAttribution {
                    css: background,
                    owners: vec!["card".into()]
                },
                StyleAttribution {
                    css: overlay,
                    owners: vec![]
                },
            ])
        );
        assert_eq!(style.style_owners, Some(vec!["card".into()]));
        assert_eq!(style.get("data-mokly-owners"), Some("card"));
        let references: Vec<_> = generation
            .closure(route)
            .unwrap()
            .evidence
            .into_iter()
            .map(|reference| reference.path)
            .collect();
        assert_eq!(references, ["static/mokly-generated/assets/media/logo.png"]);
    }
}
