//! Public resource bytes bypass the private source snapshot's retained read set.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::Inventory;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::CatalogueModel;
use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::planning_resources::Resources;
use crate::source_snapshot::SourceSnapshot;

#[test]
fn private_sources_are_pinned_but_public_resource_reads_are_not_retained() {
    let source = Unimock::new((
        SourceTreeMock::read
            .next_call(matching!(_))
            .returns(Ok(vec![1])),
        SourceTreeMock::read_public
            .next_call(matching!(_))
            .returns(Ok(vec![2])),
        SourceTreeMock::read_public
            .next_call(matching!(_))
            .returns(Ok(vec![3])),
    ));
    let snapshot: &dyn SourceTree = &SourceSnapshot::new(Arc::new(source));
    let path = Path::new("/repo/file");
    assert_eq!(snapshot.read(path).unwrap(), [1]);
    assert_eq!(snapshot.read(path).unwrap(), [1]);
    assert_eq!(snapshot.read_public(path).unwrap(), [2]);
    assert_eq!(snapshot.read_public(path).unwrap(), [3]);
}

#[test]
fn planning_reuses_digests_without_pinning_resource_bytes() {
    let tree = SourceSnapshot::new(Arc::new(Unimock::new((
        SourceTreeMock::prefetch
            .next_call(matching!((paths) if paths.len() == 2))
            .returns(Ok(())),
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))
            }),
        SourceTreeMock::digest
            .next_call(matching!((path) if path.ends_with("movie.mp4")))
            .returns(Ok("movie-digest".into())),
        SourceTreeMock::read_public
            .next_call(matching!((path) if path.ends_with("style.css")))
            .returns(Ok(b"p{background:url(movie.mp4)}".to_vec())),
    ))));
    let entries = ["one", "two"].into_iter().map(|path| serde_json::from_value(json!({
        "metadata": {"path":path,"title":path,"description":"","tags":[],"relatedDocs":[],"isIndex":false,"rootIndex":0,"source":{"path":format!("specs/{path}.md"),"line":1,"column":1}},
        "content":{"kind":"document","colorSchemes":["light"],"resources":[]}
    })).unwrap()).collect();
    let catalogue = PreparedCatalogue {
        javascript: Default::default(),
        model: CatalogueModel {
            entries,
            folders: Vec::new(),
            sources: Vec::new(),
            color_schemes: vec![ColorScheme::Light],
        },
        inventory: Inventory::default(),
        templates: BTreeMap::new(),
        documents: ["one", "two"]
            .into_iter()
            .map(|path| {
                (
                    path.into(),
                    "[CSS](../style.css) [Video](../movie.mp4)".into(),
                )
            })
            .collect(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        deferred_modules: Vec::new(),
        warnings: Vec::new(),
    };
    let config = ResolvedConfig {
        input: Default::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    let resources = Resources::prepare(&config, &catalogue, &tree, &Unimock::new(())).unwrap();
    for entry in &catalogue.model.entries {
        let inputs = resources.inputs(
            &catalogue,
            entry,
            &format!("{}/index.html", entry.metadata.path),
            &BTreeSet::new(),
        );
        assert_eq!(inputs.len(), 2);
        assert_eq!(inputs["movie.mp4"], "movie-digest");
    }
    assert!(tree.reads.lock().unwrap().is_empty());
}
