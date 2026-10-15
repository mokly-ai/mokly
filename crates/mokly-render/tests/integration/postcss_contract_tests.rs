//! PostCSS provenance and empty directory reports reach the graph boundary.

use std::fs;

use mokly_graph::error::GraphError;

use super::support::Consumer;

#[test]
fn directory_reports_keep_empty_watches_and_public_denials_name_the_plugin() {
    let consumer = Consumer::new();
    fs::remove_dir_all(consumer.root().join("specs")).unwrap();
    fs::create_dir(consumer.root().join("specs")).unwrap();
    fs::create_dir(consumer.root().join("inputs")).unwrap();
    fs::create_dir(consumer.root().join("empty")).unwrap();
    fs::write(consumer.root().join("inputs/plain.txt"), "private").unwrap();
    fs::write(consumer.root().join("main.css"), "p {color:red}").unwrap();
    fs::write(
        consumer.root().join("mokly.config.json"),
        r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["main.css"]}]}"#,
    )
    .unwrap();
    fs::write(consumer.root().join("postcss.mjs"), r#"export default {plugins:[{postcssPlugin:'fixture-inputs',Once(root,{result}){for(const dir of ['inputs','empty']) result.messages.push({type:'dir-dependency',plugin:'fixture-inputs',dir:new URL('./'+dir,import.meta.url).pathname,glob:'**/*.txt'});}}]};"#).unwrap();
    fs::write(
        consumer.root().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<a href=\"../../inputs/plain.txt\">Private</a>",
    )
    .unwrap();
    let generation = consumer.generation(consumer.prepare().unwrap());
    let watches = generation.stylesheet_directories();
    assert_eq!(watches.len(), 2);
    assert!(
        watches
            .iter()
            .any(|watch| watch.path == "empty" && watch.glob == "**/*.txt")
    );
    assert!(
        watches
            .iter()
            .all(|watch| watch.origin.plugin == "fixture-inputs"
                && watch.origin.stylesheet == "main.css")
    );
    let GraphError::Attempt { failures, .. } =
        generation.render("home/index.mobile.html").unwrap_err()
    else {
        panic!("expected closure failure")
    };
    let GraphError::Invalid { message, .. } = &failures[0] else {
        panic!("expected policy failure")
    };
    assert_eq!(
        message,
        "document links and resources are invalid:\n- home/index.mobile.html: protected target ../../inputs/plain.txt: PostCSS plugin fixture-inputs reported it as a dependency of main.css; exclude it from the plugin's sources (Tailwind: @source not \"./inputs/plain.txt\" or source(none) with explicit @source)"
    );
}
