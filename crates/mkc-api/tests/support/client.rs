//! Reqwest adapter that validates each API response before the scenario reads it.

use std::string::FromUtf8Error;

use reqwest::blocking::{Body, Client, RequestBuilder};
use reqwest::header::HeaderMap;
use reqwest::{Error, Method, StatusCode};
use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::support::response_validation::validate;

pub(crate) struct ContractRequest(RequestBuilder);

pub(crate) struct ContractResponse {
    status: StatusCode,
    headers: HeaderMap,
    body: Vec<u8>,
}

impl ContractRequest {
    pub(crate) fn new(client: &Client, method: Method, url: String) -> Self {
        Self(client.request(method, url))
    }

    pub(crate) fn header(self, name: &str, value: impl AsRef<str>) -> Self {
        Self(self.0.header(name, value.as_ref()))
    }

    pub(crate) fn bearer_auth(self, token: impl AsRef<str>) -> Self {
        Self(self.0.bearer_auth(token.as_ref()))
    }

    pub(crate) fn json(self, value: &impl Serialize) -> Self {
        Self(self.0.json(value))
    }

    pub(crate) fn body(self, value: impl Into<Body>) -> Self {
        Self(self.0.body(value))
    }

    pub(crate) fn send(self) -> Result<ContractResponse, Error> {
        let (client, request) = self.0.build_split();
        let request = request?;
        let method = request.method().clone();
        let path = request.url().path().to_owned();
        let response = client.execute(request)?;
        let status = response.status();
        let headers = response.headers().clone();
        let body = response.bytes()?.to_vec();
        validate(method.as_str(), &path, status.as_u16(), &body);
        Ok(ContractResponse {
            status,
            headers,
            body,
        })
    }
}

impl ContractResponse {
    pub(crate) fn status(&self) -> StatusCode {
        self.status
    }

    pub(crate) fn headers(&self) -> &HeaderMap {
        &self.headers
    }

    pub(crate) fn json<T: DeserializeOwned>(self) -> Result<T, serde_json::Error> {
        serde_json::from_slice(&self.body)
    }

    pub(crate) fn text(self) -> Result<String, FromUtf8Error> {
        String::from_utf8(self.body)
    }

    pub(crate) fn bytes(self) -> Vec<u8> {
        self.body
    }
}
