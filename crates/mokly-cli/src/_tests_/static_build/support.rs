//! In-memory catalogue, output, and mock composition for static pipeline tests.

use std::collections::BTreeMap;
use std::sync::Mutex;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::discovery::Inventory;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::output::artifact::{Artifact, File};
use mokly_static::error::Error;

use crate::grammar::{Build, Common};

pub(super) fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![],
    }
}
pub(super) fn options() -> Build {
    Build {
        common: Common::default(),
        out: Some("site".into()),
        strict: false,
        no_changes: true,
    }
}
pub(super) fn catalogue() -> PreparedCatalogue {
    PreparedCatalogue {
        model: CatalogueModel {
            entries: vec![],
            sources: vec!["specs/home.screen.html".into()],
            folders: vec![],
            color_schemes: vec![],
        },
        inventory: Inventory::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        javascript: Default::default(),
        dependency_directories: Default::default(),
        deferred_modules: vec![],
        warnings: vec![],
    }
}
pub(super) fn artifact() -> Artifact {
    Artifact::finalize(
        "/repo/site".into(),
        vec![File {
            path: "index.html".into(),
            bytes: b"site".as_slice().into(),
        }],
        None,
    )
    .unwrap()
}
pub(super) fn warning() -> Warning {
    Warning {
        code: "unused",
        subject: WarningSubject::Entry("home".into()),
        message: "unused prop".into(),
    }
}

#[derive(Clone, Copy, Default)]
pub(super) struct Case {
    pub(super) fail: &'static str,
    pub(super) stop_fails: bool,
    pub(super) abandon_fails: bool,
    pub(super) cancelled: bool,
    pub(super) warnings: bool,
    pub(super) ready: bool,
    pub(super) publication: bool,
    pub(super) final_fingerprint_fails: bool,
    pub(super) input_changes: bool,
}
pub(super) fn record(events: &Mutex<Vec<&'static str>>, event: &'static str) {
    events.lock().unwrap().push(event);
}
pub(super) fn step(case: Case, name: &'static str) -> mokly_static::error::Result<()> {
    if case.fail == name {
        Err(Error::Invalid { path: name.into() })
    } else {
        Ok(())
    }
}
