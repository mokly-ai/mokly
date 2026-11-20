//! Static responses with one content-coding and framing path.

use std::io;
use std::task::Poll;

use async_compression::Level;
use async_compression::tokio::bufread::{BrotliEncoder, GzipEncoder};
use axum::body::Body;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use bytes::Bytes;
use futures_util::{Stream, StreamExt};
use mkc_domain::client_origins::AdmittedOrigins;
use mkc_file_store_interface::stream::BlobStream;
use rpc_error::RpcError;
use tokio::io::BufReader;
use tokio_util::io::{ReaderStream, StreamReader};

use crate::catalogue::{Catalogue, FileBody, FileFraming, Served};
use crate::compression::{Coding, negotiate};
use crate::error::{Error, ErrorResultExt, Result};

pub(crate) fn failure(error: Error) -> Response {
    let mut response = RpcError::from(error).into_response();
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

pub(crate) async fn render(
    served: Served,
    accept_encoding: Option<&str>,
    catalogue: &dyn Catalogue,
) -> Result<Response> {
    let mut response = match served {
        Served::Redirect { status, location } => redirect(status, &location)?,
        Served::File {
            status,
            body,
            framing,
            mut content_type,
            cache,
            etag,
        } => {
            if content_type == "application/json" {
                content_type.push_str("; charset=utf-8");
            }
            let coding = negotiate(accept_encoding, status, framing, cache, &content_type);
            let mut response = StatusCode::from_u16(status)
                .context("render catalogue status")?
                .into_response();
            *response.body_mut() = match body {
                Some(FileBody::Storage(request)) => {
                    encoded_body(catalogue.open(request).await?, coding)
                }
                #[cfg(test)]
                Some(FileBody::Ready(stream)) => encoded_body(stream, coding),
                None => empty_body(),
            };
            for (name, value) in [
                (header::CONTENT_TYPE, content_type),
                (header::CACHE_CONTROL, cache.to_owned()),
                (header::ETAG, etag),
                (header::ACCEPT_RANGES, "bytes".to_owned()),
            ] {
                insert_file_header(&mut response, name, &value)?;
            }
            if let Some(value) = coding.header() {
                insert_file_header(&mut response, header::CONTENT_ENCODING, value)?;
            }
            frame(&mut response, framing, coding)?;
            response
        }
    };
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    Ok(response)
}

fn redirect(status: u16, location: &str) -> Result<Response> {
    let mut response = StatusCode::from_u16(status)
        .context("render catalogue redirect status")?
        .into_response();
    insert_file_header(&mut response, header::LOCATION, location)?;
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(response)
}

fn frame(response: &mut Response, framing: FileFraming, coding: Coding) -> Result<()> {
    response.headers_mut().remove(header::CONTENT_LENGTH);
    match framing {
        FileFraming::Full(length) if coding == Coding::Identity => {
            insert_file_header(response, header::CONTENT_LENGTH, &length.to_string())
        }
        FileFraming::Full(_) | FileFraming::NotModified(_) => Ok(()),
        FileFraming::Partial(range) => {
            insert_file_header(
                response,
                header::CONTENT_LENGTH,
                &range.length().to_string(),
            )?;
            insert_file_header(
                response,
                header::CONTENT_RANGE,
                &format!(
                    "bytes {}-{}/{}",
                    range.start(),
                    range.end(),
                    range.total_length()
                ),
            )
        }
        FileFraming::Unsatisfiable(length) => {
            insert_file_header(response, header::CONTENT_LENGTH, "0")?;
            insert_file_header(
                response,
                header::CONTENT_RANGE,
                &format!("bytes */{length}"),
            )
        }
    }
}

/// Axum polls the storage stream directly, so client backpressure pauses the
/// provider read and a dropped response drops the stream; the encoders use
/// fixed quality levels and never buffer the whole representation.
fn encoded_body(stream: BlobStream, coding: Coding) -> Body {
    let body = stream.into_body();
    match coding {
        Coding::Identity => Body::from_stream(log_errors(body)),
        Coding::Gzip => {
            let reader = BufReader::new(StreamReader::new(body));
            let encoder = GzipEncoder::with_quality(reader, Level::Precise(4));
            Body::from_stream(log_errors(ReaderStream::with_capacity(encoder, 64 * 1024)))
        }
        Coding::Brotli => {
            let reader = BufReader::new(StreamReader::new(body));
            let encoder = BrotliEncoder::with_quality(reader, Level::Precise(4));
            Body::from_stream(log_errors(ReaderStream::with_capacity(encoder, 64 * 1024)))
        }
    }
}

fn empty_body() -> Body {
    Body::from_stream(futures_util::stream::poll_fn(|_| {
        Poll::Ready(None::<io::Result<Bytes>>)
    }))
}

/// Log a body failure once; the started response ends without a second status.
fn log_errors<S>(stream: S) -> impl Stream<Item = io::Result<Bytes>> + Send
where
    S: Stream<Item = io::Result<Bytes>> + Send,
{
    stream.map(|item| {
        if let Err(error) = &item {
            tracing::error!(?error, "Catalogue body stream failed");
        }
        item
    })
}

fn insert_file_header(
    response: &mut Response,
    name: header::HeaderName,
    value: &str,
) -> Result<()> {
    response.headers_mut().insert(
        name,
        HeaderValue::from_str(value).context("render catalogue file header")?,
    );
    Ok(())
}

pub(crate) fn exchanged(cookie: &str) -> Result<Response> {
    let mut response = StatusCode::NO_CONTENT.into_response();
    let cookie = format!(
        "__Host-mkc_catalogue={cookie}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=300"
    );
    insert_file_header(&mut response, header::SET_COOKIE, &cookie)?;
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(response)
}

/// Expire invalid credentials without caching a cookie mutation on public URLs.
pub(crate) fn clear_cookie(response: &mut Response) {
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_static(
            "__Host-mkc_catalogue=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0",
        ),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
}

pub(crate) fn csp(origins: &AdmittedOrigins) -> String {
    let origin = origins.iter().collect::<Vec<_>>().join(" ");
    format!(
        "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self' {origin}"
    )
}
