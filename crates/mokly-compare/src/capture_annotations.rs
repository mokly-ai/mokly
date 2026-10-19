//! Serde mirrors stay private to authenticated in-process comparison captures.

use mokly_html::links::Reference;
use mokly_html::tree::{Attribute, Region, RegionKind};
use mokly_model::usage::ComponentInputOwner;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
/// Private attribute codec record.
pub(crate) struct AttributeRecord {
    name: String,
    value: String,
}

impl From<&Attribute> for AttributeRecord {
    fn from(value: &Attribute) -> Self {
        Self {
            name: value.name.clone(),
            value: value.value.clone(),
        }
    }
}

impl From<AttributeRecord> for Attribute {
    fn from(value: AttributeRecord) -> Self {
        Self {
            name: value.name,
            value: value.value,
        }
    }
}

#[derive(Deserialize, Serialize)]
/// Private authenticated logical-link record.
pub(crate) struct ReferenceRecord {
    source_route: String,
    target: String,
    fragment: Option<String>,
}

impl From<&Reference> for ReferenceRecord {
    fn from(value: &Reference) -> Self {
        Self {
            source_route: value.source_route.clone(),
            target: value.target.clone(),
            fragment: value.fragment.clone(),
        }
    }
}

impl From<ReferenceRecord> for Reference {
    fn from(value: ReferenceRecord) -> Self {
        Self {
            source_route: value.source_route,
            target: value.target,
            fragment: value.fragment,
        }
    }
}

#[derive(Deserialize, Serialize)]
/// Private trusted region record, never accepted from external JSON.
pub(crate) struct RegionRecord {
    id: String,
    kind: RegionKindRecord,
}

#[derive(Deserialize, Serialize)]
enum RegionKindRecord {
    Root {
        path: String,
    },
    Instance {
        path: String,
        key: String,
        local_id: String,
        props_key: String,
    },
    Slot {
        key: String,
        instance_key: String,
        name: String,
        owner: ComponentInputOwner,
    },
    Ignore {
        id: String,
        material_key: Option<String>,
    },
}

impl From<&Region> for RegionRecord {
    fn from(value: &Region) -> Self {
        let kind = match &value.kind {
            RegionKind::Root { path } => RegionKindRecord::Root { path: path.clone() },
            RegionKind::Instance {
                path,
                key,
                local_id,
                props_key,
            } => RegionKindRecord::Instance {
                path: path.clone(),
                key: key.clone(),
                local_id: local_id.clone(),
                props_key: props_key.clone(),
            },
            RegionKind::Slot {
                key,
                instance_key,
                name,
                owner,
            } => RegionKindRecord::Slot {
                key: key.clone(),
                instance_key: instance_key.clone(),
                name: name.clone(),
                owner: owner.clone(),
            },
            RegionKind::Ignore { id, material_key } => RegionKindRecord::Ignore {
                id: id.clone(),
                material_key: material_key.clone(),
            },
        };
        Self {
            id: value.id.clone(),
            kind,
        }
    }
}

impl From<RegionRecord> for Region {
    fn from(value: RegionRecord) -> Self {
        let kind = match value.kind {
            RegionKindRecord::Root { path } => RegionKind::Root { path },
            RegionKindRecord::Instance {
                path,
                key,
                local_id,
                props_key,
            } => RegionKind::Instance {
                path,
                key,
                local_id,
                props_key,
            },
            RegionKindRecord::Slot {
                key,
                instance_key,
                name,
                owner,
            } => RegionKind::Slot {
                key,
                instance_key,
                name,
                owner,
            },
            RegionKindRecord::Ignore { id, material_key } => {
                RegionKind::Ignore { id, material_key }
            }
        };
        Self { id: value.id, kind }
    }
}
