//! Response fields stay required; the explicit omission list is checked by serialization.

#![allow(clippy::unwrap_used)]

use std::collections::BTreeSet;

use chrono::Utc;
use mkc_domain::ids::{ProjectId, PublicationId, UserId};
use mkc_domain::values::Role;
use mkc_mokly_contract::index_values::{ColorScheme, Viewport};
use mkc_publications::ingest::Plan;
use rpc_error::RpcError;
use serde_json::{Value, json, to_value};
use uuid::Uuid;

use crate::contract::deferred::anchor::Anchor;
use crate::error::ApiError;
use crate::upload_plan::plan_response;
use crate::views::grants::{GrantView, GrantViewFields};

use super::response_validation::{document, resolve_reference};

const OMITTED: [(&str, &str); 3] = [
    ("/components/schemas/Anchor", "elementPath"),
    ("/components/schemas/ProjectGrant", "version"),
    ("/components/schemas/UploadPlan", "blobEncodings"),
];

#[test]
fn every_response_property_is_required_or_a_checked_serde_omission() {
    let mut seen = BTreeSet::new();
    let mut omissions = BTreeSet::new();
    for item in document()["paths"].as_object().unwrap().values() {
        for operation in item.as_object().unwrap().values() {
            for response in operation["responses"].as_object().unwrap().values() {
                let (response, _) = resolve_reference(response, "");
                if let Some(schema) = response.pointer("/content/application~1json/schema") {
                    inspect(schema, &BTreeSet::new(), &mut seen, &mut omissions);
                }
            }
        }
    }
    assert_eq!(omissions, OMITTED.into_iter().collect());
}

fn inspect<'a>(
    schema: &'a Value,
    inherited: &BTreeSet<&'a str>,
    seen: &mut BTreeSet<String>,
    omissions: &mut BTreeSet<(&'static str, &'static str)>,
) {
    if let Some(reference) = schema["$ref"].as_str() {
        if seen.insert(reference.into()) {
            inspect(
                document()
                    .pointer(reference.strip_prefix('#').unwrap())
                    .unwrap(),
                inherited,
                seen,
                omissions,
            );
        }
        return;
    }
    let mut required = inherited.clone();
    required.extend(
        schema["required"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|name| name.as_str().unwrap()),
    );
    if let Some(branches) = schema["allOf"].as_array() {
        for branch in branches {
            required.extend(
                branch["required"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .map(|name| name.as_str().unwrap()),
            );
        }
    }
    if let Some(properties) = schema["properties"].as_object() {
        for (name, property) in properties {
            if !required.contains(name.as_str()) {
                let omission = OMITTED.iter().find(|(pointer, field)| {
                    *field == name && document().pointer(pointer).unwrap() == schema
                });
                assert!(
                    omission.is_some(),
                    "unexpected optional response field: {name}: {schema}"
                );
                omissions.insert(*omission.unwrap());
            }
            inspect(property, &BTreeSet::new(), seen, omissions);
        }
    }
    if let Some(items) = schema.get("items") {
        inspect(items, &BTreeSet::new(), seen, omissions);
    }
    for keyword in ["allOf", "oneOf", "anyOf"] {
        for branch in schema[keyword].as_array().into_iter().flatten() {
            inspect(branch, &required, seen, omissions);
        }
    }
}

#[test]
fn the_omission_list_matches_serialized_values() {
    let anchor = Anchor {
        publication_id: Uuid::nil(),
        screen_path: "home".parse().unwrap(),
        viewport: Viewport::Desktop,
        color_scheme: ColorScheme::Light,
        element_path: None,
    };
    let grant = GrantView(GrantViewFields {
        id: None,
        user_id: UserId(Uuid::nil()),
        name: "Member".into(),
        role: Role::Member,
        inherited: true,
        version: None,
    });
    let plan = plan_response(
        "https://api.example.com",
        Plan {
            upload: PublicationId(Uuid::nil()),
            project: ProjectId(Uuid::nil()),
            expires_at: Utc::now(),
            missing: Vec::new(),
        },
        false,
    );
    let serialized = [
        to_value(anchor).unwrap(),
        to_value(grant).unwrap(),
        to_value(plan).unwrap(),
    ];
    for ((pointer, omitted), value) in OMITTED.into_iter().zip(serialized) {
        assert!(value.get(omitted).is_none(), "{pointer}: {omitted}");
        for name in document().pointer(pointer).unwrap()["properties"]
            .as_object()
            .unwrap()
            .keys()
        {
            assert_eq!(
                value.get(name).is_some(),
                name != omitted,
                "{pointer}: {name}"
            );
        }
    }
}

#[test]
fn every_error_variant_requires_its_request_id_and_its_data() {
    let variants = document()["components"]["schemas"]["Error"]["properties"]["error"]["oneOf"]
        .as_array()
        .unwrap();
    for variant in variants {
        let mut expected = vec!["code", "reason", "message", "request_id"];
        if variant["properties"].get("data").is_some() {
            expected.push("data");
        }
        assert_eq!(variant["required"], json!(expected));
    }
    let error = RpcError::from(ApiError::NotFound)
        .with_request_id("contract-test")
        .output();
    let error = to_value(error).unwrap();
    assert!(error["error"].get("data").is_none());
    assert_eq!(error["error"]["request_id"], "contract-test");
}
