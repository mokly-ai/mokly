//! Pack each project's events into valid Postgres notification payloads.

use mkc_domain::ids::ProjectId;
use mkc_live_interface::error::{ErrorResultExt, Result};
use mkc_live_interface::relay::{InboundEvent, RelayMessage, TickBatch};

pub(super) const NOTICE_CHANNEL: &str = "mkc_live_notice";
pub(super) const RELAY_CHANNEL: &str = "mkc_live_relay";
const PAYLOAD_LIMIT: usize = 7_900;

/// Relay payloads and any dropped event to report for one tick.
pub(super) struct EncodedTick {
    /// The payloads to send in one transaction.
    pub(super) payloads: Vec<String>,
    /// The project and serialized byte length of the largest dropped event.
    pub(super) largest_dropped_event: Option<(ProjectId, usize)>,
}

pub(super) fn decode(channel: &str, payload: &str) -> serde_json::Result<Option<InboundEvent>> {
    match channel {
        NOTICE_CHANNEL => Ok(Some(InboundEvent::Notice(serde_json::from_str(payload)?))),
        RELAY_CHANNEL => Ok(Some(InboundEvent::Relay(serde_json::from_str(payload)?))),
        _ => Ok(None),
    }
}

pub(super) fn encode(batch: TickBatch) -> Result<EncodedTick> {
    let mut payloads = Vec::new();
    let mut largest_dropped_event = None;
    for (project, events) in batch.projects {
        let mut message = RelayMessage {
            replica: batch.replica,
            project,
            events: Vec::new(),
        };
        let envelope = serde_json::to_vec(&message)
            .context("measure live relay envelope")?
            .len();
        let mut message_bytes = envelope;
        let mut suffix = position_suffix(payloads.len());
        for event in events {
            let event_bytes = serde_json::to_vec(&event)
                .context("measure live client event")?
                .len();
            let has_events = !message.events.is_empty();
            let mut next_bytes = message_bytes + usize::from(has_events) + event_bytes;
            if next_bytes + suffix.len() >= PAYLOAD_LIMIT {
                let next_suffix = position_suffix(payloads.len() + usize::from(has_events));
                next_bytes = envelope + event_bytes;
                if next_bytes + next_suffix.len() >= PAYLOAD_LIMIT {
                    if largest_dropped_event
                        .is_none_or(|(_, largest_bytes)| event_bytes > largest_bytes)
                    {
                        largest_dropped_event = Some((project, event_bytes));
                    }
                    continue;
                }
                append(&mut payloads, &message, &suffix)?;
                message.events.clear();
                suffix = next_suffix;
            }
            message_bytes = next_bytes;
            message.events.push(event);
        }
        if !message.events.is_empty() {
            append(&mut payloads, &message, &suffix)?;
        }
    }
    Ok(EncodedTick {
        payloads,
        largest_dropped_event,
    })
}

fn append(payloads: &mut Vec<String>, message: &RelayMessage, suffix: &str) -> Result<()> {
    let mut json = serde_json::to_string(message).context("encode live relay message")?;
    json.push_str(suffix);
    payloads.push(json);
    Ok(())
}

/// Postgres folds identical payloads in one transaction. Encode the chunk
/// position as trailing JSON whitespace to keep even identical chunks distinct.
fn position_suffix(position: usize) -> String {
    if position == 0 {
        return String::new();
    }
    format!("{position:b}")
        .chars()
        .map(|bit| if bit == '0' { ' ' } else { '\t' })
        .collect()
}

#[cfg(test)]
#[path = "_tests_/payload_tests.rs"]
mod tests;
