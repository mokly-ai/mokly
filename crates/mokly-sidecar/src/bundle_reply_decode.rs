//! Decode bundle fields directly into typed storage without buffering full replies.

use std::fmt;
use std::sync::Arc;

use serde::de::value::SeqAccessDeserializer;
use serde::de::{self, IgnoredAny, MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Deserializer};
use serde_json::value::RawValue;

use crate::bundle_reply::{BundleReply, RestoredBundle};
use crate::compiled::CompiledGeneration;
use crate::resolution_plan::ResolutionPlan;
use crate::results::{Bundle, Module};

#[derive(Deserialize)]
#[serde(field_identifier, rename_all = "camelCase")]
enum Field {
    Generation,
    RestoredGeneration,
    Compiled,
    Modules,
    Plan,
    UnmappedDependencyDirectories,
    #[serde(other)]
    Other,
}

#[derive(Default)]
struct Fields {
    generation: Option<String>,
    restored_generation: Option<Box<RawValue>>,
    restored_duplicate: bool,
    compiled: Option<Arc<CompiledGeneration>>,
    modules: Option<Arc<Vec<Module>>>,
    plan: Option<Option<Arc<ResolutionPlan>>>,
    unmapped: Option<Option<Vec<String>>>,
}

impl Fields {
    fn finish<E: de::Error>(self) -> Result<BundleReply, E> {
        let generation = self
            .generation
            .ok_or_else(|| de::Error::missing_field("generation"))?;
        let full = self.compiled.is_some()
            || self.modules.is_some()
            || self.plan.is_some()
            || self.unmapped.is_some();
        if !full && let Some(reference) = self.restored_generation {
            if self.restored_duplicate {
                return Err(de::Error::duplicate_field("restoredGeneration"));
            }
            let restored_generation = match serde_json::from_str(reference.get()) {
                Ok(value) => value,
                Err(error) => return Err(de::Error::custom(error)),
            };
            return Ok(BundleReply::Restored(RestoredBundle {
                generation,
                restored_generation,
            }));
        }
        Ok(BundleReply::Full(Box::new(Bundle {
            generation,
            compiled: self
                .compiled
                .ok_or_else(|| de::Error::missing_field("compiled"))?,
            modules: self
                .modules
                .ok_or_else(|| de::Error::missing_field("modules"))?,
            plan: self.plan.flatten(),
            unmapped_dependency_directories: self.unmapped.flatten(),
            epoch: 0,
            cache: None,
            compile_count: 0,
        })))
    }
}

struct BundleVisitor;

impl<'de> Visitor<'de> for BundleVisitor {
    type Value = BundleReply;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a full bundle result or restored bundle reference")
    }

    fn visit_seq<A>(self, sequence: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        Ok(BundleReply::Full(Box::new(Bundle::deserialize(
            SeqAccessDeserializer::new(sequence),
        )?)))
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut fields = Fields::default();
        while let Some(field) = map.next_key()? {
            match field {
                Field::Generation => read(&mut fields.generation, &mut map, "generation")?,
                Field::RestoredGeneration => {
                    if fields.restored_generation.is_some() {
                        fields.restored_duplicate = true;
                        map.next_value::<IgnoredAny>()?;
                    } else {
                        fields.restored_generation = Some(map.next_value()?);
                    }
                }
                Field::Compiled => read(&mut fields.compiled, &mut map, "compiled")?,
                Field::Modules => read(&mut fields.modules, &mut map, "modules")?,
                Field::Plan => read(&mut fields.plan, &mut map, "plan")?,
                Field::UnmappedDependencyDirectories => read(
                    &mut fields.unmapped,
                    &mut map,
                    "unmappedDependencyDirectories",
                )?,
                Field::Other => {
                    map.next_value::<IgnoredAny>()?;
                }
            }
        }
        fields.finish()
    }
}

fn read<'de, T: Deserialize<'de>, A: MapAccess<'de>>(
    field: &mut Option<T>,
    map: &mut A,
    name: &'static str,
) -> Result<(), A::Error> {
    if field.is_some() {
        return Err(de::Error::duplicate_field(name));
    }
    *field = Some(map.next_value()?);
    Ok(())
}

impl<'de> Deserialize<'de> for BundleReply {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_any(BundleVisitor)
    }
}
