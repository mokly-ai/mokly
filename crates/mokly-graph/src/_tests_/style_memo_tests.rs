//! The generations of one runtime share the style memo that their delivery inputs pass in.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::reference_cache::{MemoryReferenceCache, ReferenceCache};
use mokly_html::tree::{Node, element};
use mokly_model::catalogue::CatalogueModel;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::closure::ClosureBuilder;
use crate::delivery_inputs::DeliveryInputs;
use crate::graph::Graph;
use crate::policy::{PublicFile, PublicPolicyMock};
use crate::session::{Session, SessionInput};
use crate::styles::Matchers;

fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Default::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        modules: Default::default(),
        authored_inputs: vec![],
        roots: vec![],
    }
}

fn catalogue() -> PreparedCatalogue {
    PreparedCatalogue {
        model: CatalogueModel {
            entries: vec![],
            folders: vec![],
            sources: vec![],
            color_schemes: vec![],
        },
        inventory: Default::default(),
        templates: Default::default(),
        documents: Default::default(),
        slot_fragments: Default::default(),
        elements: Default::default(),
        prop_validators: Default::default(),
        javascript: Default::default(),
        dependency_directories: Default::default(),
        warnings: vec![],
    }
}

/// A document with one style attribute and one style element, each with a local image.
fn document() -> Vec<Node> {
    vec![
        element(
            "div",
            &[("style", "background:url(../images/a.png)")],
            vec![],
        ),
        element(
            "style",
            &[],
            vec![Node::Text(".b{background:url(../images/b.png)}".into())],
        ),
    ]
}

#[test]
fn two_generations_share_the_scans_of_equal_inline_styles() {
    let mock = Arc::new(Unimock::new((
        PublicPolicyMock::check
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(PublicFile {
                    path: path.into(),
                    absolute: format!("/repo/{path}").into(),
                })
            }),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers(&|_, _| Ok("digest".into())),
    )));
    let styles = Arc::new(MemoryReferenceCache::new(1024 * 1024));
    let graph = Graph {
        inputs: DeliveryInputs {
            style_references: styles.clone(),
            ..Default::default()
        },
        tree: mock.clone(),
        composer: mock.clone(),
        stylesheets: mock.clone(),
        cache: mock.clone(),
        workers: mock.clone(),
        version: "test".into(),
    };
    for generation in ["first", "second"] {
        let config = config();
        let session = Session::new(
            &graph,
            SessionInput {
                stylesheet_resolution_files: Default::default(),
                matchers: Matchers::new(&config).unwrap(),
                config,
                catalogue: catalogue(),
                plans: BTreeMap::new(),
                resources: BTreeMap::new(),
                policy: mock.clone(),
                generation_key: generation.into(),
                directories: vec![],
            },
        );
        let closure = session
            .preview_walker()
            .collect("home.html", &document(), &[])
            .unwrap();
        assert_eq!(
            closure.files,
            BTreeSet::from(["images/a.png".to_owned(), "images/b.png".to_owned()]),
            "{generation}"
        );
    }
    assert_eq!((styles.stats().scans, styles.stats().hits), (2, 2));
}
