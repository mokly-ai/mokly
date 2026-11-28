//! Preview selections in incremental render keys.

use mokly_catalogue::render_sources::{RenderMethod, RenderSource, ResolvedDefinition};

use super::support::{Fixture, STORY};

#[test]
fn an_unnamed_preview_falls_back_only_for_its_folder_and_named_edits_stay_local() {
    const SECOND: &str = "packages/ui/button.stories.tsx";
    const FOLDER: &str = "packages/ui/.storybook";
    const PREVIEW: &str = "packages/ui/.storybook/preview.ts";
    const LINK: &str = "packages/ui/.storybook/preview.js";
    let mut fixture = Fixture::new();
    fixture.generation.modules.insert(SECOND.into(), Vec::new());
    fixture
        .generation
        .modules
        .insert(PREVIEW.into(), Vec::new());
    fixture
        .storybook_folders
        .insert(SECOND.into(), FOLDER.into());
    fixture
        .generation
        .storybook_previews
        .insert(FOLDER.into(), Some(PREVIEW.into()));
    let handle = format!("{SECOND}#default");
    fixture.entries.insert(
        "second".into(),
        RenderSource {
            handle: handle.clone(),
            method: RenderMethod::Story,
            ..Default::default()
        },
    );
    fixture.bindings.insert(
        handle,
        ResolvedDefinition {
            path: "second".into(),
            title: "Second".into(),
        },
    );

    let (first, _) = fixture.reuse(None);
    fixture.digest(PREVIEW, "changed");
    let (edit, jobs) = fixture.reuse(Some(&first));
    assert_eq!(jobs, 1);
    assert_ne!(edit.module(SECOND), first.module(SECOND));
    assert_eq!(edit.module(STORY), first.module(STORY));

    fixture
        .generation
        .resolution_digests
        .insert(LINK.into(), "linked preview".into());
    fixture
        .generation
        .storybook_previews
        .insert(FOLDER.into(), None);
    let (linked, jobs) = fixture.reuse(Some(&edit));
    assert_eq!(jobs, 0);
    assert_eq!(linked.module(SECOND), linked.fallback());
    assert_eq!(linked.module(STORY), first.module(STORY));
    assert_ne!(linked.module(STORY), linked.fallback());
}
