//! Keep page items linked to their resource component in generated clients.

use utoipa::ToSchema;
use utoipa::openapi::Ref;
use utoipa::openapi::schema::{Array, ArrayBuilder};

pub(crate) fn page_items<T: ToSchema>() -> Array {
    ArrayBuilder::new()
        .items(Ref::from_schema_name(T::name()))
        .build()
}
