//! Registry CSS names the component that rendered each rule.

use std::collections::BTreeSet;

use mokly_model::evidence::EvidenceOwner;

mod changes_support;
mod containment_support;

fn sources(color: &str) -> Vec<(String, String)> {
    vec![
        (
            "layout.mockup.tsx".into(),
            r#"
import {defineComponent} from '@mokly/mokly';
import {createGlobalStyle} from 'styled-components';
import {Global,css} from '@emotion/react';
import {stack} from './stack.mockup';
import {card} from './card.mockup';
const LayoutStyles=createGlobalStyle`.layout{border:1px solid red}`;
const LayoutEmotion=css`.layout-emotion{padding:1px}`;
export const layout=defineComponent({title:'Layout',description:'',relatedDocs:[],element:'ui-layout',propSchema:{type:'object',properties:{},additionalProperties:false},props:{},render:()=> <><LayoutStyles/><Global styles={LayoutEmotion}/><section className="layout layout-emotion"><stack.Component><card.Component/><card.Component moklyInstance="second"/></stack.Component></section></>});
"#
            .into(),
        ),
        (
            "stack.mockup.tsx".into(),
            format!(
                r#"
import {{defineComponent}} from '@mokly/mokly';
import {{createGlobalStyle}} from 'styled-components';
import {{Global,css}} from '@emotion/react';
const StackStyles=createGlobalStyle`.stack > * + *{{margin-top:8px;color:{color}}}`;
const StackEmotion=css`.stack-emotion > * + *{{padding-top:9px;color:{color}}}`;
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
            "---\ntitle: Home\n---\n<ui-layout></ui-layout>".into(),
        ),
    ]
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
    let page = review.entries.iter().find(|entry| entry.path == "home").unwrap();
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
