//! JSON reason, protocol prose and GitHub delivery fixture validation.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use serde_json::Value;

use crate::error::{ErrorResultExt, Result};
use crate::policy::environment::Environment;

use super::openapi_client::DOCUMENT;
use super::{openapi_github, openapi_reasons};

pub(super) struct OpenapiCheck {
    pub(super) environment: Arc<dyn Environment>,
}

pub(super) trait OpenapiValidator {
    fn check(&self) -> Result<()>;
}

impl OpenapiValidator for OpenapiCheck {
    fn check(&self) -> Result<()> {
        let document: Value = serde_json::from_slice(&self.environment.read(Path::new(DOCUMENT))?)
            .context("parse OpenAPI JSON")?;
        let mut protocols = BTreeMap::new();
        let files = self.environment.files()?;
        for path in &files {
            if path.parent() == Some(Path::new("docs/protocol/cloud"))
                && path.extension().is_some_and(|extension| extension == "md")
            {
                let text = String::from_utf8(self.environment.read(path)?)
                    .context("decode protocol Markdown")?;
                protocols.insert(path.clone(), text);
            }
        }
        let catalogue = String::from_utf8(
            self.environment
                .read(Path::new("docs/protocol/cloud/rest-api.md"))?,
        )
        .context("decode REST reason catalogue")?;
        openapi_reasons::validate(&document, &catalogue, &protocols)?;
        if let Some(protocol) = protocols.get(Path::new("docs/protocol/cloud/github-app.md")) {
            openapi_github::validate(protocol, &files)?;
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/openapi_scope_tests.rs"]
mod openapi_scope_tests;
