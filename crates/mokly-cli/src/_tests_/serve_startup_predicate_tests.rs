//! Cold-start scheduling reads configured transforms and included source inventory.

use mokly_catalogue::discovery::{Inventory, SourceFile, SourceKind};

use crate::serve_startup_native::needs_sidecar;
use crate::warning_support::config;

#[test]
fn startup_scheduling_uses_only_the_first_heads_config_and_included_inventory() {
    let mut renderer = config();
    renderer.input.renderer = Some("render.ts".into());
    let mut postcss = config();
    postcss.input.postcss = Some("postcss.mjs".into());
    let inventory = |kind, excluded| {
        let mut inventory = Inventory::default();
        inventory.files.push(SourceFile {
            path: "specs/item".into(),
            absolute: "/repo/specs/item".into(),
            identity: "specs/item".into(),
            root_index: 0,
            kind,
            excluded,
        });
        inventory
    };
    let results = [
        needs_sidecar(&config(), &Inventory::default()),
        needs_sidecar(&renderer, &Inventory::default()),
        needs_sidecar(&postcss, &Inventory::default()),
        needs_sidecar(&config(), &inventory(SourceKind::Module, false)),
        needs_sidecar(&config(), &inventory(SourceKind::Stories, false)),
        needs_sidecar(&config(), &inventory(SourceKind::Module, true)),
        needs_sidecar(&config(), &inventory(SourceKind::Stories, true)),
        needs_sidecar(&config(), &inventory(SourceKind::Page, false)),
    ];
    assert_eq!(
        results,
        [false, true, true, true, true, false, false, false]
    );
}
