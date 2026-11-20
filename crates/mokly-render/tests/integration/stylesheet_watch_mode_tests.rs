//! Build and historical preparations do no physical watch-only projection.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::working_tree::WorkingTree;
use mokly_render::runtime::Runtime;
use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use super::support::Consumer;

#[test]
fn build_and_historical_runtimes_deliver_css_without_watch_projections() {
    for (historical, enable_after_construction, watched) in [
        (false, false, false),
        (true, false, false),
        (true, true, false),
        (false, true, true),
    ] {
        let mut consumer = Consumer::single();
        consumer.write(
            "mokly.config.json",
            r#"{
              "roots":[{"dir":"specs","files":["**/*.screen.html"]}],
              "renderer":"renderer.mjs",
              "stylesheets":[{"match":"**","stylesheets":["theme.css"]}]
            }"#,
        );
        consumer.write(
            "specs/mixed.screen.html",
            "---\ntitle: Home\n---\n<p>Home</p>\n",
        );
        consumer.write("theme.css", ".home { color: red }\n");
        consumer.write("renderer.mjs", "export default () => ({node:'Home'});");
        let projections = Arc::new(AtomicUsize::new(0));
        let observed = projections.clone();
        let inventory = Arc::new(Unimock::new(
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    observed.fetch_add(1, Ordering::SeqCst);
                    Ok(None)
                }))
                .at_least_times(0),
        ));
        inventory.project(Path::new("/inventory-probe")).unwrap();
        projections.store(0, Ordering::SeqCst);
        let mut runtime = Runtime::new(
            inventory.clone(),
            Arc::new(WorkingTree),
            consumer.runtime.physical_inputs.clone(),
            consumer.pool.clone(),
            consumer.runtime.cache.clone(),
            consumer.runtime.workers.clone(),
            consumer.runtime.version.clone(),
            None,
        );
        if historical {
            runtime = runtime.with_resolution_watching().for_base(
                inventory,
                consumer.runtime.version.clone(),
                None,
            );
        }
        if enable_after_construction {
            runtime = runtime.with_resolution_watching();
        }
        consumer.runtime = Arc::new(runtime.with_tree(Arc::new(WorkingTree)));
        let generation = consumer.generation(consumer.prepare().unwrap());
        let css = generation.resource("styles/theme.css").unwrap().unwrap();
        assert_eq!(
            String::from_utf8(css).unwrap(),
            ".home {\n  color: red;\n}\n"
        );
        assert_eq!(
            projections.load(Ordering::SeqCst) > 0,
            watched,
            "historical={historical}, enable_after_construction={enable_after_construction}"
        );
        assert_eq!(
            generation.stylesheet_resolution_files().is_empty(),
            !watched
        );
        assert!(generation.stylesheet_resolution_roots().is_empty());
        let javascript = generation
            .catalogue()
            .javascript
            .generation
            .as_ref()
            .unwrap();
        assert_eq!(javascript.resolution_inputs.files.is_empty(), !watched);
        assert_eq!(
            javascript.resolution_inputs.dependency_roots.is_empty(),
            !watched
        );
        assert_eq!(javascript.resolution_directories.is_empty(), !watched);
    }
}
