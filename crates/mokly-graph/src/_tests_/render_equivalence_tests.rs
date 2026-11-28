//! Render input keys retain the complete reference algorithm's byte identity.

use std::collections::{BTreeMap, BTreeSet};

use mokly_catalogue::render_sources::{
    JavaScriptGeneration, RenderMethod, RenderSource, ResolvedDefinition,
};

use crate::key::{NodeKind, key};

use super::{RenderInputs, RenderKeys, render_reference};

fn generation() -> JavaScriptGeneration {
    let edges: &[(&str, &[&str])] = &[
        (
            "specs/a#screen.mockup.tsx",
            &["lib/declared.ts", "shared/a.ts", "missing\"\n😀.ts"],
        ),
        ("specs/b.mockup.tsx", &["lib/declared.ts", "ui/shared.ts"]),
        ("specs/reexport.mockup.tsx", &["lib/declared.ts"]),
        ("specs/button.stories.tsx", &["ui/shared.ts", "shared/a.ts"]),
        (
            "runtime/render.tsx",
            &["shared/a.ts", "ui/shared.ts", "node_modules/dep/index.js"],
        ),
        ("shared/a.ts", &["shared/b.ts", "styles/a.module.css"]),
        ("shared/b.ts", &["shared/a.ts", "styles/plain.css"]),
        ("ui/shared.ts", &[]),
        ("lib/declared.ts", &[]),
        ("styles/a.module.css", &[]),
        ("styles/plain.css", &[]),
        ("node_modules/dep/index.js", &[]),
        (
            ".storybook/preview.tsx",
            &["preview/setup.ts", "shared/a.ts"],
        ),
        (".storybook/preview.ts", &["unused-preview.ts"]),
        ("preview/setup.ts", &["ui/shared.ts"]),
    ];
    JavaScriptGeneration {
        environment: "environment\t\"😀".into(),
        storybook_previews: BTreeMap::from([(
            ".storybook".into(),
            Some(".storybook/preview.ts".into()),
        )]),
        modules: edges
            .iter()
            .map(|(path, imports)| {
                (
                    (*path).into(),
                    imports.iter().map(|path| (*path).into()).collect(),
                )
            })
            .collect(),
        module_digests: edges
            .iter()
            .map(|(path, _)| ((*path).into(), Some(format!("digest:{path}"))))
            .collect(),
        class_map_digests: BTreeMap::from([("styles/a.module.css".into(), "classes".into())]),
        resolution_digests: [
            "package.json",
            "tsconfig.json",
            "runtime/tsconfig.json",
            "shared/package.json",
            "preview/tsconfig.json",
            "node_modules/dep/package.json",
            "node_modules/react/package.json",
            "node_modules/react-dom/package.json",
            "node_modules/.mokly-roots/2/@emotion/cache/package.json",
            "outside/tsconfig.json",
        ]
        .into_iter()
        .map(|path| (path.into(), format!("resolution:{path}")))
        .collect(),
        runtime_packages: BTreeSet::from([
            "react".into(),
            "react-dom".into(),
            "@emotion/cache".into(),
        ]),
        unattributed: BTreeSet::from(["external#definition".into()]),
        ..JavaScriptGeneration::default()
    }
}

#[test]
fn shared_closures_and_fallbacks_keep_reference_keys() {
    let mut generation = generation();
    let bindings = [
        "specs/a#screen.mockup.tsx#default",
        "specs/a#screen.mockup.tsx#second",
        "specs/b.mockup.tsx#default",
        "specs/reexport.mockup.tsx#named",
        "specs/button.stories.tsx#Primary",
        "shared/a.ts#setup",
        "external#definition",
    ]
    .into_iter()
    .map(|handle| {
        (
            handle.into(),
            ResolvedDefinition {
                path: format!("catalogue/{handle}"),
                title: format!("Title\"\\\n\r\t\u{0000}\u{001f}é😀:{handle}"),
            },
        )
    })
    .collect();
    let declarations = BTreeMap::from([
        (
            "specs/reexport.mockup.tsx#named".into(),
            "lib/declared.ts".into(),
        ),
        (
            "specs/b.mockup.tsx#default".into(),
            "not-in-graph.ts".into(),
        ),
        ("shared/a.ts#setup".into(), "shared/a.ts".into()),
    ]);
    let entries = BTreeMap::from([(
        "button".into(),
        RenderSource {
            handle: "specs/button.stories.tsx#Primary".into(),
            method: RenderMethod::Story,
            ..RenderSource::default()
        },
    )]);
    for preview in ["named", "resolution", "unnamed", "absent"] {
        if preview == "resolution" {
            generation
                .resolution_digests
                .insert(".storybook/preview.tsx".into(), "preview".into());
        }
        if preview == "unnamed" {
            generation
                .storybook_previews
                .insert(".storybook".into(), None);
            generation.modules.remove(".storybook/preview.tsx");
            generation.modules.remove(".storybook/preview.ts");
        }
        if preview == "absent" {
            generation.storybook_previews.remove(".storybook");
            generation
                .resolution_digests
                .remove(".storybook/preview.tsx");
        }
        for renderer in [
            Some("runtime/render.tsx"),
            Some("unnamed-renderer.tsx"),
            None,
        ] {
            let inputs = RenderInputs {
                generation: &generation,
                bindings: &bindings,
                renderer,
                entries: &entries,
                storybook_folders: &BTreeMap::new(),
                declarations: &declarations,
            };
            let fallback = key(NodeKind::RenderInputs, &[b"whole bundle"]);
            let expected = render_reference::build(&inputs, fallback.clone());
            let actual = RenderKeys::build(&inputs, fallback);
            assert_eq!(actual.modules.len(), expected.modules.len());
            assert_eq!(actual.fallback(), expected.fallback());
            for module in generation.modules.keys().map(String::as_str).chain([
                "missing\"\n😀.ts",
                "unnamed-renderer.tsx",
                "unknown-entry.tsx",
            ]) {
                assert_eq!(
                    actual.module(module),
                    expected.module(module),
                    "module={module:?}, renderer={renderer:?}, preview={preview}"
                );
            }
        }
    }
}
