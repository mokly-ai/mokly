//! Work and completion records for the iterative composition machine.

use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use std::rc::Rc;
use std::sync::Arc;

use mokly_model::catalogue::SourceLocation;
use tracing::Span;

use crate::context::Context;
use crate::tree::{Node, Region};

pub(crate) struct Placeholders {
    pub(crate) tokens: BTreeMap<String, String>,
    pub(crate) seen: BTreeSet<String>,
}

#[derive(Clone)]
pub(crate) enum Mode {
    Native,
    Ready,
    Foreign(Rc<RefCell<Placeholders>>),
}

pub(crate) enum After {
    Node(Node),
    Ignore {
        id: String,
        material_key: Option<String>,
    },
    Component {
        region: Region,
        target: Option<String>,
        fragment: Option<String>,
        source: Option<SourceLocation>,
    },
    Slot {
        cache: Option<(String, bool)>,
        region: Option<Region>,
    },
    JavaScript {
        placeholders: Rc<RefCell<Placeholders>>,
        component: Option<String>,
        page: bool,
    },
}

pub(crate) struct Expansion {
    pub(crate) nodes: Vec<Node>,
    pub(crate) context: Arc<Context>,
    pub(crate) mode: Mode,
    pub(crate) after: Vec<After>,
    pub(crate) location: Option<SourceLocation>,
    pub(crate) span: Option<Span>,
}

impl Expansion {
    pub(crate) fn native(nodes: Vec<Node>, context: Arc<Context>) -> Self {
        Self {
            nodes,
            context,
            mode: Mode::Native,
            after: Vec::new(),
            location: None,
            span: None,
        }
    }

    pub(crate) fn ready(nodes: Vec<Node>, context: Arc<Context>) -> Self {
        Self {
            mode: Mode::Ready,
            ..Self::native(nodes, context)
        }
    }
}
