//! Input contexts retained by lazy slots during iterative composition.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_model::catalogue::SourceLocation;
use mokly_model::data::Props;
use mokly_model::prop_schema::PropSchema;
use mokly_model::usage::ComponentInputOwner;

use crate::tree::Node;

#[derive(Clone)]
pub(crate) struct Context {
    pub(crate) raw_text: bool,
    pub(crate) link_base: String,
    pub(crate) replay: bool,
    pub(crate) props: Props,
    pub(crate) schema: PropSchema,
    pub(crate) source: SourceLocation,
    pub(crate) owner: ComponentInputOwner,
    pub(crate) slot_key: Option<String>,
    pub(crate) ignore: bool,
    pub(crate) slots: BTreeMap<String, Slot>,
    pub(crate) declared_slots: Vec<String>,
}

#[derive(Clone)]
pub(crate) struct Slot {
    pub(crate) nodes: Arc<Vec<Node>>,
    pub(crate) supplier: Arc<Context>,
    pub(crate) origin_key: Option<String>,
    pub(crate) key: Option<String>,
    pub(crate) instance_key: Option<String>,
}
