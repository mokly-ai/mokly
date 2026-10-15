//! Temporary props reuse composition and validation with a non-retaining cache.

use std::sync::{Arc, Mutex};

use mokly_model::catalogue::EntryContent;
use mokly_model::data::Props;

use crate::cache::MemoryCache;
use crate::closure::ClosureBuilder;
use crate::error::{Result, invalid};
use crate::session::Session;
use crate::types::{RenderGeneration, TransientDocument};

pub(crate) fn render(session: &Session, route: &str, props: &Props) -> Result<TransientDocument> {
    let plan = session
        .state
        .plans
        .get(route)
        .ok_or_else(|| invalid(route, "unknown preview view"))?;
    let saved = &session.state.catalogue.model.entries[plan.entry];
    let visual = match &saved.content {
        EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => visual,
        _ => return Err(invalid(route, "entry does not accept props")),
    };
    if &visual.props == props
        && let Some(artifact) = session.state.cache.get(&plan.key)
        && let Some(document) = artifact.document.as_ref()
    {
        let closure = session
            .walker()
            .collect(route, &document.tree, &document.resources)?;
        return Ok(TransientDocument { artifact, closure });
    }
    let mut state = session.state.as_ref().clone();
    state.temporary_props = Some((plan.entry, props.clone()));
    state.cache = Arc::new(MemoryCache::new(0));
    state.public_files = Arc::new(Mutex::new(Default::default()));
    let isolated = Session {
        state: Arc::new(state),
    };
    let artifact = isolated.render(route)?;
    let document = artifact
        .document
        .as_ref()
        .ok_or_else(|| invalid(route, "preview has no tree"))?;
    let closure = isolated
        .walker()
        .collect(route, &document.tree, &document.resources)?;
    Ok(TransientDocument { artifact, closure })
}
