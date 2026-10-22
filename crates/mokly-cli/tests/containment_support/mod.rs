//! Build an isolated Git catalogue and read its validated public comparison records.

use std::fs;
use std::path::PathBuf;

use mokly_model::public_detail::EntryDetailV2;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::review::ReviewResultV8;

use super::changes_support;

pub fn build(before: Vec<(String, String)>, after: Vec<(String, String)>) -> ReviewResultV8 {
    build_configured(before, after, "{\"review\":{\"base\":\"fixture-base\"}}")
}

pub fn build_configured(
    before: Vec<(String, String)>,
    after: Vec<(String, String)>,
    config: &str,
) -> ReviewResultV8 {
    let sources: Vec<_> = before
        .into_iter()
        .map(|(file, source)| (format!("specs/{file}"), source))
        .collect();
    let mut files: Vec<_> = sources
        .iter()
        .map(|(file, source)| (file.as_str(), source.as_str()))
        .collect();
    files.push(("mokly.config.json", config));
    let root = changes_support::base(&files);
    let modules = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../node_modules");
    #[cfg(unix)]
    std::os::unix::fs::symlink(modules, root.path().join("node_modules")).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(modules, root.path().join("node_modules")).unwrap();
    for (file, source) in after {
        changes_support::write(root.path(), &format!("specs/{file}"), &source);
    }
    let output = changes_support::run(root.path(), &["build", "--strict", "--sidecars", "1"]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let site = root.path().join("mokly-static");
    let index: CatalogueReadModel =
        serde_json::from_slice(&fs::read(site.join("mokly-viewer/index.json")).unwrap()).unwrap();
    let review: ReviewResultV8 =
        serde_json::from_slice(&fs::read(site.join(index.comparison_url.unwrap())).unwrap())
            .unwrap();
    for entry in &review.entries {
        let detail: EntryDetailV2 = serde_json::from_slice(
            &fs::read(site.join(format!("mokly-viewer/entries/{}.json", entry.path))).unwrap(),
        )
        .unwrap();
        for view in &entry.views {
            let details = detail
                .views
                .iter()
                .find(|item| {
                    item.viewport == view.viewport && item.color_scheme == view.color_scheme
                })
                .unwrap();
            assert_eq!(
                details.resource_evidence.as_ref().unwrap().rules,
                view.rules,
                "{}",
                entry.path
            );
        }
    }
    review
}
