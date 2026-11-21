//! Successful Serve head graphs serve retained CSS after their child is retired.

use std::collections::BTreeMap;
use std::fs;
use std::sync::{Arc, Mutex};

use mokly_graph::cache::{Artifact, RenderCache, RenderCacheMock};
use mokly_graph::key::NodeKey;
use mokly_sidecar::methods::Call;
use unimock::{MockFn, Unimock, matching};

use super::postcss_preparation_tests::{fixture, releases};

fn css_contexts(calls: &[Call]) -> Vec<String> {
    calls
        .iter()
        .filter_map(|call| match call {
            Call::ProcessCss(params) => Some(params.context.clone()),
            _ => None,
        })
        .collect()
}

fn cache(records: Arc<Mutex<BTreeMap<NodeKey, Arc<Artifact>>>>) -> Arc<dyn RenderCache> {
    let writes = records.clone();
    Arc::new(Unimock::new((
        RenderCacheMock::get
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, key| {
                records.lock().unwrap().get(key).cloned()
            }))
            .at_least_times(0),
        RenderCacheMock::insert
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, key, value| {
                writes.lock().unwrap().insert(key, value);
            }))
            .at_least_times(0),
    )))
}

#[test]
fn serve_head_retirement_keeps_exact_css_after_an_artifact_cache_miss() {
    for javascript in [true, false] {
        let mut consumer = fixture(true);
        if !javascript {
            fs::remove_file(consumer.root().join("specs/page.mockup.ts")).unwrap();
            consumer.write(
                "specs/page.screen.html",
                "---\ntitle: Page\n---\n<p>Page</p>",
            );
        }
        consumer.write("postcss.mjs", "let count=0;export default {plugins:[{postcssPlugin:'counter',Once(root){++count;root.walkDecls('color',declaration=>{declaration.value=String(count);});}}]};");
        let records = Arc::new(Mutex::new(BTreeMap::new()));
        let runtime = Arc::make_mut(&mut consumer.runtime);
        runtime.cache = cache(records.clone());
        *runtime = runtime.clone().with_stylesheet_watching();
        let generation = consumer.generation(consumer.prepare().unwrap());
        let contexts = css_contexts(&consumer.pool.calls.lock().unwrap());
        assert_eq!(contexts.len(), 1);
        assert_eq!(
            releases(&consumer, &contexts[0]),
            1,
            "javascript={javascript}"
        );
        let retained = records.lock().unwrap().len();
        assert_ne!(retained, 0);
        records.lock().unwrap().clear();
        let before = consumer.pool.calls.lock().unwrap().len();
        assert_eq!(
            generation.resource("styles/theme.css").unwrap().unwrap(),
            b"p {\n  color: 1;\n}\n"
        );
        let later = css_contexts(&consumer.pool.calls.lock().unwrap()[before..]);
        assert_eq!(later, Vec::<String>::new());
        drop(generation);
        assert_eq!(releases(&consumer, &contexts[0]), 1);
    }
}

#[test]
fn build_and_base_used_contexts_keep_the_graph_lifetime() {
    for base in [false, true] {
        let mut consumer = fixture(true);
        if base {
            consumer.runtime = Arc::new(consumer.runtime.for_base(
                consumer.runtime.tree.clone(),
                consumer.runtime.version.clone(),
                None,
            ));
        }
        let generation = consumer.generation(consumer.prepare().unwrap());
        let contexts = css_contexts(&consumer.pool.calls.lock().unwrap());
        assert_eq!(contexts.len(), 1);
        assert_eq!(releases(&consumer, &contexts[0]), 0, "base={base}");
        assert_eq!(
            generation.resource("styles/theme.css").unwrap().unwrap(),
            b"p {\n  color: red;\n}\n"
        );
        drop(generation);
        assert_eq!(releases(&consumer, &contexts[0]), 1, "base={base}");
    }
}
