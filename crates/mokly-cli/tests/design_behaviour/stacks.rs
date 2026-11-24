//! Each stacked Canvas frame puts two versions inside one shipped viewport.

use super::{catalogue, dom};

/// Check each compared frame's mode, viewport, ordered layers, and contents.
pub(crate) fn check() {
    let fixture = catalogue::shared();
    // The component explorer marks the version before of each frame, so its
    // frames also show which layer holds which version.
    for (path, mode, marked) in [
        ("design/canvas/changes/overlay", "overlay", false),
        ("design/canvas/changes/difference", "difference", false),
        ("design/canvas/components/compare", "overlay", true),
        (
            "design/canvas/components/compare/difference",
            "difference",
            true,
        ),
    ] {
        let views = fixture.views(path);
        assert_eq!(views.len(), 4, "both viewports in both schemes: {path}");
        for artifact in views {
            let document = artifact.document.as_ref().unwrap();
            let frames = dom::class(&document.tree, "cv-frame");
            assert!(!frames.is_empty(), "the stage draws frames: {path}");
            for frame in frames {
                let compare = dom::class(&frame.children, "mb-panes");
                assert_eq!(compare.len(), 1, "one comparison per frame: {path}");
                assert_eq!(compare[0].get("data-compare-mode"), Some(mode));
                let viewports = dom::class(&compare[0].children, "mb-viewport");
                assert_eq!(viewports.len(), 1, "one shared viewport: {path}");
                let boxes = dom::class(&viewports[0].children, "mb-viewport-box");
                assert_eq!(boxes.len(), 1);
                let layers = dom::class(&boxes[0].children, "mb-pane");
                assert_eq!(layers.len(), 2);
                assert!(layers[0].get("class").unwrap().contains("mb-pane--before"));
                assert!(layers[1].get("class").unwrap().contains("mb-pane--after"));
                assert_eq!(
                    layers
                        .iter()
                        .map(|layer| dom::class(&layer.children, "cv-cx-before").len())
                        .collect::<Vec<_>>(),
                    if marked { [1, 0] } else { [0, 0] },
                    "Before and Current content stays in its own layer: {path}",
                );
                for layer in layers {
                    assert_eq!(
                        dom::class(&layer.children, "mb-pane-doc").len(),
                        1,
                        "one surface per layer: {path}"
                    );
                    assert_eq!(
                        dom::class(&layer.children, "mbk-shot").len(),
                        1,
                        "one subject per layer: {path}"
                    );
                    assert!(dom::class(&layer.children, "mb-viewport").is_empty());
                }
                for class in [
                    "mb-pane-label",
                    "mb-pane-missing",
                    "browser-frame",
                    "phone-frame",
                ] {
                    assert!(
                        dom::class(&compare[0].children, class).is_empty(),
                        "no separate version frame {class}: {path}"
                    );
                }
            }
        }
    }
}
