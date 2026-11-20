//! Shared decoding and deterministic catalogue-write dispatch.

use mkc_billing_interface::catalogue_provider::RunId;
use mkc_billing_interface::error::Result;
use mkc_billing_interface::http::{Method, Request};
use serde::de::DeserializeOwned;

use crate::response;
use crate::transport::encode_form;

use super::StripeClient;
use super::form::{catalogue_idempotency_key, sorted_form};
use super::validation::validate_idempotency_key;

impl StripeClient {
    pub(super) fn call<T: DeserializeOwned>(
        &self,
        method: Method,
        path: String,
        idempotency_key: Option<String>,
        form: Vec<(String, String)>,
    ) -> Result<T> {
        response::decode(self.http.send(&Request {
            method,
            path,
            bearer: self.key.clone(),
            idempotency_key,
            form,
        })?)
    }

    /// Send one catalogue write under a key derived from the typed intent.
    ///
    /// Callers pass typed write intents and never an idempotency key: the
    /// adapter sorts the form, sends those exact bytes, and derives
    /// `mokly-catalogue:<run>:<operation>:<target>:<digest>` from the
    /// invocation's run identifier and the body's SHA-256 prefix.
    pub(super) fn catalogue_write<T: DeserializeOwned>(
        &self,
        run: &RunId,
        operation: &str,
        target: &str,
        path: String,
        form: Vec<(String, String)>,
    ) -> Result<T> {
        let form = sorted_form(form);
        let body = encode_form(&form);
        let key = catalogue_idempotency_key(run, operation, target, body.as_bytes());
        validate_idempotency_key(&key)?;
        self.call(Method::Post, path, Some(key), form)
    }
}
