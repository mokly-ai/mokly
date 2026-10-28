use std::collections::{BTreeMap, BTreeSet};

use mokly_catalogue::render_sources::{
    JavaScriptGeneration, RenderMethod, RenderSource, ResolvedDefinition,
};

use super::{RenderInputs, RenderKeys};
use crate::key::{NodeKey, NodeKind, key};

const S: &str = "specs/s/s.mockup.tsx";
const C: &str = "specs/c.mockup.tsx";
const P: &str = "specs/p.mockup.tsx";
const T: &str = "specs/t/t.mockup.tsx";
const U: &str = "specs/u/u.mockup.tsx";
const STORIES: &str = "specs/st.stories.tsx";

/// S imports helper H, component C, and link target T. C imports a CSS Module, the
/// saved slot provider P, and a dependency. U imports a plain stylesheet.
struct Fixture {
    generation: JavaScriptGeneration,
    bindings: BTreeMap<String, ResolvedDefinition>,
}

impl Fixture {
    fn new() -> Self {
        let edges: [(&str, &[&str]); 14] = [
            (S, &["specs/h.ts", C, T]),
            ("specs/h.ts", &[]),
            (C, &["specs/c.module.css", P, "node_modules/dep/index.js"]),
            ("specs/c.module.css", &[]),
            (P, &[]),
            (T, &[]),
            (U, &["specs/shared.css"]),
            ("specs/shared.css", &[]),
            (STORIES, &["specs/button.tsx"]),
            ("specs/button.tsx", &[]),
            (".storybook/preview.tsx", &[]),
            ("renderer.tsx", &["theme.ts"]),
            ("theme.ts", &[]),
            ("node_modules/dep/index.js", &[]),
        ];
        let generation = JavaScriptGeneration {
            id: "generation".into(),
            css_context: "head".into(),
            modules: edges
                .iter()
                .map(|(path, imports)| {
                    (
                        (*path).to_owned(),
                        imports.iter().map(|import| (*import).to_owned()).collect(),
                    )
                })
                .collect(),
            module_digests: edges
                .iter()
                .map(|(path, _)| ((*path).to_owned(), Some(format!("{path}@1"))))
                .collect(),
            environment: "environment@1".into(),
            resolution_digests: [
                ("package.json", "root@1"),
                ("node_modules/dep/package.json", "dep@1"),
                ("node_modules/react/package.json", "react@1"),
            ]
            .into_iter()
            .map(|(name, value)| (name.to_owned(), value.to_owned()))
            .collect(),
            class_map_digests: BTreeMap::from([("specs/c.module.css".into(), "map@1".into())]),
            ..JavaScriptGeneration::default()
        };
        let bindings = [S, C, P, T, U, STORIES]
            .into_iter()
            .map(|module| {
                let path = module
                    .split('.')
                    .next()
                    .unwrap()
                    .trim_start_matches("specs/");
                (
                    format!("{module}#default"),
                    ResolvedDefinition {
                        path: path.to_owned(),
                        title: path.to_uppercase(),
                    },
                )
            })
            .collect();
        Self {
            generation,
            bindings,
        }
    }

    fn keys(&self) -> RenderKeys {
        let entries = BTreeMap::from([(
            "st".to_owned(),
            RenderSource {
                handle: format!("{STORIES}#default"),
                method: RenderMethod::Story,
                ..RenderSource::default()
            },
        )]);
        RenderKeys::build(
            &RenderInputs {
                generation: &self.generation,
                bindings: &self.bindings,
                renderer: Some("renderer.tsx"),
                entries: &entries,
            },
            fallback(),
        )
        .unwrap()
    }

    fn digest(&mut self, path: &str) {
        self.generation
            .module_digests
            .insert(path.into(), Some(format!("{path}@2")));
    }

    fn resolution(&mut self, name: &str) {
        self.generation
            .resolution_digests
            .insert(name.into(), format!("{name}@2"));
    }
}

fn fallback() -> NodeKey {
    key(NodeKind::RenderInputs, &[b"whole bundle"])
}

/// The entry modules whose keys differ between two builds.
fn moved(before: &RenderKeys, after: &RenderKeys) -> BTreeSet<&'static str> {
    [S, C, P, T, U, STORIES]
        .into_iter()
        .filter(|module| before.module(module) != after.module(module))
        .collect()
}

