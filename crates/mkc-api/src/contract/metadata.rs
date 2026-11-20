//! Security schemes and metadata that the OpenAPI derive cannot express.

use utoipa::Modify;
use utoipa::openapi::OpenApi;
use utoipa::openapi::info::LicenseBuilder;
use utoipa::openapi::security::{ApiKey, ApiKeyValue, HttpAuthScheme, HttpBuilder, SecurityScheme};

use crate::operation::Operation;

use super::operations::operations_mut;

pub(super) struct Metadata;

impl Modify for Metadata {
    fn modify(&self, document: &mut OpenApi) {
        document.info.contact = None;
        document.info.license = Some(
            LicenseBuilder::new()
                .name("Proprietary")
                .identifier(Some("LicenseRef-Proprietary"))
                .build(),
        );
        let components = document.components.get_or_insert_default();
        components.add_security_scheme(
            "session",
            SecurityScheme::ApiKey(ApiKey::Cookie(ApiKeyValue::new("mkc_session"))),
        );
        components.add_security_scheme(
            "projectToken",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .description(Some(
                        "Active project publishing token or live build-attempt upload grant; accepted only by the publication upload exchange.",
                    ))
                    .build(),
            ),
        );
    }
}

/// Availability is derived after every area's operations have been merged.
pub(super) struct DeferredOperations;

impl Modify for DeferredOperations {
    fn modify(&self, document: &mut OpenApi) {
        for contract in document.paths.paths.values_mut().flat_map(operations_mut) {
            let Some(id) = contract.operation_id.as_deref() else {
                continue;
            };
            let Ok(operation) = Operation::parse(id) else {
                continue;
            };
            if operation.implemented() {
                if let Some(extensions) = &mut contract.extensions {
                    extensions.remove("x-deferred");
                }
            } else {
                contract
                    .extensions
                    .get_or_insert_default()
                    .insert("x-deferred".to_owned(), true.into());
            }
        }
    }
}
