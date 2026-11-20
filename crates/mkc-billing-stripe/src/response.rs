//! Typed response decoding and explicit Stripe failure classification.

use mkc_billing_interface::error::{
    Error, ErrorResultExt, ProviderDetail, ProviderErrorCode, ProviderErrorType, Result,
};
use mkc_billing_interface::http::Response;
use serde::Deserialize;
use serde::de::DeserializeOwned;
use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum ResponseFailure {
    #[error("[mkc-billing-stripe/response] unexpected HTTP status: {0}")]
    UnexpectedStatus(u16),
    #[error(
        "[mkc-billing-stripe/response] Stripe HTTP {status}, type: {error_type:?}, code: {code:?}"
    )]
    Stripe {
        status: u16,
        error_type: Option<String>,
        code: Option<String>,
    },
    #[error("[mkc-billing-stripe/response] body exceeds one MiB")]
    Oversized,
}

#[derive(Deserialize)]
struct FailureEnvelope {
    error: Failure,
}

#[derive(Deserialize)]
struct Failure {
    #[serde(rename = "type")]
    error_type: Option<String>,
    code: Option<String>,
}

pub(crate) fn decode<T: DeserializeOwned>(response: Response) -> Result<T> {
    let response = checked(response)?;
    serde_json::from_slice(&response.body).context("decode Stripe response")
}

pub(crate) fn checked(response: Response) -> Result<Response> {
    match response.status {
        200..=299 => Ok(response),
        400 | 422 => Err(Error::InvalidRequest {
            detail: provider_detail(&response),
        }),
        401 => Err(Error::Unauthorized {
            detail: provider_detail(&response),
        }),
        403 => Err(Error::PermissionDenied {
            detail: provider_detail(&response),
        }),
        404 => Err(Error::NotFound {
            detail: provider_detail(&response),
        }),
        429 => Err(Error::RateLimited {
            retry_after: retry_after(&response),
            detail: provider_detail(&response),
        }),
        500..=599 => Err(Error::Unavailable),
        status @ 400..=499 => {
            let failure = serde_json::from_slice::<FailureEnvelope>(&response.body).ok();
            Err(Error::internal(ResponseFailure::Stripe {
                status,
                error_type: failure
                    .as_ref()
                    .and_then(|failure| failure.error.error_type.clone()),
                code: failure.and_then(|failure| failure.error.code),
            }))
        }
        status => Err(Error::internal(ResponseFailure::UnexpectedStatus(status))),
    }
}

fn provider_detail(response: &Response) -> ProviderDetail {
    let Some(failure) = serde_json::from_slice::<FailureEnvelope>(&response.body).ok() else {
        return ProviderDetail::none();
    };
    ProviderDetail {
        error_type: failure
            .error
            .error_type
            .as_deref()
            .map(ProviderErrorType::from_provider),
        code: failure.error.code.and_then(ProviderErrorCode::new),
    }
}

pub(crate) fn retry_after(response: &Response) -> u64 {
    response
        .headers
        .get("retry-after")
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(1)
        .max(1)
}
