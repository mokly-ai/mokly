//! A warm restart processes stylesheets with the PostCSS module and environment of its process.

use std::path::Path;

use mokly_test_support::durable_fixture::Owner;

use super::support::{Serve, get, source, write};

/// A plugin that writes its module version and the value of `FIXTURE_POSTCSS_TOKEN`.
fn postcss(version: &str) -> String {
    format!(
        "export default {{plugins:[{{postcssPlugin:'restart',Once(root){{root.append({{selector:'.restart',nodes:[{{prop:'--module',value:'{version}'}},{{prop:'--environment',value:process.env.FIXTURE_POSTCSS_TOKEN ?? 'unset'}}]}});}}}}]}};"
    )
}

/// The configured stylesheet after the plugin of `postcss`.
fn processed(version: &str, environment: &str) -> String {
    format!(
        ".theme {{\n  color: red;\n}}\n\n.restart {{\n  --module: {version};\n  --environment: {environment};\n}}\n"
    )
}

async fn stylesheet(serve: &mut Serve) -> String {
    serve.listening().await;
    serve.ready(0, "Home").await;
    get(&serve.host, "/static/mokly-generated/styles/theme.css").await
}

#[tokio::test]
async fn a_warm_restart_takes_the_postcss_module_and_environment_of_its_process() {
    let configure = |root: &Path, _: &Path| {
        write(&root.join("theme.css"), ".theme { color: red }");
        write(&root.join("postcss.mjs"), &postcss("first"));
        write(
            &root.join("mokly.config.json"),
            r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#,
        );
    };
    let mut cold = Serve::durable(Owner::ServePostcssRestart, &source("Home"), &configure).await;
    let first = stylesheet(&mut cold).await;
    cold.stop().await;
    assert_eq!(first, processed("first", "unset"));
    assert_eq!((cold.compiles(), cold.postcss_starts()), (1, 1));
    write(&cold.path("postcss.mjs"), &postcss("second"));
    let mut warm = cold.relaunch(&[("FIXTURE_POSTCSS_TOKEN", "second")]);
    let second = stylesheet(&mut warm).await;
    warm.stop().await;
    assert_eq!(second, processed("second", "second"));
    assert_eq!((warm.compiles(), warm.postcss_starts()), (0, 1));
}
