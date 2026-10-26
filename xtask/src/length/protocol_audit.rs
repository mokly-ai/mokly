//! The protocol document cap ratchet over the working tree and the
//! comparison commit.

use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::Path;

use super::caps::{CAP_TABLE, ProtocolCaps, parse_cap_table};
use super::error::{Error, Result};
use super::git::GitWorkspace;
use super::legacy_caps::parse_legacy_caps;
use super::policy::PROTOCOL_PREFIX;
use super::protocol_caps::{CapInputs, protocol_cap_findings};

/// The former protocol size test that held the caps before the JSON table.
const LEGACY_CAP_TEST: &str = "tests/protocol_doc_sizes.test.ts";
/// The protocol pages below the workspace root.
const PROTOCOL_ROOT: &str = "docs/protocol";
/// The ratchet's name in the repository suite output.
const NAME: &str = "Protocol document cap";

/// Audits the protocol document caps against the comparison commit.
#[cfg_attr(test, unimock::unimock(api = [ProtocolCapAuditorRunMock]))]
pub(crate) trait ProtocolCapAuditor: Send + Sync {
    /// Print the ratchet result and fail on a finding or a read failure.
    fn run(&self, workspace: &Path) -> Result<()>;
}

/// The Git and file-system implementation of the cap ratchet.
pub(crate) struct SystemProtocolCapAuditor;

impl ProtocolCapAuditor for SystemProtocolCapAuditor {
    fn run(&self, workspace: &Path) -> Result<()> {
        let (lines, outcome) = ratchet_outcome(audit_protocol_caps(workspace));
        for line in lines {
            eprintln!("{line}");
        }
        outcome
    }
}

/// The lines that the ratchet prints for an audit result, and its outcome:
/// a pass, a failure that lists every finding, or an audit that could not
/// run.
pub(crate) fn ratchet_outcome(result: Result<(Vec<String>, String)>) -> (Vec<String>, Result<()>) {
    match result {
        Err(error) => (
            vec![format!("{NAME} ratchet could not run: {error}")],
            Err(error),
        ),
        Ok((findings, summary)) if findings.is_empty() => {
            (vec![format!("{NAME} ratchet passed ({summary}).")], Ok(()))
        }
        Ok((findings, _)) => {
            let mut lines = vec![format!("{NAME} ratchet failed:")];
            lines.extend(findings.iter().map(|finding| format!("- {finding}")));
            (lines, Err(Error::ProtocolCaps))
        }
    }
}

/// The findings and the passing summary of the cap ratchet.
pub(crate) fn audit_protocol_caps(workspace: &Path) -> Result<(Vec<String>, String)> {
    let git = GitWorkspace::open(workspace)?;
    let root = git.root().to_path_buf();
    let mut inputs = CapInputs {
        candidate_caps: current_caps(&root)?,
        candidate_documents: current_documents(&root)?,
        baseline_documents: baseline_documents(&git)?,
        baseline_caps: baseline_caps(&git)?,
        predecessors: renamed_documents(&git)?,
    };
    if inputs.baseline_caps.is_none()
        && inputs.candidate_documents.contains_key("mokly-variants.md")
        && inputs
            .baseline_documents
            .contains_key("mokly-screen-variants.md")
    {
        inputs.predecessors.insert(
            "mokly-variants.md".to_owned(),
            "mokly-screen-variants.md".to_owned(),
        );
    }
    let summary = format!(
        "{} protocol document(s) and {} cap(s)",
        inputs.candidate_documents.len(),
        inputs.candidate_caps.len()
    );
    Ok((protocol_cap_findings(&inputs), summary))
}

fn current_caps(root: &Path) -> Result<ProtocolCaps> {
    let file = root.join(CAP_TABLE);
    if !file.exists() {
        return Err(Error::CapTableMissing {
            label: CAP_TABLE.to_owned(),
        });
    }
    parse_cap_table(&read(&file)?, CAP_TABLE)
}

