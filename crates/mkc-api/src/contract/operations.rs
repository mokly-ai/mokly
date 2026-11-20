//! Typed traversal of OpenAPI operations, including additional HTTP methods.

use utoipa::openapi::path::{Operation, PathItem};

/// Visit every operation without treating path metadata as an HTTP method.
pub(crate) fn operations(item: &PathItem) -> impl Iterator<Item = (&str, &Operation)> {
    [
        ("GET", item.get.as_ref()),
        ("PUT", item.put.as_ref()),
        ("POST", item.post.as_ref()),
        ("DELETE", item.delete.as_ref()),
        ("OPTIONS", item.options.as_ref()),
        ("HEAD", item.head.as_ref()),
        ("PATCH", item.patch.as_ref()),
        ("TRACE", item.trace.as_ref()),
        ("QUERY", item.query.as_ref()),
    ]
    .into_iter()
    .filter_map(|(method, operation)| operation.map(|operation| (method, operation)))
    .chain(
        item.additional_operations
            .iter()
            .map(|(method, operation)| (method.as_str(), operation)),
    )
}

/// Visit operation metadata after merging the area's path items.
pub(super) fn operations_mut(item: &mut PathItem) -> impl Iterator<Item = &mut Operation> {
    [
        item.get.as_mut(),
        item.put.as_mut(),
        item.post.as_mut(),
        item.delete.as_mut(),
        item.options.as_mut(),
        item.head.as_mut(),
        item.patch.as_mut(),
        item.trace.as_mut(),
        item.query.as_mut(),
    ]
    .into_iter()
    .flatten()
    .chain(item.additional_operations.values_mut())
}
