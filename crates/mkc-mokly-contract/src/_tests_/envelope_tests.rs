//! Rejections preserve only a parsed envelope for caller-owned authorization.

use std::io::{Cursor, Write};
use std::sync::Arc;

use flate2::{Compression, write::GzEncoder};
use mkc_upload_memory::budget::ProcessUploadMemoryBudget;
use tar::{Builder, Header};

use crate::archive::{ArchiveFiles, GzipTarReader, TarballReader};
use crate::bundle::{ContractValidator, UploadValidator};
use crate::error::{Error, Limit, Rejection};
use crate::limits::Limits;

fn reader() -> GzipTarReader {
    GzipTarReader::new(Arc::new(ProcessUploadMemoryBudget::new(512 * 1024 * 1024)))
}

fn archive(files: ArchiveFiles, oversized: bool, directory: bool) -> Vec<u8> {
    let mut tar = Builder::new(Vec::new());
    if directory {
        let mut header = Header::new_ustar();
        header.set_entry_type(tar::EntryType::Directory);
        header.set_size(0);
        header.set_mode(0o755);
        header.set_cksum();
        tar.append_data(&mut header, "static/", &[][..]).unwrap();
    }
    for (path, bytes) in files
        .iter()
        .filter(|(p, _)| p.as_str() == "mokly-upload.json")
        .chain(
            files
                .iter()
                .filter(|(p, _)| p.as_str() != "mokly-upload.json"),
        )
    {
        let mut header = Header::new_ustar();
        header.set_size(bytes.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();
        tar.append_data(&mut header, path, bytes.as_ref()).unwrap();
    }
    let mut bytes = tar.into_inner().unwrap();
    if oversized {
        bytes.truncate(bytes.len() - 1024);
        let mut header = Header::new_ustar();
        header.set_path("oversized.bin").unwrap();
        header.set_size(64 * 1024 * 1024 + 1);
        header.set_cksum();
        bytes.extend_from_slice(header.as_bytes());
    }
    let mut gzip = GzEncoder::new(Vec::new(), Compression::fast());
    gzip.write_all(&bytes).unwrap();
    gzip.finish().unwrap()
}

#[test]
fn missing_mismatched_malformed_and_oversized_content_retains_parsed_identity() {
    let tarball_reader: &dyn TarballReader = &reader();
    let files = tarball_reader
        .read(
            &mut Cursor::new(include_bytes!("../../fixtures/plan.tar.gz")),
            Limits::default(),
        )
        .unwrap();
    for case in [
        "missing",
        "unexpected",
        "directory",
        "index",
        "oversized",
        "bad-envelope",
    ] {
        let mut changed = files.files().clone();
        match case {
            "missing" => {
                changed.remove(".mokly-export-artifact");
            }
            "unexpected" => {
                changed.insert("index.html".into(), vec![].into());
            }
            "index" => {
                let path = changed
                    .keys()
                    .find(|p| p.as_str() == "mokly-viewer/index.json")
                    .unwrap()
                    .clone();
                changed.insert(path, b"invalid json".to_vec().into());
            }
            "bad-envelope" => {
                changed.insert("mokly-upload.json".into(), b"invalid json".to_vec().into());
            }
            _ => (),
        }
        let validator: &dyn UploadValidator = &ContractValidator {
            reader: Arc::new(reader()),
            limits: Limits::default(),
        };
        let mut envelope = None;
        let rejected = validator
            .validate_with_envelope(
                &mut Cursor::new(archive(changed, case == "oversized", case == "directory")),
                &mut envelope,
            )
            .unwrap_err();
        assert_eq!(envelope.is_some(), case != "bad-envelope", "{case}");
        match case {
            "oversized" => {
                assert!(matches!(rejected, Error::TooLarge { limit: Limit::File }));
            }
            "unexpected" | "directory" => assert!(matches!(
                rejected,
                Error::Invalid {
                    reason: Rejection::PlanFiles
                }
            )),
            _ => {}
        }
    }
}

#[test]
fn the_released_plan_archive_validates_through_the_real_reader() {
    let validator: &dyn UploadValidator = &ContractValidator {
        reader: Arc::new(reader()),
        limits: Limits::default(),
    };
    let bundle = validator
        .validate(&mut Cursor::new(include_bytes!(
            "../../fixtures/plan.tar.gz"
        )))
        .unwrap();
    assert!(bundle.index().comparison_generation().is_some());
    assert_eq!(bundle.manifest().mokly_version, "0.19.0");
}
