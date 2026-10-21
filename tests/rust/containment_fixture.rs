//! The Stack, Card, and Button catalogue shared by render and built-CLI tests.

#[derive(Clone, Copy, Debug)]
pub enum Edit {
    Button,
    Card,
    Page,
    Stack,
    Both,
}

#[derive(Clone, Copy, Debug)]
pub struct Case {
    pub edit: Edit,
    pub preview: bool,
    pub head_style: bool,
}

pub const CASES: [Case; 8] = [
    Case {
        edit: Edit::Button,
        preview: true,
        head_style: false,
    },
    Case {
        edit: Edit::Card,
        preview: true,
        head_style: false,
    },
    Case {
        edit: Edit::Page,
        preview: true,
        head_style: false,
    },
    Case {
        edit: Edit::Stack,
        preview: true,
        head_style: false,
    },
    Case {
        edit: Edit::Stack,
        preview: false,
        head_style: false,
    },
    Case {
        edit: Edit::Stack,
        preview: true,
        head_style: true,
    },
    Case {
        edit: Edit::Stack,
        preview: false,
        head_style: true,
    },
    Case {
        edit: Edit::Both,
        preview: true,
        head_style: false,
    },
];

const BUTTON: &str = r#"
import {defineComponent} from '@mokly/mokly';
import {createGlobalStyle} from 'styled-components';
import {buttonRule} from './rules';
const Styles=createGlobalStyle`${buttonRule}`;
export const button=defineComponent({title:'Button',description:'',relatedDocs:[],element:'ui-button',
  propSchema:{type:'object',properties:{},additionalProperties:false},props:{},
  render:()=> <><Styles/><button className="button">Button</button></>});
"#;

const CARD: &str = r#"
import {defineComponent} from '@mokly/mokly';
import {createGlobalStyle} from 'styled-components';
import {button} from './button.mockup';
import {cardRule} from './rules';
const Styles=createGlobalStyle`${cardRule}`;
export const card=defineComponent({title:'Card',description:'',relatedDocs:[],element:'ui-card',
  propSchema:{type:'object',properties:{title:{type:'string'}},required:['title'],additionalProperties:false},
  props:{title:'Preview'},render:props=> <><Styles/><article className="card item">
    <h1>{props.title}</h1><button.Component/></article></>});
"#;

const STACK: &str = r#"
import {defineComponent} from '@mokly/mokly';
import {createGlobalStyle} from 'styled-components';
import {stackRule} from './rules';
import {preview,headStyle} from './settings';
const Styles=createGlobalStyle`${stackRule}`;
export const stack=defineComponent({title:'Stack',description:'',relatedDocs:[],element:'ui-stack',
  propSchema:{type:'object',properties:{},additionalProperties:false},props:{},slots:['children'],
  render:props=> <>{headStyle ? (!props.children && <style>{stackRule}</style>) : <Styles/>}
    <div className="stack">{props.children ?? (preview ? <><i className="item">A</i><i className="item">B</i></> : null)}</div></>});
"#;

const PAGE: &str = r#"
import {defineScreen} from '@mokly/mokly';
import {stack} from './stack.mockup';
import {card} from './card.mockup';
import {stackRule,pageRule} from './rules';
import {headStyle} from './settings';
export const page=defineScreen({title:'Page',description:'',relatedDocs:[],
  render:()=> <><style>{headStyle ? stackRule : pageRule}</style>
    <stack.Component><card.Component moklyInstance="a" title="A"/><card.Component moklyInstance="b" title="B"/></stack.Component></>});
"#;

/// Keep styles and markup stable except for the selected declaration edit.
pub fn sources(case: Case, changed: bool) -> Vec<(String, String)> {
    let button = if changed && matches!(case.edit, Edit::Button | Edit::Both) {
        "blue"
    } else {
        "red"
    };
    let margin = if changed && matches!(case.edit, Edit::Card) {
        16
    } else {
        8
    };
    let spacing = if changed && matches!(case.edit, Edit::Stack | Edit::Both) {
        16
    } else {
        8
    };
    let border = if changed && matches!(case.edit, Edit::Page) {
        "blue"
    } else {
        "red"
    };
    let mut files = vec![
        ("button.mockup.tsx".into(), BUTTON.into()),
        ("card.mockup.tsx".into(), CARD.into()),
        ("stack.mockup.tsx".into(), STACK.into()),
        (
            "settings.ts".into(),
            format!(
                "export const preview={}; export const headStyle={};",
                case.preview, case.head_style
            ),
        ),
        (
            "rules.ts".into(),
            format!(
                "export const buttonRule='.button{{color:{button}}}';\nexport const cardRule='.card .button{{margin-left:{margin}px}}';\nexport const stackRule='.stack > * + *{{margin-top:{spacing}px}}';\nexport const pageRule='.card{{border:1px solid {border}}}';"
            ),
        ),
    ];
    if case.head_style || matches!(case.edit, Edit::Page) {
        files.push(("page.mockup.tsx".into(), PAGE.into()));
    } else {
        files.push(("page.screen.html".into(), "---\ntitle: Page\n---\n<ui-stack><ui-card mokly-instance=\"a\" title=\"A\"></ui-card><ui-card mokly-instance=\"b\" title=\"B\"></ui-card></ui-stack>".into()));
    }
    files
}

/// Use native CSS nesting for the Stack rule while preserving the case axes.
pub fn nested_sources(case: Case, changed: bool) -> Vec<(String, String)> {
    let mut files = sources(case, changed);
    let spacing = if changed && matches!(case.edit, Edit::Stack | Edit::Both) {
        16
    } else {
        8
    };
    let flat = format!("'.stack > * + *{{margin-top:{spacing}px}}'");
    let nested = format!("'.stack {{ & > * + * {{ margin-top:{spacing}px }} }}'");
    let rules = files
        .iter_mut()
        .find(|(path, _)| path == "rules.ts")
        .unwrap();
    rules.1 = rules.1.replace(&flat, &nested);
    files
}
