//! Scalar constraints that derive attributes cannot express directly.

use mkc_domain::values::Role;
use mkc_store_interface::publication::PublicationState;
use utoipa::openapi::schema::{ArrayBuilder, Object, ObjectBuilder, Type};

/// Project permissions and invitations exclude workspace ownership.
pub(crate) fn project_role() -> Object {
    ObjectBuilder::new()
        .schema_type(Type::String)
        .enum_values(Some(
            [Role::Admin, Role::Member, Role::Reviewer].map(Role::as_str),
        ))
        .build()
}

/// Schema for the publication states returned in an upload receipt.
pub(crate) fn receipt_state() -> Object {
    ObjectBuilder::new()
        .schema_type(Type::String)
        .enum_values(Some(
            [PublicationState::Ready, PublicationState::Expired].map(PublicationState::as_str),
        ))
        .description(Some(
            "Persisted state; a publication completed again after retention reports expired.",
        ))
        .build()
}

/// The upload exchange currently emits only version 1.
pub(crate) fn upload_version() -> Object {
    ObjectBuilder::new()
        .schema_type(Type::Integer)
        .enum_values(Some([1]))
        .build()
}

/// Declared file hashes this project has not stored, in ascending order.
pub(crate) fn missing_blobs() -> ArrayBuilder {
    ArrayBuilder::new()
        .items(
            ObjectBuilder::new()
                .schema_type(Type::String)
                .pattern(Some("^[a-f0-9]{64}$")),
        )
        .unique_items(true)
        .description(Some(
            "Declared file hashes this project has not stored, in ascending order.",
        ))
}
