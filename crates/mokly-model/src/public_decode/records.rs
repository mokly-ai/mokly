//! Public entry records check their kind before reading shared flattened fields.

use serde::de::Error;
use serde::{Deserialize, Deserializer};

use crate::public_metadata::CatalogueEntry;
use crate::public_records::{
    CatalogueComponent, CatalogueDocument, CataloguePage, CatalogueRecord, CatalogueScreen,
    CatalogueUseCase, CatalogueVisual,
};

use super::raw::Record;

fn entry<E: Error>(raw: &mut Record) -> Result<CatalogueEntry, E> {
    Ok(CatalogueEntry {
        path: raw.required("path")?,
        detail_id: raw.required("detailId")?,
        previous_path: raw.optional("previousPath")?,
        title: raw.required("title")?,
        tags: raw.required("tags")?,
        details: raw.required("details")?,
        changes: raw.required("changes")?,
    })
}

fn visual<E: Error>(raw: &mut Record) -> Result<CatalogueVisual, E> {
    Ok(CatalogueVisual {
        color_schemes: raw.required("colorSchemes")?,
        prop_schema: raw.required("propSchema")?,
        props: raw.required("props")?,
        controls: raw.required("controls")?,
        views: raw.required("views")?,
    })
}

impl<'de> Deserialize<'de> for CatalogueScreen {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        raw.reject(&[
            "slots",
            "suppliedSlots",
            "comparison",
            "documentKey",
            "documentKeys",
            "steps",
        ])?;
        Ok(Self {
            kind: raw.required("kind")?,
            entry: entry(&mut raw)?,
            visual: visual(&mut raw)?,
            address: raw.optional("address")?,
            variant_of: raw.optional("variantOf")?,
            use_case_paths: raw.required("useCasePaths")?,
        })
    }
}

impl<'de> Deserialize<'de> for CatalogueComponent {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        raw.reject(&[
            "address",
            "useCasePaths",
            "documentKey",
            "documentKeys",
            "steps",
        ])?;
        Ok(Self {
            kind: raw.required("kind")?,
            entry: entry(&mut raw)?,
            visual: visual(&mut raw)?,
            variant_of: raw.optional("variantOf")?,
            slots: raw.required("slots")?,
            supplied_slots: raw.required("suppliedSlots")?,
            comparison: raw.required("comparison")?,
        })
    }
}

impl<'de> Deserialize<'de> for CataloguePage {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        raw.reject(&[
            "colorSchemes",
            "propSchema",
            "props",
            "controls",
            "views",
            "address",
            "variantOf",
            "useCasePaths",
            "slots",
            "suppliedSlots",
            "comparison",
            "documentKeys",
            "steps",
        ])?;
        Ok(Self {
            kind: raw.required("kind")?,
            entry: entry(&mut raw)?,
            document_key: raw.required("documentKey")?,
        })
    }
}

impl<'de> Deserialize<'de> for CatalogueDocument {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        raw.reject(&[
            "propSchema",
            "props",
            "controls",
            "views",
            "address",
            "variantOf",
            "useCasePaths",
            "slots",
            "suppliedSlots",
            "comparison",
            "documentKey",
            "steps",
        ])?;
        Ok(Self {
            kind: raw.required("kind")?,
            entry: entry(&mut raw)?,
            color_schemes: raw.required("colorSchemes")?,
            document_keys: raw.required("documentKeys")?,
        })
    }
}

impl<'de> Deserialize<'de> for CatalogueUseCase {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        raw.reject(&[
            "colorSchemes",
            "propSchema",
            "props",
            "controls",
            "views",
            "address",
            "variantOf",
            "useCasePaths",
            "slots",
            "suppliedSlots",
            "comparison",
            "documentKey",
            "documentKeys",
        ])?;
        Ok(Self {
            kind: raw.required("kind")?,
            entry: entry(&mut raw)?,
            steps: raw.required("steps")?,
        })
    }
}

impl<'de> Deserialize<'de> for CatalogueRecord {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let raw = Record::read(deserializer)?;
        match raw.kind()? {
            "screen" => Ok(Self::Screen(raw.decode()?)),
            "component" => Ok(Self::Component(raw.decode()?)),
            "page" => Ok(Self::Page(raw.decode()?)),
            "document" => Ok(Self::Document(raw.decode()?)),
            "use-case" => Ok(Self::UseCase(raw.decode()?)),
            kind => Err(D::Error::unknown_variant(
                kind,
                &["screen", "component", "page", "document", "use-case"],
            )),
        }
    }
}
