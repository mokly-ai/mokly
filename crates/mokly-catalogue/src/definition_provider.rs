//! Definition-provider boundary for the sidecar describe inventory.

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::{FolderRecord, SourceLocation};

use crate::config_types::ResolvedConfig;
use crate::diagnostic::{Issue, Warning};
use crate::discovery::SourceFile;
use crate::error::Result;
use crate::input::EntryInput;
use crate::render_sources::{JavaScriptGeneration, ProvidedRendering, ResolvedDefinition};

/// One future sidecar definition, attributed independently of its exporting file.
#[derive(Clone, Debug)]
pub struct ProvidedDefinition {
    /// Discovered entry module that supplies identity and default slug.
    pub exporting_file: String,
    /// Defining module and export for attribution.
    pub source: SourceLocation,
    /// Definition kind.
    pub kind: EntryKind,
    /// Declarative metadata and props, before registry validation.
    pub input: EntryInput,
    /// Handles, saved slots, control hints, and data exclusions.
    pub rendering: ProvidedRendering,
}

/// One describe inventory, with private imported sources kept separate from entries.
#[derive(Clone, Debug, Default)]
pub struct Definitions {
    /// True only when the provider cannot evaluate JavaScript definitions.
    pub deferred: bool,
    /// Exported definitions, in source and export order.
    pub entries: Vec<ProvidedDefinition>,
    /// Code-carried folder records.
    pub folders: Vec<FolderRecord>,
    /// Additional confined repository sources from the module graph.
    pub sources: Vec<String>,
    /// Unevaluated bundle graph and installed class-map identity.
    pub generation: Option<JavaScriptGeneration>,
    /// Folder handles whose paths are already complete.
    pub bindings: std::collections::BTreeMap<String, ResolvedDefinition>,
    /// All source-attributed authoring failures collected by describe.
    pub issues: Vec<Issue>,
    /// Non-inference generation warnings.
    pub warnings: Vec<Warning>,
}

/// JavaScript description is a replaceable impure boundary, never part of the parser.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DefinitionProviderMock))]
pub trait DefinitionProvider: Send + Sync {
    /// Describe only the files in the resolved source set. HTML never reaches this call.
    fn describe(&self, config: &ResolvedConfig, files: &[SourceFile]) -> Result<Definitions>;
}

/// Milestone 4 inventories JavaScript files. Milestone 8 supplies the sidecar adapter.
pub struct DeferredDefinitions;

impl DefinitionProvider for DeferredDefinitions {
    fn describe(&self, _config: &ResolvedConfig, _files: &[SourceFile]) -> Result<Definitions> {
        Ok(Definitions {
            deferred: true,
            ..Default::default()
        })
    }
}
