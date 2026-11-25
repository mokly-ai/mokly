//! The built CLI keeps repeated supplier claims separate through Git comparison.

use mokly_model::evidence::EvidenceOwner;
use mokly_model::review::ReviewState;

mod changes_support;
mod containment_support;
#[path = "../../../tests/rust/supplier_fixture.rs"]
#[expect(
    dead_code,
    reason = "this binary uses only the repeated supplier fixture"
)]
mod supplier_fixture;

use supplier_fixture::repeated;

#[test]
fn repeated_supplier_path_preserves_exact_owned_proof_and_physical_head_proof() {
    let review = containment_support::build(repeated("red"), repeated("blue"));
    assert_eq!(
        review
            .entries
            .iter()
            .filter(|entry| entry.included)
            .map(|entry| entry.path.as_str())
            .collect::<Vec<_>>(),
        ["child", "parent"]
    );
    for path in ["home", "whole"] {
        let consumer = review
            .entries
            .iter()
            .find(|entry| entry.path == path)
            .unwrap();
        assert!(
            consumer
                .views
                .iter()
                .all(|view| view.state == ReviewState::Unchanged)
        );
        for view in &consumer.views {
            let owners: Vec<_> = view.rules.iter().map(|rule| rule.owner.clone()).collect();
            let mut expected = vec![EvidenceOwner::Component {
                path: "child".into(),
            }];
            expected.push(EvidenceOwner::Component {
                path: "parent".into(),
            });
            assert_eq!(owners, expected);
        }
    }
}

#[test]
fn a_repeated_receiving_component_cannot_take_the_intermediate_owners_claim() {
    let before = repeated_receiver_sources(1);
    let after = repeated_receiver_sources(2);
    let review = containment_support::build(before, after);
    let home = review
        .entries
        .iter()
        .find(|entry| entry.path == "home")
        .unwrap();
    for view in &home.views {
        let owners: Vec<_> = view.rules.iter().map(|rule| rule.owner.clone()).collect();
        assert_eq!(
            owners,
            vec![
                EvidenceOwner::Component {
                    path: "child".into()
                },
                EvidenceOwner::Component {
                    path: "parent".into()
                }
            ]
        );
    }
}

fn repeated_receiver_sources(margin: u8) -> Vec<(String, String)> {
    vec![
        ("parent.mockup.tsx".into(),r#"import {defineComponent} from '@mokly/mokly'; import {createGlobalStyle} from 'styled-components'; import {child} from './child.mockup'; import {rule} from './rule'; const Styles=createGlobalStyle`${rule}`; export const parent=defineComponent({title:'Parent',description:'',relatedDocs:[],element:'ui-parent',propSchema:{type:'object',additionalProperties:false,required:['outer'],properties:{outer:{type:'boolean'}}},props:{outer:false},slots:['children'],render:props=><><Styles/>{props.outer ? <child.Component preview={false}><span className='hit'>Supplied</span></child.Component> : <section>{props.children ?? <p className='hit'>Parent own</p>}</section>}</>});"#.into()),
        ("child.mockup.tsx".into(),r#"import {defineComponent} from '@mokly/mokly'; import {parent} from './parent.mockup'; import {rule} from './rule'; export const child=defineComponent({title:'Child',description:'',relatedDocs:[],element:'ui-child',propSchema:{type:'object',additionalProperties:false,required:['preview'],properties:{preview:{type:'boolean'}}},props:{preview:true},slots:['children'],render:props=><><style>{rule}</style>{props.preview && <p className='hit'>Child own</p>}<parent.Component outer={false}>{props.children}</parent.Component></>});"#.into()),
        ("home.screen.html".into(),r#"---
title: Home
---
<ui-parent outer='true'></ui-parent>"#.into()),
        ("rule.ts".into(),format!("export const rule='.hit{{margin-left:{margin}px}}';")),
    ]
}
