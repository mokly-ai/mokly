//! Assembly consumes only the injected generation, source closure, and package inventory.

use std::collections::BTreeMap;
use std::path::Path;

use mokly_graph::types::RenderGenerationMock;
use mokly_model::canonical;
use mokly_model::output::ownership::Ownership;
use mokly_model::output::validation::digest;
use mokly_model::readers;
use unimock::{MockFn, Unimock, matching};

use super::assembly_support::{
    assembler, config, empty_assembler, graph_with_key, plan, prepared, request,
};
use crate::assembly::Assembler;
use crate::error::Error;
use crate::transaction::CancellationMock;

#[test]
fn builds_complete_current_bytes_from_a_mocked_generation_without_disk_access() {
    let graph = graph_with_key(&"a".repeat(64));
    let assembler: &dyn Assembler = &assembler();
    let cancellation = Unimock::new(
        CancellationMock::requested
            .each_call(matching!())
            .returns(false),
    );
    let output = assembler
        .assemble(request(&config(), &graph), &cancellation)
        .unwrap();
    assert_eq!(output.directory, Path::new("/repo/site"));
    let files: BTreeMap<_, _> = output
        .files
        .iter()
        .map(|file| (file.path.as_str(), file.bytes.as_ref()))
        .collect();
    assert_eq!(files["index.html"], files["view/home/index.html"]);
    assert_eq!(files["404.html"], files["index.html"]);
    let index =
        readers::index(std::str::from_utf8(files["mokly-viewer/index.json"]).unwrap()).unwrap();
    let detail =
        readers::detail(std::str::from_utf8(files["mokly-viewer/entries/home.json"]).unwrap())
            .unwrap();
    let deployment =
        readers::deployment(std::str::from_utf8(files["mokly-viewer/deployment.json"]).unwrap())
            .unwrap();
    assert_eq!(detail.detail_id, index.pages[0].entry.detail_id);
    assert_eq!(deployment.deployment_id, index.deployment_id);
    assert_eq!(deployment.schema_version, 1);
    assert_eq!(
        std::str::from_utf8(files["mokly-viewer/deployment.json"]).unwrap(),
        format!(
            "{{\n  \"deploymentId\": \"{}\",\n  \"schemaVersion\": 1\n}}\n",
            index.deployment_id
        )
    );
    assert_eq!(index.revision, 0);
    let ownership = Ownership::parse(files[".mokly-export-artifact"]).unwrap();
    assert!(
        ownership
            .files
            .iter()
            .any(|entry| entry.path == "mokly-viewer/deployment.json")
    );
    assert_eq!(ownership.files.len() + 1, files.len());

    let mut zeroed = index.clone();
    zeroed.deployment_id = "0".repeat(64);
    let mut hashes: Vec<_> = files
        .iter()
        .filter(|(path, _)| {
            **path != ".mokly-export-artifact" && **path != "mokly-viewer/deployment.json"
        })
        .map(|(path, bytes)| {
            let canonical = if *path == "mokly-viewer/index.json" {
                canonical::to_string(&zeroed).unwrap().into_bytes()
            } else {
                bytes.to_vec()
            };
            ((*path).to_owned(), digest(&canonical))
        })
        .collect();
    hashes.sort_by(|left, right| left.0.encode_utf16().cmp(right.0.encode_utf16()));
    assert_eq!(
        index.deployment_id,
        digest(canonical::to_string(&hashes).unwrap().as_bytes())
    );
}

#[test]
fn rejects_empty_and_inconsistent_generations_without_panics_or_side_effects() {
    for empty in [true, false] {
        let mut catalogue = prepared();
        if empty {
            catalogue.model.entries.clear();
        }
        let graph = if empty {
            Unimock::new(
                RenderGenerationMock::catalogue
                    .each_call(matching!())
                    .returns(catalogue),
            )
        } else {
            Unimock::new((
                RenderGenerationMock::catalogue
                    .each_call(matching!())
                    .returns(catalogue),
                RenderGenerationMock::plans
                    .each_call(matching!())
                    .returns(plan(9)),
            ))
        };
        let assembler = empty_assembler();
        let error = assembler
            .assemble(request(&config(), &graph), &Unimock::new(()))
            .unwrap_err();
        assert!(if empty {
            matches!(error, Error::Empty)
        } else {
            matches!(error, Error::PlanEntry { entry: 9, .. })
        });
    }
}

#[test]
fn malformed_published_index_preserves_the_reader_diagnostic() {
    let graph = graph_with_key("bad");
    let assembler: &dyn Assembler = &assembler();
    let cancellation = Unimock::new(
        CancellationMock::requested
            .each_call(matching!())
            .returns(false),
    );
    let error = assembler
        .assemble(request(&config(), &graph), &cancellation)
        .unwrap_err();
    assert!(
        error.to_string().contains("invalid page document key"),
        "{error}"
    );
    assert!(
        error.to_string().contains("mokly-viewer/index.json"),
        "{error}"
    );
}
