//! Registry CSS names the component that rendered each rule.

use std::collections::BTreeSet;

use mokly_model::evidence::EvidenceOwner;

mod changes_support;
mod containment_support;

fn sources(color: &str) -> Vec<(String, String)> {
    sources_with(color, "red", "<ui-layout></ui-layout>")
}

fn sources_with(stack_color: &str, layout_color: &str, screen_body: &str) -> Vec<(String, String)> {
    vec![
        (
            "layout.mockup.tsx".into(),
            r#"
import {defineComponent} from '@mokly/mokly';
import {createGlobalStyle} from 'styled-components';
import {Global,css} from '@emotion/react';
import {stack} from './stack.mockup';
import {card} from './card.mockup';
const LayoutStyles=createGlobalStyle`.layout{border:1px solid {layout_color}}`;
const LayoutEmotion=css`.layout-emotion{padding:1px}`;
export const layout=defineComponent({title:'Layout',description:'',relatedDocs:[],element:'ui-layout',propSchema:{type:'object',properties:{},additionalProperties:false},props:{},render:()=> <><LayoutStyles/><Global styles={LayoutEmotion}/><section className="layout layout-emotion"><stack.Component><card.Component/><card.Component moklyInstance="second"/></stack.Component></section></>});
"#
                .replace("{layout_color}", layout_color),
        ),
        (
            "stack.mockup.tsx".into(),
            format!(
                r#"
import {{defineComponent}} from '@mokly/mokly';
import {{createGlobalStyle}} from 'styled-components';
import {{Global,css}} from '@emotion/react';
const StackStyles=createGlobalStyle`.stack > * + *{{margin-top:8px;color:{stack_color}}}`;
const StackEmotion=css`.stack-emotion > * + *{{padding-top:9px;color:{stack_color}}}`;
export const stack=defineComponent({{title:'Stack',description:'',relatedDocs:[],element:'ui-stack',propSchema:{{type:'object',properties:{{}},additionalProperties:false}},props:{{}},slots:['children'],render:props=> <><StackStyles/><Global styles={{StackEmotion}}/><div className="stack stack-emotion">{{props.children}}</div></>}});
"#
            ),
        ),
        (
            "card.mockup.tsx".into(),
            r#"
import {defineComponent} from '@mokly/mokly';
export const card=defineComponent({title:'Card',description:'',relatedDocs:[],element:'ui-card',propSchema:{type:'object',properties:{},additionalProperties:false},props:{},render:()=> <article className="card">Card</article>});
"#
            .into(),
        ),
        (
            "home.screen.html".into(),
            format!("---\ntitle: Home\n---\n{screen_body}"),
        ),
    ]
}

#[test]
fn layout_registry_rule_for_supplied_cards_stays_with_layout() {
    let review = containment_support::build(
        sources_with("red", "red", "<ui-layout></ui-layout>"),
        sources_with("red", "blue", "<ui-layout></ui-layout>"),
    );
    let changed: Vec<_> = review
        .entries
        .iter()
        .filter(|entry| entry.included)
        .map(|entry| entry.path.as_str())
        .collect();
    assert_eq!(changed, ["layout"]);
    assert!(
        !review
            .affected
            .iter()
            .any(|row| row.changed_component_id == "stack")
    );
}

#[test]
fn screen_registry_rule_keeps_stack_without_a_direct_screen_row() {
    let review = containment_support::build(
        sources_with(
            "red",
            "red",
            "<ui-stack><ui-card></ui-card><ui-card mokly-instance='second'></ui-card></ui-stack>",
        ),
        sources_with(
            "blue",
            "red",
            "<ui-stack><ui-card></ui-card><ui-card mokly-instance='second'></ui-card></ui-stack>",
        ),
    );
    let changed: Vec<_> = review
        .entries
        .iter()
        .filter(|entry| entry.included)
        .map(|entry| entry.path.as_str())
        .collect();
    assert_eq!(changed, ["stack"]);
    assert!(!changed.contains(&"home"));
}

#[test]
fn component_registry_rules_keep_their_rendering_component_owner() {
    let review = containment_support::build(sources("blue"), sources("green"));
    let changed: Vec<_> = review
        .entries
        .iter()
        .filter(|entry| entry.included)
        .map(|entry| entry.path.as_str())
        .collect();
    assert_eq!(changed, ["stack"]);
    let affected: BTreeSet<_> = review
        .affected
        .iter()
        .map(|row| {
            (
                row.changed_component_id.as_str(),
                row.consumer.path.as_str(),
            )
        })
        .collect();
    assert_eq!(
        affected,
        BTreeSet::from([("stack", "home"), ("stack", "layout")])
    );
    let page = review
        .entries
        .iter()
        .find(|entry| entry.path == "home")
        .unwrap();
    for view in &page.views {
        let owners: BTreeSet<_> = view
            .rules
            .iter()
            .filter_map(|rule| match &rule.owner {
                EvidenceOwner::Component { path } => Some(path.as_str()),
                EvidenceOwner::Entry => None,
            })
            .collect();
        assert_eq!(owners, BTreeSet::from(["stack"]));
        assert!(view.rules.iter().all(|rule| rule.selector != ".layout"));
    }
}
