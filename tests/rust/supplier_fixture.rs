//! Supplier, child-element, and self-copy fixtures shared by both acceptance layers.

pub fn sources(case: &str, color: &str) -> Vec<(String, String)> {
    let child = "import {defineComponent} from '@mokly/mokly'; export const child=defineComponent({title:'Layout',description:'',relatedDocs:[],element:'ui-layout',propSchema:{type:'object',properties:{},additionalProperties:false},props:{},slots:['children'],render:props=><section className='child'>{props.children}</section>});";
    let (selector, body) = match case {
        "title" => (
            ".unused",
            "<child.Component><Title>Title</Title></child.Component>",
        ),
        "slot" => (
            ".slot",
            "<child.Component><h1 className='slot'>Supplied</h1></child.Component>",
        ),
        "element" => (".child", "<child.Component/>"),
        "self" => (".leaf", "<card.Component outer={false}/>"),
        _ => unreachable!(),
    };
    let render = if case == "self" {
        format!(
            "props=>props.outer ? <main>{body}</main> : <><Styles/><p className='leaf'>Leaf</p></>"
        )
    } else {
        format!("()=> <><Styles/>{body}</>")
    };
    let schema = if case == "self" {
        "propSchema:{type:'object',properties:{outer:{type:'boolean'}},required:['outer'],additionalProperties:false},props:{outer:true},"
    } else {
        "propSchema:{type:'object',properties:{},additionalProperties:false},props:{},"
    };
    let card = format!(
        "import {{defineComponent}} from '@mokly/mokly'; import styled,{{createGlobalStyle}} from 'styled-components'; import {{child}} from './child.mockup'; const Styles=createGlobalStyle`{selector}{{color:{color}}}`; const Title=styled.h1`color:{color}`; export const card=defineComponent({{title:'Card',description:'',relatedDocs:[],element:'ui-card',{schema}render:{render}}});"
    );
    let props = if case == "self" { " outer='true'" } else { "" };
    vec![
        ("child.mockup.tsx".into(), child.into()),
        ("card.mockup.tsx".into(), card),
        (
            "home.screen.html".into(),
            format!("---\ntitle: Home\n---\n<ui-card{props}></ui-card>"),
        ),
    ]
}

pub fn repeated(color: &str) -> Vec<(String, String)> {
    vec![
        ("styles.tsx".into(), format!("import {{createGlobalStyle}} from 'styled-components'; export const Styles=createGlobalStyle`.slot{{color:{color}}}`;")),
        ("parent.mockup.tsx".into(), "import {defineComponent} from '@mokly/mokly'; import {child} from './child.mockup'; import {Styles} from './styles'; export const parent=defineComponent({title:'Parent',description:'',relatedDocs:[],element:'ui-parent',propSchema:{type:'object',additionalProperties:false,required:['outer'],properties:{outer:{type:'boolean'}}},props:{outer:false},slots:['children'],render:props=>props.outer ? <><Styles/><child.Component><span className='slot'>Supplier</span></child.Component></> : <section>{props.children ?? <p>Empty</p>}</section>});".into()),
        ("child.mockup.tsx".into(),"import {defineComponent} from '@mokly/mokly'; import {parent} from './parent.mockup'; import {Styles} from './styles'; export const child=defineComponent({title:'Child',description:'',relatedDocs:[],element:'ui-child',propSchema:{type:'object',additionalProperties:false,properties:{}},props:{},slots:['children'],render:props=><><Styles/><p className='slot'>Child own</p><parent.Component outer={false}>{props.children}</parent.Component></>});".into()),
        ("home.screen.html".into(),"---\ntitle: Home\n---\n<ui-parent outer='true'></ui-parent>".into()),
        ("whole.mockup.tsx".into(),"import {defineScreen} from '@mokly/mokly'; import {parent} from './parent.mockup'; export const whole=defineScreen({title:'Whole',description:'',relatedDocs:[],render:()=> <parent.Component outer={true}/>});".into()),
    ]
}
