//! Trusted annotation records stay private to the in-process document codec.

use mokly_html::links::Reference;
use mokly_html::tree::{Attribute, Region, RegionKind};
use mokly_model::usage::ComponentInputOwner;
use serde::{Deserialize, Serialize};

use crate::document_records::OwnerRecord;

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

impl AttributeRecord {
    pub(crate) fn known_bytes(&self) -> usize {
        self.name.capacity() + self.value.capacity()
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

#[derive(Clone, Deserialize, Serialize)]
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

impl ReferenceRecord {
    pub(crate) fn known_bytes(&self) -> usize {
        self.source_route.capacity()
            + self.target.capacity()
            + self.fragment.as_ref().map_or(0, String::capacity)
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
        owner: OwnerRecord,
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
                owner: OwnerRecord::from(owner),
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

impl RegionRecord {
    pub(crate) fn known_bytes(&self) -> usize {
        self.id.capacity()
            + match &self.kind {
                RegionKindRecord::Root { path } => path.capacity(),
                RegionKindRecord::Instance {
                    path,
                    key,
                    local_id,
                    props_key,
                } => path.capacity() + key.capacity() + local_id.capacity() + props_key.capacity(),
                RegionKindRecord::Slot {
                    key,
                    instance_key,
                    name,
                    owner,
                } => {
                    key.capacity() + instance_key.capacity() + name.capacity() + owner.known_bytes()
                }
                RegionKindRecord::Ignore { id, material_key } => {
                    id.capacity() + material_key.as_ref().map_or(0, String::capacity)
                }
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
                owner: ComponentInputOwner::from(owner),
            },
            RegionKindRecord::Ignore { id, material_key } => {
                RegionKind::Ignore { id, material_key }
            }
        };
        Self { id: value.id, kind }
    }
}
