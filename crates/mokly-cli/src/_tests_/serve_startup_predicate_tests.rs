//! Cold-start scheduling reads configured transforms and included source inventory.

use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::{Inventory, SourceFile, SourceKind};
use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::comparison_reuse::MemoryComparisons;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_render::runtime::Runtime;
use mokly_server::changes::{ChangeSource, ChangeToken};
use unimock::{MockFn, Unimock, matching};

use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes::{ServeChanges, Source};
use crate::serve_startup_base::{StartupHandoff, StartupState};
use crate::serve_warnings::{ServeWarnings, WarningScopes};
use crate::warning_support::{catalogue, config};

fn source(
    config: ResolvedConfig,
    head: Arc<dyn RenderGeneration>,
    startup: Arc<StartupState>,
    inert: &Unimock,
) -> Source {
    let terminal = Arc::new(inert.clone());
    let cancellation = Arc::new(ServeCancellation::default());
    let style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: true,
        columns: 120,
    };
    let redactor = Arc::new(Redactor::default());
    let warnings = ServeWarnings::new(
        cancellation.clone(),
        terminal.clone(),
        style.clone(),
        redactor.clone(),
    )
    .begin();
    Source {
        references: Mutex::new(None),
        staging: Mutex::new(None),
        operation: Arc::new(CaptureCancellation::default()),
        pending: Arc::default(),
        config,
        head,
        warnings,
        services: ServeChanges {
            startup,
            reuse: Arc::new(MemoryComparisons::new(32 * 1024 * 1024)),
            kept_base: Arc::default(),
            sidecars: Arc::new(inert.clone()),
            progress: Arc::new(inert.clone()),
            refreshes: Arc::new(inert.clone()),
            cache_announced: Arc::new(false.into()),
            extraction_snapshots: Arc::new(inert.clone()),
            warnings: Arc::new(inert.clone()),
            runtime: Arc::new(Runtime::new(
                Arc::new(inert.clone()),
                Arc::new(inert.clone()),
                Arc::new(inert.clone()),
                Arc::new(inert.clone()),
                Arc::new(inert.clone()),
                Arc::new(inert.clone()),
                "test".into(),
                None,
            )),
            git: Arc::new(inert.clone()),
            cancellation,
            terminal,
            style,
            redactor,
            base: None,
            install_scripts: None,
        },
    }
}

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
    let cases = [
        ("empty", config(), Inventory::default(), None),
        ("renderer", renderer, Inventory::default(), Some(())),
        ("postcss", postcss, Inventory::default(), Some(())),
        (
            "module",
            config(),
            inventory(SourceKind::Module, false),
            Some(()),
        ),
        (
            "stories",
            config(),
            inventory(SourceKind::Stories, false),
            Some(()),
        ),
        (
            "excluded module",
            config(),
            inventory(SourceKind::Module, true),
            None,
        ),
        (
            "excluded stories",
            config(),
            inventory(SourceKind::Stories, true),
            None,
        ),
        ("page", config(), inventory(SourceKind::Page, false), None),
    ];
    for (case, config, inventory, expected) in cases {
        let inert = Unimock::new(());
        let record = Arc::new(StartupState::default());
        let mut prepared = catalogue(Vec::new());
        prepared.inventory = inventory;
        let head = Unimock::new(
            RenderGenerationMock::catalogue
                .each_call(matching!())
                .returns(prepared),
        );
        let source = source(config, Arc::new(head.clone()), record.clone(), &inert);
        let changes: &dyn ChangeSource = &source;
        let cancel = Arc::new(ChangeToken::default());
        let task = changes.startup(cancel.clone(), Arc::new(inert.clone()));
        let result = task.as_ref().map(|_| ());
        let rejected_record_is_unused =
            expected.is_some() || record.begin(source.head.clone(), cancel);
        assert_eq!(result, expected, "{case}: startup task");
        assert!(
            rejected_record_is_unused,
            "{case}: rejected startup must leave its record unused"
        );
    }
}
