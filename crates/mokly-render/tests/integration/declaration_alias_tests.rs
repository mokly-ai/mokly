//! Duplicate physical declarations report the first authored stylesheet spelling.

use std::fs;
use std::sync::Arc;

use mokly_catalogue::working_tree::WorkingTree;
use mokly_graph::types::GraphFactory;
use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use super::support::Consumer;

#[test]
fn duplicate_stylesheet_warnings_name_the_first_authored_path() {
    let consumer = Consumer::new();
    fs::write(consumer.root().join("first.css"), "button {color:red}").unwrap();
    consumer.replace(
        "library/chip.tsx",
        "relatedDocs: [],",
        "relatedDocs: [], stylesheets: ['first.css', 'alias.css'],",
    );
    let prepared = consumer.prepare().unwrap();
    let mut runtime = consumer.runtime.as_ref().clone();
    runtime.tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                WorkingTree.project(
                    &if path.file_name().is_some_and(|name| name == "alias.css") {
                        path.with_file_name("first.css")
                    } else {
                        path.to_owned()
                    },
                )
            }),
        SourceTreeMock::read_shared
            .each_call(matching!(_))
            .answers(&|_, path| WorkingTree.read_shared(path)),
    )));
    let factory: &dyn GraphFactory = &runtime;
    let generation = factory
        .create(&consumer.config())
        .unwrap()
        .prepare(consumer.config(), prepared, None)
        .unwrap();
    let warnings: Vec<_> = generation
        .catalogue()
        .warnings
        .iter()
        .filter(|warning| warning.code == "duplicate-component-stylesheet")
        .collect();
    assert_eq!(warnings.len(), 1);
    assert_eq!(
        warnings[0].message,
        "duplicate component stylesheet \"first.css\" is ignored; it is linked once."
    );
}
