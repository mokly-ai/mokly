//! Navigation ownership is safe even before public JSON validation.

use std::thread;

use crate::public_index::CatalogueNode;

#[test]
fn deep_navigation_clones_formats_and_drops_on_an_ordinary_thread() {
    thread::spawn(|| {
        let mut node = CatalogueNode::Entry {
            path: "leaf".into(),
            hidden: None,
            order: None,
            children: None,
        };
        for _ in 0..100_000 {
            node = CatalogueNode::Folder {
                path: "folder".into(),
                title: "Folder".into(),
                index: None,
                hidden: None,
                order: None,
                children: vec![node],
            };
        }
        let copy = node.clone();
        let debug = format!("{copy:?}");
        assert_eq!(debug.matches("Folder { ").count(), 100_000);
        assert!(debug.contains("Entry { path: \"leaf\""));
        drop(node);
        drop(copy);
    })
    .join()
    .unwrap();
}