/// The Markdown pages below `docs/protocol`, except the `fixtures` tree.
fn current_documents(root: &Path) -> Result<BTreeMap<String, Vec<u8>>> {
    let mut documents = BTreeMap::new();
    visit(&root.join(PROTOCOL_ROOT), "", &mut documents)?;
    Ok(documents)
}

fn visit(
    directory: &Path,
    relative: &str,
    documents: &mut BTreeMap<String, Vec<u8>>,
) -> Result<()> {
    let entries = match fs::read_dir(directory.join(relative)) {
        Ok(entries) => entries,
        Err(source) => return Err(filesystem("list", &directory.join(relative), source)),
    };
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(source) => return Err(filesystem("list", directory, source)),
        };
        let file_name = entry.file_name().to_string_lossy().into_owned();
        let name = if relative.is_empty() {
            file_name.clone()
        } else {
            format!("{relative}/{file_name}")
        };
        let kind = match entry.file_type() {
            Ok(kind) => kind,
            Err(source) => return Err(filesystem("inspect", &entry.path(), source)),
        };
        if kind.is_dir() {
            if name != "fixtures" {
                visit(directory, &name, documents)?;
            }
        } else if kind.is_file() && file_name.ends_with(".md") {
            documents.insert(name, read(&entry.path())?);
        }
    }
    Ok(())
}

fn baseline_documents(git: &GitWorkspace) -> Result<BTreeMap<String, Vec<u8>>> {
    let mut documents = BTreeMap::new();
    for file in git.base_files(PROTOCOL_ROOT)? {
        if let Some(name) = protocol_document_name(&file) {
            documents.insert(name.to_owned(), git.read_base(&file)?);
        }
    }
    Ok(documents)
}

/// The caps of the comparison commit: its JSON table, else the legacy test
/// table, else none so that the policy bootstraps from line counts.
fn baseline_caps(git: &GitWorkspace) -> Result<Option<ProtocolCaps>> {
    let base = git.require_base()?.to_owned();
    if git.base_file_exists(CAP_TABLE)? {
        let label = format!("{base}:{CAP_TABLE}");
        return Ok(Some(parse_cap_table(&git.read_base(CAP_TABLE)?, &label)?));
    }
    if !git.base_file_exists(LEGACY_CAP_TEST)? {
        return Ok(None);
    }
    let label = format!("{base}:{LEGACY_CAP_TEST}");
    match parse_legacy_caps(&git.read_base(LEGACY_CAP_TEST)?, &label)? {
        Some(caps) => Ok(Some(caps)),
        None => Err(Error::LegacyMissing { label }),
    }
}

/// The comparison-commit name of each Git-detected rename below
/// `docs/protocol`.
fn renamed_documents(git: &GitWorkspace) -> Result<BTreeMap<String, String>> {
    let mut predecessors = BTreeMap::new();
    for change in git.changed_files(&[PROTOCOL_ROOT])? {
        if !change.status.starts_with('R') || !change.path.ends_with(".md") {
            continue;
        }
        let candidate = protocol_document_name(&change.path);
        let predecessor = change.source.as_deref().and_then(protocol_document_name);
        if let (Some(candidate), Some(predecessor)) = (candidate, predecessor) {
            predecessors.insert(candidate.to_owned(), predecessor.to_owned());
        }
    }
    Ok(predecessors)
}

/// The path of a protocol page relative to `docs/protocol`, outside the
/// `fixtures` tree.
fn protocol_document_name(file: &str) -> Option<&str> {
    let name = file.strip_prefix(PROTOCOL_PREFIX)?;
    (name.ends_with(".md") && !name.starts_with("fixtures/")).then_some(name)
}

fn read(file: &Path) -> Result<Vec<u8>> {
    match fs::read(file) {
        Ok(bytes) => Ok(bytes),
        Err(source) => Err(filesystem("read", file, source)),
    }
}

fn filesystem(operation: &'static str, path: &Path, source: io::Error) -> Error {
    Error::Filesystem {
        operation,
        path: path.display().to_string(),
        source,
    }
}

#[cfg(test)]
#[path = "_tests_/protocol_audit_tests.rs"]
mod protocol_audit_tests;
