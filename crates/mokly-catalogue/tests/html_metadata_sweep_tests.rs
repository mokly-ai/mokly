//! Native metadata retains the old rendered-HTML catalogue validation rules.

use mokly_catalogue::error::CatalogueError;
use tempfile::TempDir;

mod support;

#[test]
fn screen_and_use_case_tags_share_grammar_without_filesystem_device_restrictions() {
    for kind in ["screen.html", "use-case.yaml"] {
        for (tags, valid) in [
            ("", true),
            ("tags: []", true),
            ("tags: [forms, onboarding, con]", true),
            ("tags: forms", false),
            ("tags: [Forms]", false),
            ("tags: [forms, forms]", false),
            ("tags: [two_words]", false),
            ("tags: [1]", false),
        ] {
            let directory = TempDir::new().unwrap();
            support::write(directory.path(), "mokly.config.json", "{}");
            let metadata = format!("title: Home\n{tags}\n");
            let source = if kind == "screen.html" {
                format!("---\n{metadata}---\n<h1>Home</h1>")
            } else {
                format!("{metadata}steps: []\n")
            };
            support::write(directory.path(), &format!("specs/home.{kind}"), &source);
            let result = support::prepare(directory.path(), None);
            if valid {
                let prepared = result.unwrap();
                let tags = &prepared.model.entries[0].metadata.tags;
                if source.contains("onboarding") {
                    assert_eq!(tags, &["forms", "onboarding", "con"]);
                } else {
                    assert!(tags.is_empty());
                }
            } else {
                let CatalogueError::Invalid { issues, .. } = result.unwrap_err() else {
                    panic!("metadata validation failure")
                };
                assert!(issues.iter().any(|issue| issue.message.contains("tags")));
            }
        }
    }
}

#[test]
fn use_case_steps_reject_pages_and_missing_screens() {
    for target in ["page", "missing"] {
        let directory = TempDir::new().unwrap();
        support::write(directory.path(), "mokly.config.json", "{}");
        support::write(
            directory.path(),
            "specs/page.page.html",
            "---\ntitle: Page\n---\n<!doctype html><html><head></head><body>Page</body></html>",
        );
        support::write(
            directory.path(),
            "specs/tour.use-case.yaml",
            &format!("title: Tour\nsteps: [{{screenPath: {target}}}]\n"),
        );
        let CatalogueError::Invalid { issues, .. } =
            support::prepare(directory.path(), None).unwrap_err()
        else {
            panic!("relationship validation failure")
        };
        assert!(issues.iter().any(|issue| {
            issue.message.contains(target) && issue.message.contains("current screen")
        }));
    }
}
