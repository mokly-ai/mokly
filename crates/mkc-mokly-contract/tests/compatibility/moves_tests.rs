//! Real CLI moves retain index identities and exact declared comparison bytes.

use std::io::Cursor;
use std::sync::Arc;

use mkc_mokly_contract::archive::{GzipTarReader, TarballReader};
use mkc_mokly_contract::bundle::{ContractValidator, UploadValidator};
use mkc_mokly_contract::error::{Error, Rejection};
use mkc_mokly_contract::index::{CatalogueIndex, INDEX_PATH};
use mkc_mokly_contract::index_records::ChangesCount;
use mkc_mokly_contract::index_values::{ChangeKind, ColorScheme};
use mkc_mokly_contract::inventory::Inventory;
use mkc_mokly_contract::limits::Limits;
use mkc_upload_memory::budget::ProcessUploadMemoryBudget;

use super::super::digest;

fn reader() -> Arc<dyn TarballReader> {
    Arc::new(GzipTarReader::new(Arc::new(
        ProcessUploadMemoryBudget::new(512 * 1024 * 1024),
    )))
}

#[test]
fn released_moves_plan_and_complete_export_preserve_every_comparison_byte() {
    let validator: &dyn UploadValidator = &ContractValidator {
        reader: reader(),
        limits: Limits::default(),
    };
    let plan = include_bytes!("../../fixtures/moves-plan.tar.gz");
    let bundle = validator.validate(&mut Cursor::new(plan)).unwrap();
    let index = bundle.index();
    assert_eq!(
        index.changes_count(),
        Some(ChangesCount {
            changed: 9,
            added: 5,
            removed: 8,
            moved: 5
        })
    );
    let kept = index
        .counted_records()
        .iter()
        .find(|record| record.path == "account/kept")
        .unwrap();
    assert_eq!(kept.previous_path, None);
    for (path, previous) in [
        ("move-after", "move-before"),
        ("reuse-after", "reused"),
        ("variant-target/saved", "variant-source/saved"),
        ("zero-container/one", "zero-container/zero/one"),
        ("zero-container/two", "zero-container/zero/two"),
    ] {
        let record = index
            .counted_records()
            .iter()
            .find(|record| record.path == path)
            .unwrap();
        assert_eq!(record.previous_path.as_deref(), Some(previous));
    }
    for path in [
        "Account/Gone",
        "removed",
        "variant-source",
        "promote",
        "container/adopted/left",
        "container/adopted/right",
        "removed-guide",
        "removed-page",
    ] {
        let record = index
            .counted_records()
            .iter()
            .find(|record| record.path == path)
            .unwrap();
        assert_eq!(record.kind, ChangeKind::Removed, "{path}");
        assert_eq!(record.previous_path, None, "{path}");
    }
    for path in ["container/adopted", "promote/entry", "zero-container/zero"] {
        let record = index
            .counted_records()
            .iter()
            .find(|record| record.path == path)
            .unwrap();
        assert_eq!(record.kind, ChangeKind::Changed, "{path}");
    }
    assert_eq!(
        index
            .current_screens()
            .iter()
            .map(|screen| screen.path.as_str())
            .collect::<Vec<_>>(),
        ["account/kept", "move-after", "reuse-after"]
    );
    assert!(index.current_screens().iter().all(|screen| {
        screen
            .views
            .iter()
            .filter(|view| view.color_scheme == ColorScheme::Dark)
            .count()
            == 2
    }));
    let export = include_bytes!("../../fixtures/moves-export.tar.gz");
    assert!(export.len() < 640 * 1024);
    let full = reader()
        .read(&mut Cursor::new(export), Limits::default())
        .unwrap();
    let files = full.files();
    let inventory = Inventory::parse(&files[".mokly-export-artifact"], Limits::default()).unwrap();
    assert_eq!(inventory.files.len() + 1, files.len());
    for declaration in &inventory.files {
        let bytes = &files[&declaration.path];
        assert_eq!(declaration.size, bytes.len() as u64, "{}", declaration.path);
        assert_eq!(digest(bytes), declaration.sha256, "{}", declaration.path);
    }
    let root = index.comparison_generation().unwrap();
    assert!(
        inventory
            .files
            .iter()
            .filter(|file| file.path.starts_with("mokly-viewer/diffs/"))
            .all(|file| file.path.starts_with(root))
    );
    assert!(
        files.keys().any(
            |path| path.contains("/before/mokly-generated/Account/Kept/index.mobile.dark.html")
        )
    );
    assert!(files.contains_key("view/Account/Gone/index.html"));
    assert!(files.contains_key("view/account/kept/index.html"));
    assert_eq!(bundle.index_bytes(), &files[INDEX_PATH]);
    let reread = CatalogueIndex::parse(&files[INDEX_PATH], Limits::default()).unwrap();
    assert_eq!(reread.counted_records(), index.counted_records());
    assert_eq!(reread.current_screens(), index.current_screens());
    assert!(matches!(
        validator.validate(&mut Cursor::new(export)),
        Err(Error::Invalid {
            reason: Rejection::PlanFiles
        })
    ));
}
