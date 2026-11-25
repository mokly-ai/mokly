//! Exporter keys keep their module association across injected and real scheduling.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_catalogue::render_sources::{
    JavaScriptGeneration, RenderMethod, RenderSource, ResolvedDefinition,
};
use unimock::{MockFn, Unimock, matching};

use crate::key::{NodeKind, key};
use crate::workers::{RenderWorkers, RenderWorkersMock, ThreadWorkers};

use super::{RenderInputs, RenderKeys, render_reference};

const RENDERER: &str = "runtime/render.tsx";

struct Fixture {
    generation: JavaScriptGeneration,
    bindings: BTreeMap<String, ResolvedDefinition>,
    entries: BTreeMap<String, RenderSource>,
    declarations: BTreeMap<String, String>,
}

impl Fixture {
    fn new() -> Self {
        let edges: &[(&str, &[&str])] = &[
            ("shared/a.ts", &["shared/b.ts", "styles/shared.module.css"]),
            (
                "shared/b.ts",
                &["shared/a.ts", "shared/declared.ts", "missing.ts"],
            ),
            ("shared/declared.ts", &[]),
            ("styles/shared.module.css", &[]),
            (RENDERER, &["shared/a.ts", "runtime/theme.ts"]),
            ("runtime/theme.ts", &[]),
            (
                ".storybook/preview.js",
                &["shared/a.ts", "preview/setup.ts"],
            ),
            ("preview/setup.ts", &[]),
        ];
        let mut generation = JavaScriptGeneration {
            environment: "environment".into(),
            modules: edges
                .iter()
                .map(|(path, imports)| {
                    (
                        (*path).into(),
                        imports.iter().map(|import| (*import).into()).collect(),
                    )
                })
                .collect(),
            class_map_digests: BTreeMap::from([(
                "styles/shared.module.css".into(),
                "shared-classes".into(),
            )]),
            resolution_digests: [
                "package.json",
                "shared/tsconfig.json",
                "runtime/tsconfig.json",
                "preview/package.json",
                "outside/tsconfig.json",
            ]
            .into_iter()
            .map(|path| (path.into(), format!("resolution:{path}")))
            .collect(),
            unattributed: BTreeSet::from(["external#definition".into()]),
            ..JavaScriptGeneration::default()
        };
        let mut bindings = BTreeMap::from([(
            "external#definition".into(),
            ResolvedDefinition {
                path: "external".into(),
                title: "External".into(),
            },
        )]);
        let mut entries = BTreeMap::new();
        let mut declarations = BTreeMap::new();
        for index in 0..48 {
            let story = index % 3 == 0;
            let suffix = if story { "stories" } else { "mockup" };
            let module = format!("specs/entry-{index:02}.{suffix}.tsx");
            let handle = format!("{module}#default");
            let path = format!("entry-{index:02}");
            generation
                .modules
                .insert(module, vec!["shared/a.ts".into()]);
            bindings.insert(
                handle.clone(),
                ResolvedDefinition {
                    path: path.clone(),
                    title: format!("Entry {index}"),
                },
            );
            declarations.insert(handle.clone(), "shared/declared.ts".into());
            entries.insert(
                path,
                RenderSource {
                    handle,
                    method: if story {
                        RenderMethod::Story
                    } else {
                        RenderMethod::Screen
                    },
                    ..RenderSource::default()
                },
            );
        }
        generation.module_digests = generation
            .modules
            .keys()
            .map(|module| (module.clone(), Some(format!("digest:{module}"))))
            .collect();
        Self {
            generation,
            bindings,
            entries,
            declarations,
        }
    }
}

fn reverse_workers(count: usize) -> Unimock {
    if count == 0 {
        return Unimock::new(());
    }
    Unimock::new(
        RenderWorkersMock::comparison_tasks
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, actual, task| {
                assert_eq!(actual, count);
                for index in (0..actual).rev() {
                    task.run(index);
                }
            })),
    )
}

#[test]
fn many_exporters_keep_reference_keys_in_reverse_and_two_worker_scheduling() {
    let fixture = Fixture::new();
    let workers = ThreadWorkers::new(2).unwrap();
    for (scenario, renderer, unnamed_preview, count) in [
        ("named", RENDERER, false, 48),
        ("unnamed renderer", "unnamed-renderer.tsx", false, 16),
        ("unnamed preview", RENDERER, true, 32),
        ("whole fallback", "unnamed-renderer.tsx", true, 0),
    ] {
        let mut generation = fixture.generation.clone();
        if unnamed_preview {
            generation.modules.remove(".storybook/preview.js");
            generation
                .resolution_digests
                .insert(".storybook/preview.js".into(), "unnamed-preview".into());
        }
        let inputs = RenderInputs {
            generation: &generation,
            bindings: &fixture.bindings,
            renderer: Some(renderer),
            entries: &fixture.entries,
            storybook_folders: &BTreeMap::new(),
            declarations: &fixture.declarations,
        };
        let fallback = key(NodeKind::RenderInputs, &[b"whole bundle"]);
        let expected = render_reference::build(&inputs, fallback.clone());
        assert_eq!(expected.modules.len(), count, "scenario={scenario}");
        let reverse = reverse_workers(count);
        let schedulers: [(&str, &dyn RenderWorkers); 2] =
            [("reverse", &reverse), ("two workers", &workers)];
        for (schedule, workers) in schedulers {
            let actual = RenderKeys::build_with_workers(&inputs, fallback.clone(), workers);
            assert_eq!(
                actual.modules.len(),
                expected.modules.len(),
                "scenario={scenario}, schedule={schedule}"
            );
            assert_eq!(actual.fallback(), expected.fallback());
            for module in generation.modules.keys().map(String::as_str).chain([
                "missing.ts",
                "unknown-entry.tsx",
                "unnamed-renderer.tsx",
                ".storybook/preview.js",
            ]) {
                assert_eq!(
                    actual.module(module),
                    expected.module(module),
                    "scenario={scenario}, schedule={schedule}, module={module}"
                );
            }
        }
    }
}
