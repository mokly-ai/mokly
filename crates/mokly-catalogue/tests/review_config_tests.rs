//! Normalized roots and confined parent segments in configuration paths.

use mokly_catalogue::error::CatalogueError;
use tempfile::TempDir;

mod support;

#[test]
fn parent_segments_inside_repo_root_work_for_every_local_input() {
    let directory = TempDir::new().unwrap();
    for (path, text) in [
        (
            "tools/mokly.config.json",
            r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"renderer":"../renderer.ts","postcss":"../postcss.mjs","stylesheets":[{"match":"**","stylesheets":["../theme.css"]}],"moduleResolution":{"packageRoots":["../packages/ui"]}}"#,
        ),
        ("specs/guide.md", "# Guide"),
        ("renderer.ts", "export {}"),
        ("postcss.mjs", "export default {}"),
        ("theme.css", "body {}"),
        ("packages/ui/package.json", "{}"),
    ] {
        support::write(directory.path(), path, text);
    }
    let prepared = support::prepare(directory.path(), Some("tools/mokly.config.json")).unwrap();
    assert_eq!(prepared.model.entries[0].metadata.path, "guide");
    let config = support::load(directory.path(), Some("tools/mokly.config.json"));
    assert_eq!(config.package_roots(), ["packages/ui"]);
}

#[test]
fn normalized_duplicate_roots_report_the_configuration_setting() {
    let directory = TempDir::new().unwrap();
    support::write(
        directory.path(),
        "mokly.config.json",
        r#"{"roots":[{"dir":"specs"},{"dir":"./specs"}]}"#,
    );
    support::write(directory.path(), "specs/guide.md", "# Guide");
    let CatalogueError::Config(issue) =
        support::prepare(directory.path(), Some("mokly.config.json")).unwrap_err()
    else {
        panic!()
    };
    assert_eq!(issue.message, "roots[1].dir: duplicate directory ./specs");
}
