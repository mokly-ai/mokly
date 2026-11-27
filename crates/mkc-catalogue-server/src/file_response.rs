//! Select an indexed representation, validators, framing and worker scope.

use mkc_store_interface::blob::PublicationFile;

use crate::catalogue::{BodyRequest, FileBody, FileFraming, Request, Served};
use crate::conditional;
use crate::error::{ErrorResultExt, Result};
use crate::range::{self, Selection};
use crate::routes::ACCESS_WORKER_PATH;

/// Select a response for a file after authorization and path lookup.
pub(crate) fn select(
    request: &Request,
    file: PublicationFile,
    status: u16,
    cache: &'static str,
) -> Result<Served> {
    let length = u64::try_from(file.size).context("validate catalogue blob length")?;
    let etag = format!("W/\"{}\"", file.key.hash);
    let access_worker = file.path == ACCESS_WORKER_PATH;
    if status == 200
        && cache != "no-store"
        && request
            .if_none_match
            .as_deref()
            .is_some_and(|value| conditional::matches(value, file.key.hash.as_str()))
    {
        return Ok(Served::File {
            status: 304,
            body: None,
            framing: FileFraming::NotModified(length),
            content_type: file.content_type,
            cache,
            etag,
            access_worker,
        });
    }
    let selection = if status == 200 && !request.if_range {
        request
            .range
            .as_deref()
            .map_or(Selection::Full, |value| range::select(value, length))
    } else {
        Selection::Full
    };
    if selection == Selection::Unsatisfiable {
        return Ok(Served::File {
            status: 416,
            body: None,
            framing: FileFraming::Unsatisfiable(length),
            content_type: file.content_type,
            cache: "no-store",
            etag,
            access_worker: false,
        });
    }
    let selected_range = match selection {
        Selection::Partial(range) => Some(range),
        Selection::Full | Selection::Unsatisfiable => None,
    };
    let body = if request.head {
        None
    } else {
        Some(FileBody::Storage(BodyRequest {
            key: file.key,
            length,
            range: selected_range,
        }))
    };
    Ok(Served::File {
        status: if selected_range.is_some() {
            206
        } else {
            status
        },
        body,
        framing: selected_range.map_or(FileFraming::Full(length), FileFraming::Partial),
        content_type: file.content_type,
        cache,
        etag,
        access_worker,
    })
}
