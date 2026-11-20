//! The typed `data` that each error reason carries, as the error schema documents it.

use std::borrow::Cow;

use utoipa::ToSchema;
use utoipa::openapi::schema::Ref;
use utoipa::openapi::{RefOr, Schema};

use crate::error_data::{
    ActiveBuild, BuildIneligible, DuplicateProject, PlanRequired, PublishedBuild, SlugConflict,
    VersionConflict,
};

use super::reasons;

/// Component schemas that a schema references, as `ToSchema::schemas` collects them.
type Schemas = Vec<(String, RefOr<Schema>)>;

/// One Rust data type and the reasons whose error envelope carries it.
pub(super) struct ReasonData {
    /// Reasons whose `ApiError` variant carries this type, in catalogue spelling.
    pub(super) reasons: &'static [&'static str],
    name: fn() -> Cow<'static, str>,
    schema: fn() -> RefOr<Schema>,
    schemas: fn(&mut Schemas),
}

impl ReasonData {
    const fn of<T: ToSchema>(reasons: &'static [&'static str]) -> Self {
        Self {
            reasons,
            name: T::name,
            schema: T::schema,
            schemas: T::schemas,
        }
    }

    /// Reference to the component schema of the carried type.
    pub(super) fn reference(&self) -> RefOr<Schema> {
        Ref::from_schema_name((self.name)()).into()
    }

    /// Adds the carried type and every schema it references to the document.
    pub(super) fn register(&self, schemas: &mut Schemas) {
        schemas.push(((self.name)().into_owned(), (self.schema)()));
        (self.schemas)(schemas);
    }
}

/// Every reason with typed `data`; the envelope of every other reason omits it.
pub(super) const REASON_DATA: [ReasonData; 7] = [
    ReasonData::of::<VersionConflict>(&[reasons::VERSION_CONFLICT]),
    ReasonData::of::<DuplicateProject>(&[reasons::DUPLICATE_PROJECT]),
    ReasonData::of::<PlanRequired>(&[reasons::PLAN_REQUIRED]),
    ReasonData::of::<SlugConflict>(&[reasons::SLUG_TAKEN, reasons::SLUG_RESERVED]),
    ReasonData::of::<BuildIneligible>(&[reasons::BUILD_INELIGIBLE]),
    ReasonData::of::<ActiveBuild>(&[reasons::BUILD_ALREADY_ACTIVE]),
    ReasonData::of::<PublishedBuild>(&[reasons::BUILD_ALREADY_PUBLISHED]),
];
