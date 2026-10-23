//! Resolve repaired instance and slot identities with an explicit dependency stack.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::material::{instance_key, slot_key};
use mokly_model::usage::{ComponentInputOwner, ComponentInstanceRecord, ComponentSlotRecord};

use crate::diagnostic_code::Code;
use crate::error::{HtmlError, Result, invalid};

enum Resolution<T> {
    Ready(T),
    Need(String),
}

enum Work {
    Start(String),
    Owner(String),
    Slot(String),
    Finish(String),
}

pub(crate) struct Keys<'a> {
    instances: &'a BTreeMap<String, ComponentInstanceRecord>,
    slots: &'a BTreeMap<String, ComponentSlotRecord>,
    surviving: BTreeSet<String>,
    claimed: BTreeSet<String>,
    mapped: BTreeMap<String, String>,
    mapped_slots: BTreeMap<String, String>,
    visiting: BTreeSet<String>,
}

impl<'a> Keys<'a> {
    pub(crate) fn new(
        instances: &'a BTreeMap<String, ComponentInstanceRecord>,
        slots: &'a BTreeMap<String, ComponentSlotRecord>,
        surviving: BTreeSet<String>,
    ) -> Self {
        Self {
            instances,
            slots,
            surviving,
            claimed: BTreeSet::new(),
            mapped: BTreeMap::new(),
            mapped_slots: BTreeMap::new(),
            visiting: BTreeSet::new(),
        }
    }

    pub(crate) fn owner(&mut self, original: &ComponentInputOwner) -> Result<ComponentInputOwner> {
        loop {
            match self.owner_state(original)? {
                Resolution::Ready(owner) => return Ok(owner),
                Resolution::Need(key) => self.resolve(&key)?,
            }
        }
    }

    pub(crate) fn instance(&mut self, old: &str) -> Result<Option<String>> {
        self.resolve(old)?;
        Ok(self.mapped.get(old).cloned())
    }

    pub(crate) fn slot(&mut self, old: &str) -> Result<Option<String>> {
        loop {
            match self.slot_state(old)? {
                Resolution::Ready(key) => return Ok(key),
                Resolution::Need(key) => self.resolve(&key)?,
            }
        }
    }

    fn resolve(&mut self, old: &str) -> Result<()> {
        let mut pending = vec![Work::Start(old.into())];
        while let Some(work) = pending.pop() {
            match work {
                Work::Start(old) => {
                    if !self.surviving.contains(&old)
                        || self.mapped.contains_key(&old)
                        || !self.instances.contains_key(&old)
                    {
                        continue;
                    }
                    if !self.visiting.insert(old.clone()) {
                        return Err(invalid(
                            Code::BuildInvalid,
                            "cyclic instance identity after HTML repair",
                        ));
                    }
                    pending.push(Work::Owner(old));
                }
                Work::Owner(old) => {
                    if let Some(record) = self.instances.get(&old) {
                        match self.owner_state(&record.owner)? {
                            Resolution::Ready(_) => pending.push(Work::Slot(old)),
                            Resolution::Need(parent) => {
                                pending.push(Work::Owner(old));
                                pending.push(Work::Start(parent));
                            }
                        }
                    }
                }
                Work::Slot(old) => {
                    let slot = self
                        .instances
                        .get(&old)
                        .and_then(|record| record.slot_key.clone());
                    let state = match slot {
                        Some(slot) => self.slot_state(&slot)?,
                        None => Resolution::Ready(None),
                    };
                    match state {
                        Resolution::Ready(_) => pending.push(Work::Finish(old)),
                        Resolution::Need(receiver) => {
                            pending.push(Work::Slot(old));
                            pending.push(Work::Start(receiver));
                        }
                    }
                }
                Work::Finish(old) => self.finish(&old)?,
            }
        }
        Ok(())
    }

    fn finish(&mut self, old: &str) -> Result<()> {
        let Some(record) = self.instances.get(old) else {
            return Ok(());
        };
        let Resolution::Ready(owner) = self.owner_state(&record.owner)? else {
            return Err(invalid(
                Code::BuildInvalid,
                "cyclic instance identity after HTML repair",
            ));
        };
        let slot = record
            .slot_key
            .as_ref()
            .and_then(|slot| self.mapped_slots.get(slot));
        let key = match instance_key(&owner, slot.map(String::as_str), &record.id) {
            Ok(key) => key,
            Err(source) => return Err(HtmlError::Props { source }),
        };
        self.visiting.remove(old);
        if key != old && (self.surviving.contains(&key) || self.claimed.contains(&key)) {
            self.surviving.remove(old);
        } else {
            self.claimed.insert(key.clone());
            self.mapped.insert(old.into(), key);
        }
        Ok(())
    }

    fn owner_state(
        &self,
        original: &ComponentInputOwner,
    ) -> Result<Resolution<ComponentInputOwner>> {
        let mut owner = original;
        let mut seen = BTreeSet::new();
        while let ComponentInputOwner::Instance { instance_key } = owner {
            if self.surviving.contains(instance_key) {
                if let Some(key) = self.mapped.get(instance_key) {
                    return Ok(Resolution::Ready(ComponentInputOwner::Instance {
                        instance_key: key.clone(),
                    }));
                }
                if self.instances.contains_key(instance_key) {
                    return Ok(Resolution::Need(instance_key.clone()));
                }
            }
            if !seen.insert(instance_key) {
                return Err(invalid(
                    Code::BuildInvalid,
                    "cyclic instance owner after HTML repair",
                ));
            }
            let Some(record) = self.instances.get(instance_key) else {
                return Ok(Resolution::Ready(ComponentInputOwner::Entry));
            };
            owner = &record.owner;
        }
        Ok(Resolution::Ready(ComponentInputOwner::Entry))
    }

    fn slot_state(&mut self, old: &str) -> Result<Resolution<Option<String>>> {
        if let Some(key) = self.mapped_slots.get(old) {
            return Ok(Resolution::Ready(Some(key.clone())));
        }
        let Some(slot) = self.slots.get(old) else {
            return Ok(Resolution::Ready(None));
        };
        if !self.surviving.contains(&slot.instance_key) {
            return Ok(Resolution::Ready(None));
        }
        let Some(instance) = self.mapped.get(&slot.instance_key) else {
            return Ok(if self.instances.contains_key(&slot.instance_key) {
                Resolution::Need(slot.instance_key.clone())
            } else {
                Resolution::Ready(None)
            });
        };
        let key = match slot_key(instance, &slot.name) {
            Ok(key) => key,
            Err(source) => return Err(HtmlError::Props { source }),
        };
        self.mapped_slots.insert(old.into(), key.clone());
        Ok(Resolution::Ready(Some(key)))
    }
}
