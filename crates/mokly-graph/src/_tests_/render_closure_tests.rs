use std::collections::{BTreeMap, BTreeSet};

use super::{chain, closure, handle_module};

fn graph(edges: &[(&str, &[&str])]) -> BTreeMap<String, Vec<String>> {
    edges
        .iter()
        .map(|(path, imports)| {
            (
                (*path).to_owned(),
                imports.iter().map(|import| (*import).to_owned()).collect(),
            )
        })
        .collect()
}

#[test]
fn closure_follows_imports_through_other_modules_and_survives_cycles() {
    let modules = graph(&[
        ("a.ts", &["b.ts"]),
        ("b.ts", &["c.ts", "a.ts"]),
        ("c.ts", &[]),
        ("d.ts", &["a.ts"]),
    ]);
    let found = closure(&modules, ["a.ts".to_owned()]);
    let expected: BTreeSet<_> = ["a.ts", "b.ts", "c.ts"]
        .into_iter()
        .map(str::to_owned)
        .collect();
    assert_eq!(found, expected);
}

#[test]
fn chains_stop_at_the_source_root_and_at_each_dependency_root() {
    assert_eq!(
        chain("specs/s/s.tsx"),
        [
            "specs/s/package.json",
            "specs/s/tsconfig.json",
            "specs/package.json",
            "specs/tsconfig.json",
            "package.json",
            "tsconfig.json",
        ]
    );
    assert_eq!(chain("root.ts"), ["package.json", "tsconfig.json"]);
    assert_eq!(
        chain("node_modules/pkg/lib/index.js"),
        [
            "node_modules/pkg/lib/package.json",
            "node_modules/pkg/lib/tsconfig.json",
            "node_modules/pkg/package.json",
            "node_modules/pkg/tsconfig.json",
            "node_modules/package.json",
            "node_modules/tsconfig.json",
        ]
    );
    assert_eq!(
        chain("node_modules/.mokly-roots/1/pkg/index.js"),
        [
            "node_modules/.mokly-roots/1/pkg/package.json",
            "node_modules/.mokly-roots/1/pkg/tsconfig.json",
            "node_modules/.mokly-roots/1/package.json",
            "node_modules/.mokly-roots/1/tsconfig.json",
        ]
    );
}

#[test]
fn a_handle_names_the_longest_known_module_before_a_hash() {
    let modules = graph(&[("specs/a.tsx", &[]), ("specs/b#c.tsx", &[])]);
    assert_eq!(
        handle_module(&modules, "specs/a.tsx#Screen:slot:0:children"),
        Some("specs/a.tsx")
    );
    assert_eq!(
        handle_module(&modules, "specs/b#c.tsx#default"),
        Some("specs/b#c.tsx")
    );
    assert_eq!(handle_module(&modules, "other.tsx#default"), None);
}
