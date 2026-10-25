//! Exact-byte and stale-file checks through mocked artifact storage.

use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::artifacts::{Artifacts, DefaultArtifacts, EntriesMock, ReadMock, generated_sources};
use crate::error::{Error, Result};

#[test]
fn exact_generated_bytes_pass_without_writes_or_native_host_lookup() {
    let files = Arc::new(Unimock::new((
        ReadMock.each_call(matching!(_)).answers(&generated_bytes),
        EntriesMock
            .each_call(matching!(_))
            .answers(&|_, directory| {
                let mut paths: Vec<_> = generated_sources(Path::new("/workspace"))
                    .into_iter()
                    .map(|(path, _)| path)
                    .filter(|path| path.parent() == Some(directory))
                    .collect();
                if directory == Path::new("/workspace/packages/viewer/src/generated") {
                    paths.push(directory.join("catalogue"));
                }
                Ok(paths)
            }),
    )));
    tasks(files).check_generated_types().unwrap();
}

#[test]
fn missing_changed_and_crlf_sources_fail_the_byte_comparison() {
    let expected = generated_sources(Path::new("/workspace"))[0].clone();
    for bytes in [
        None,
        Some(Vec::new()),
        Some(expected.1.replace('\n', "\r\n").into_bytes()),
    ] {
        let files = Arc::new(Unimock::new(
            ReadMock.next_call(matching!(_)).returns(Ok(bytes)),
        ));
        assert!(matches!(
            tasks(files).check_generated_types(),
            Err(Error::GeneratedTypeMismatch { path }) if path == expected.0
        ));
    }
}

#[test]
fn stale_generated_sources_fail_after_the_byte_comparison() {
    let stale = PathBuf::from("/workspace/packages/mokly/src/generated/sidecar/stale.ts");
    let files = Arc::new(Unimock::new((
        ReadMock.each_call(matching!(_)).answers(&generated_bytes),
        EntriesMock
            .next_call(matching!((path) if *path == Path::new("/workspace/packages/viewer/src/generated")))
            .returns(Ok(Vec::new())),
        EntriesMock
            .next_call(matching!((path) if *path == Path::new("/workspace/packages/viewer/src/generated/catalogue")))
            .returns(Ok(Vec::new())),
        EntriesMock
            .next_call(matching!((path) if *path == Path::new("/workspace/packages/mokly/src/generated/sidecar")))
            .returns(Ok(vec![stale.clone()])),
    )));
    assert!(matches!(
        tasks(files).check_generated_types(),
        Err(Error::UnexpectedGeneratedType { path }) if path == stale
    ));
}

#[test]
fn missing_catalogue_source_fails_the_byte_comparison() {
    let expected =
        PathBuf::from("/workspace/packages/viewer/src/generated/catalogue/CatalogueReadModel.ts");
    let files = Arc::new(Unimock::new(ReadMock.each_call(matching!(_)).answers(
        &|mock, path| {
            if path.ends_with("catalogue/CatalogueReadModel.ts") {
                Ok(None)
            } else {
                generated_bytes(mock, path)
            }
        },
    )));
    assert!(matches!(
        tasks(files).check_generated_types(),
        Err(Error::GeneratedTypeMismatch { path }) if path == expected
    ));
}

#[test]
fn catalogue_directory_is_allowed_but_its_stale_sources_fail() {
    let stale = PathBuf::from("/workspace/packages/viewer/src/generated/catalogue/stale.ts");
    let files = Arc::new(Unimock::new((
        ReadMock.each_call(matching!(_)).answers(&generated_bytes),
        EntriesMock
            .each_call(matching!(_))
            .answers(&|_, directory| {
                Ok(
                    if directory == Path::new("/workspace/packages/viewer/src/generated") {
                        vec![directory.join("catalogue")]
                    } else if directory
                        == Path::new("/workspace/packages/viewer/src/generated/catalogue")
                    {
                        vec![directory.join("stale.ts")]
                    } else {
                        Vec::new()
                    },
                )
            }),
    )));
    assert!(matches!(
        tasks(files).check_generated_types(),
        Err(Error::UnexpectedGeneratedType { path }) if path == stale
    ));
}

#[test]
fn source_read_failures_keep_the_typed_filesystem_error() {
    let files = Arc::new(Unimock::new(ReadMock.next_call(matching!(_)).returns(Err(
        Error::Filesystem {
            operation: "read generated types",
            path: "model.ts".into(),
            source: io::Error::from(ErrorKind::PermissionDenied),
        },
    ))));
    assert!(matches!(
        tasks(files).check_generated_types(),
        Err(Error::Filesystem { source, .. }) if source.kind() == ErrorKind::PermissionDenied
    ));
}

fn generated_bytes(_: &Unimock, path: &Path) -> Result<Option<Vec<u8>>> {
    let (_, text) = generated_sources(Path::new("/workspace"))
        .into_iter()
        .find(|(expected, _)| expected == path)
        .expect("only generated paths are read");
    Ok(Some(text.into_bytes()))
}

fn tasks(files: Arc<Unimock>) -> DefaultArtifacts {
    DefaultArtifacts {
        workspace: "/workspace".into(),
        os: "linux".into(),
        architecture: "riscv64".into(),
        commands: Arc::new(Unimock::new(())),
        files,
    }
}