fn edit(change: impl FnOnce(&mut Fixture)) -> BTreeSet<&'static str> {
    let mut fixture = Fixture::new();
    let before = fixture.keys();
    change(&mut fixture);
    moved(&before, &fixture.keys())
}

const EVERY: [&str; 6] = [S, C, P, T, U, STORIES];

#[test]
fn a_module_edit_moves_only_its_importers() {
    assert_eq!(edit(|f| f.digest("specs/h.ts")), BTreeSet::from([S]));
}

#[test]
fn a_dependency_upgrade_moves_only_its_importers() {
    let moved = edit(|f| {
        f.digest("node_modules/dep/index.js");
        f.resolution("node_modules/dep/package.json");
    });
    assert_eq!(moved, BTreeSet::from([S, C]));
}

#[test]
fn a_preview_edit_moves_only_the_stories() {
    let moved = edit(|f| f.digest(".storybook/preview.tsx"));
    assert_eq!(moved, BTreeSet::from([STORIES]));
}

#[test]
fn a_resolution_file_edit_moves_the_modules_below_it() {
    let beside = edit(|f| f.resolution("specs/s/tsconfig.json"));
    assert_eq!(beside, BTreeSet::from([S]));
    let root = edit(|f| f.resolution("package.json"));
    assert_eq!(root, BTreeSet::from(EVERY));
}

#[test]
fn a_class_map_change_moves_the_importers_of_the_css_module() {
    let moved = edit(|f| {
        f.generation
            .class_map_digests
            .insert("specs/c.module.css".into(), "map@2".into());
    });
    assert_eq!(moved, BTreeSet::from([S, C]));
}

#[test]
fn a_slot_provider_edit_moves_the_provider_and_its_importers() {
    assert_eq!(edit(|f| f.digest(P)), BTreeSet::from([S, C, P]));
}

#[test]
fn a_link_target_rename_moves_the_target_and_the_modules_that_import_it() {
    let moved = edit(|f| {
        f.bindings.insert(
            format!("{T}#default"),
            ResolvedDefinition {
                path: "moved/t".into(),
                title: "T".into(),
            },
        );
    });
    assert_eq!(moved, BTreeSet::from([S, T]));
}

#[test]
fn a_renderer_edit_moves_every_key_but_the_stories() {
    assert_eq!(
        edit(|f| f.digest("theme.ts")),
        BTreeSet::from([S, C, P, T, U])
    );
}

#[test]
fn a_runtime_package_or_installation_change_moves_every_key() {
    let react = edit(|f| f.resolution("node_modules/react/package.json"));
    assert_eq!(react, BTreeSet::from(EVERY));
    let installation = edit(|f| f.generation.environment = "environment@2".into());
    assert_eq!(installation, BTreeSet::from(EVERY));
}

#[test]
fn a_plain_stylesheet_edit_and_side_identities_move_nothing() {
    assert_eq!(edit(|f| f.digest("specs/shared.css")), BTreeSet::new());
    let side = edit(|f| {
        f.generation.id = "base generation".into();
        f.generation.css_context = "base".into();
        f.generation.resolution_files = BTreeSet::from(["specs/package.json".into()]);
    });
    assert_eq!(side, BTreeSet::new());
}

#[test]
fn handles_use_their_entry_module_key_and_unknown_modules_use_the_fallback() {
    let keys = Fixture::new().keys();
    assert_eq!(
        keys.handle(&format!("{C}#default:slot:0:children")),
        keys.module(C)
    );
    assert_eq!(
        keys.handle(&format!("{STORIES}#Primary")),
        keys.module(STORIES)
    );
    assert_eq!(keys.handle("specs/other.tsx#default"), &fallback());
    assert_eq!(keys.module("specs/h.ts"), &fallback());
    assert_ne!(keys.module(S), keys.module(U));
}

#[test]
fn runtime_package_manifests_outside_every_chain_leave_the_keys_but_react_moves_them() {
    let moved = edit(|f| {
        f.generation.runtime_packages = BTreeSet::from(["react".into(), "react-dom".into()]);
        f.resolution("node_modules/react-dom/package.json");
    });
    assert_eq!(moved, BTreeSet::new());
    let react = edit(|f| {
        f.generation.runtime_packages = BTreeSet::from(["react".into()]);
        f.resolution("node_modules/react/package.json");
    });
    assert_eq!(react, BTreeSet::from(EVERY));
}
