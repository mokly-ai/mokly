//! Complete, mutable inputs for public render-key differential tests.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::render_sources::{
    JavaScriptGeneration, RenderMethod, RenderSource, ResolvedDefinition,
};
use unimock::{MockFn, Unimock, matching};

use crate::key::{NodeKey, NodeKind, key};
use crate::render_inputs::{PREVIEWS, RenderInputs, RenderKeys, render_reference};
use crate::workers::RenderWorkersMock;

pub(super) const A: &str = "specs/a.tsx";
pub(super) const B: &str = "specs/b.tsx";
pub(super) const C: &str = "specs/reexport.tsx";
pub(super) const STORY: &str = "specs/button.stories.tsx";
pub(super) const RENDERER: &str = "runtime/renderer.tsx";

#[derive(Clone)]
pub(super) struct Fixture {
    pub(super) generation: JavaScriptGeneration,
    pub(super) bindings: BTreeMap<String, ResolvedDefinition>,
    pub(super) entries: BTreeMap<String, RenderSource>,
    pub(super) declarations: BTreeMap<String, String>,
    pub(super) renderer: Option<String>,
    workers: Arc<Unimock>,
    jobs: Arc<AtomicUsize>,
}

impl Fixture {
    pub(super) fn new() -> Self {
        let edges: &[(&str, &[&str])] = &[
            (A, &["lib/leaf.ts", "styles/card.module.css", "missing.ts"]),
            (
                B,
                &["lib/cycle-x.ts", "lib/declared.ts", "styles/plain.css"],
            ),
            (C, &["lib/declared.ts"]),
            (STORY, &["lib/cycle-x.ts"]),
            ("lib/leaf.ts", &["node_modules/react-dom/index.js"]),
            ("lib/declared.ts", &[]),
            ("lib/other.ts", &[]),
            ("lib/cycle-x.ts", &["lib/cycle-y.ts"]),
            ("lib/cycle-y.ts", &["lib/cycle-x.ts"]),
            ("node_modules/react-dom/index.js", &[]),
            ("styles/card.module.css", &[]),
            ("styles/plain.css", &[]),
            (RENDERER, &["runtime/theme.ts"]),
            ("runtime/theme.ts", &[]),
            (PREVIEWS[0], &[PREVIEWS[1]]),
            (PREVIEWS[1], &["preview/setup.ts"]),
            ("preview/setup.ts", &[]),
        ];
        let mut generation = JavaScriptGeneration {
            environment: "environment@1".into(),
            class_map_digests: BTreeMap::from([("styles/card.module.css".into(), "map@1".into())]),
            runtime_packages: BTreeSet::from(["react".into(), "react-dom".into()]),
            ..Default::default()
        };
        for (path, imports) in edges {
            generation.modules.insert(
                (*path).into(),
                imports.iter().map(|path| (*path).into()).collect(),
            );
            generation
                .module_digests
                .insert((*path).into(), Some(format!("{path}@1")));
        }
        for path in [
            "package.json",
            "node_modules/react-dom/package.json",
            "outside/tsconfig.json",
        ] {
            generation
                .resolution_digests
                .insert(path.into(), format!("{path}@1"));
        }
        let bindings = [A, B, C, STORY]
            .into_iter()
            .map(|module| {
                (
                    format!("{module}#default"),
                    ResolvedDefinition {
                        path: format!("catalogue/{module}"),
                        title: format!("Title:{module}"),
                    },
                )
            })
            .collect();
        let jobs = Arc::new(AtomicUsize::new(0));
        let counted = jobs.clone();
        let workers = Arc::new(Unimock::new(
            RenderWorkersMock::comparison_tasks
                .some_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, count, task| {
                    counted.fetch_add(count, Ordering::Relaxed);
                    for index in (0..count).rev() {
                        task.run(index);
                    }
                })),
        ));
        Self {
            generation,
            bindings,
            entries: BTreeMap::from([(
                "story".into(),
                RenderSource {
                    handle: format!("{STORY}#default"),
                    method: RenderMethod::Story,
                    ..Default::default()
                },
            )]),
            declarations: BTreeMap::from([(format!("{C}#default"), "lib/declared.ts".into())]),
            renderer: Some(RENDERER.into()),
            workers,
            jobs,
        }
    }

    pub(super) fn inputs(&self) -> RenderInputs<'_> {
        RenderInputs {
            generation: &self.generation,
            bindings: &self.bindings,
            renderer: self.renderer.as_deref(),
            entries: &self.entries,
            declarations: &self.declarations,
        }
    }

    pub(super) fn digest(&mut self, module: &str, value: &str) {
        self.generation
            .module_digests
            .insert(module.into(), Some(value.into()));
    }

    pub(super) fn reuse(&self, previous: Option<&RenderKeys>) -> (RenderKeys, usize) {
        self.jobs.store(0, Ordering::Relaxed);
        let keys = RenderKeys::build_reusing_with_workers(
            &self.inputs(),
            fallback(),
            self.workers.as_ref(),
            previous,
        );
        (keys, self.jobs.load(Ordering::Relaxed))
    }

    pub(super) fn unseeded(&self) -> (RenderKeys, usize) {
        self.jobs.store(0, Ordering::Relaxed);
        let keys = RenderKeys::build_unseeded_with_workers(
            &self.inputs(),
            fallback(),
            self.workers.as_ref(),
        );
        (keys, self.jobs.load(Ordering::Relaxed))
    }

    pub(super) fn jobs(&self) -> usize {
        self.jobs.load(Ordering::Relaxed)
    }

    pub(super) fn check(&self, previous: Option<&RenderKeys>, label: &str) -> RenderKeys {
        let (actual, _) = self.reuse(previous);
        let expected = render_reference::build(&self.inputs(), fallback());
        assert_eq!(actual.modules, expected.modules, "{label}");
        assert_eq!(actual.fallback(), expected.fallback(), "{label}");
        actual
    }
}

pub(super) fn fallback() -> NodeKey {
    key(NodeKind::RenderInputs, &[b"whole bundle"])
}
