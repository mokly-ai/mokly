//! Both preview contexts put two versions inside one viewport and one frame.

use super::{catalogue, dom};

/// Check the border, caption, viewport, layers, and drawn scrollbar topology.
pub(crate) fn check() {
    let fixture = catalogue::shared();
    for (name, mode, tall) in [
        ("overlay", "overlay", false),
        ("difference", "difference", false),
        ("overlay-tall", "overlay", true),
    ] {
        let path = format!("design/components/pages/stacked/{name}");
        let views = fixture.views(&path);
        assert_eq!(views.len(), 2, "both authored artboards: {path}");
        for artifact in views {
            let document = artifact.document.as_ref().unwrap();
            let previews = dom::class(&document.tree, "ce-preview-view");
            assert_eq!(previews.len(), 2, "{path}");
            for preview in previews {
                let frames = dom::class(&preview.children, "ce-canvas");
                assert_eq!(frames.len(), 1, "one bordered frame: {path}");
                let frame = frames[0];
                assert_eq!(dom::class(&frame.children, "ce-canvas-label").len(), 1);
                let viewports = dom::class(&frame.children, "mbk-stack-viewport");
                assert_eq!(viewports.len(), 1, "one shared viewport: {path}");
                let viewport = viewports[0];
                assert_eq!(viewport.get("data-scrolled").is_some(), tall);
                let stacks = dom::class(&viewport.children, "mbk-stack");
                assert_eq!(stacks.len(), 1);
                let layers = dom::class(&stacks[0].children, "mbk-stack-layer");
                assert_eq!(layers.len(), 2);
                assert!(
                    layers[0]
                        .get("class")
                        .unwrap()
                        .contains("mbk-stack-layer--before")
                );
                assert!(
                    layers[1]
                        .get("class")
                        .unwrap()
                        .contains("mbk-stack-layer--after")
                );
                if !tall {
                    assert_eq!(
                        layers
                            .iter()
                            .map(|layer| dom::class(&layer.children, "ce-action--before").len())
                            .collect::<Vec<_>>(),
                        [1, 0],
                        "Before and Current content stays in its own layer: {path}",
                    );
                }
                for layer in layers {
                    let subject = if tall { "ce-checklist" } else { "ce-action" };
                    assert_eq!(
                        dom::class(&layer.children, subject).len(),
                        1,
                        "one subject per layer: {path}"
                    );
                    assert_eq!(dom::class(&layer.children, "ce-canvas-content").len(), 1);
                    assert!(dom::class(&layer.children, "ce-canvas-label").is_empty());
                    assert!(dom::class(&layer.children, "mbk-stack-viewport").is_empty());
                }
                assert_eq!(
                    dom::class(&viewport.children, "mbk-stack-scrollbar").len(),
                    usize::from(tall)
                );
                assert_eq!(
                    dom::class(&viewport.children, "mbk-stack-thumb").len(),
                    usize::from(tall)
                );
                let compare = dom::class(&preview.children, "mbk-compare");
                assert_eq!(compare.len(), 1);
                assert_eq!(compare[0].get("data-compare-mode"), Some(mode));
                for class in [
                    "mbk-compare-side",
                    "mbk-compare-label",
                    "browser-frame",
                    "phone-frame",
                ] {
                    assert!(
                        dom::class(&compare[0].children, class).is_empty(),
                        "no separate version frame {class}: {path}"
                    );
                }
                let ordered = dom::elements(&frame.children);
                let caption = ordered
                    .iter()
                    .position(|element| element.get("class") == Some("ce-canvas-label"))
                    .unwrap();
                let scroll = ordered
                    .iter()
                    .position(|element| element.get("class") == Some("mbk-stack-viewport"))
                    .unwrap();
                assert!(
                    caption < scroll,
                    "caption stays outside and before viewport"
                );
            }
        }
    }
}
