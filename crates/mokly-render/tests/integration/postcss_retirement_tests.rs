//! Successful Serve head graphs serve retained CSS after their child is retired.

use std::fs;
use std::sync::Arc;

use mokly_graph::cache::{Artifact, MemoryCache, RenderCache};
use mokly_graph::key::NodeKey;
use mokly_sidecar::methods::Call;

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
        let cache = Arc::new(MemoryCache::new(64 * 1024, 0));
        let runtime = Arc::make_mut(&mut consumer.runtime);
        runtime.cache = cache.clone();
        *runtime = runtime.clone().with_stylesheet_watching();
        let generation = consumer.generation(consumer.prepare().unwrap());
        let contexts = css_contexts(&consumer.pool.calls.lock().unwrap());
        assert_eq!(contexts.len(), 1);
        assert_eq!(
            releases(&consumer, &contexts[0]),
            1,
            "javascript={javascript}"
        );
        let retained = cache.stats().entries;
        assert_ne!(retained, 0);
        let before_hit = cache.stats();
        let _ = generation.resource("styles/theme.css").unwrap().unwrap();
        let after_hit = cache.stats();
        assert_eq!(
            after_hit.hits - before_hit.hits,
            1,
            "javascript={javascript}"
        );
        assert_eq!(
            after_hit.misses - before_hit.misses,
            0,
            "javascript={javascript}"
        );
        for index in 0..64 {
            cache.insert(
                NodeKey(format!("retirement-filler-{index}")),
                Arc::new(Artifact {
                    bytes: vec![0; 1024],
                    document: None,
                    fragment: None,
                    content_type: "application/octet-stream".into(),
                }),
            );
        }
        let before_miss = cache.stats();
        let before = consumer.pool.calls.lock().unwrap().len();
        assert_eq!(
            generation.resource("styles/theme.css").unwrap().unwrap(),
            b"p {\n  color: 1;\n}\n"
        );
        let after_miss = cache.stats();
        assert_eq!(
            after_miss.misses - before_miss.misses,
            1,
            "javascript={javascript}"
        );
        assert_eq!(
            after_miss.hits - before_miss.hits,
            0,
            "javascript={javascript}"
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
