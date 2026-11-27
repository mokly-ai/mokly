//! Supplier fixtures shared by both acceptance layers: the Layout/Title case and a repeated
//! supplier path.

/// A card that styles the `Title` it passes into its child's slot.
pub fn sources(color: &str) -> Vec<(String, String)> {
    let child = "import {defineComponent} from '@mokly/mokly'; export const child=defineComponent({title:'Layout',description:'',relatedDocs:[],element:'ui-layout',propSchema:{type:'object',properties:{},additionalProperties:false},props:{},slots:['children'],render:props=><section className='child'>{props.children}</section>});";
    let card = format!(
        "import {{defineComponent}} from '@mokly/mokly'; import styled,{{createGlobalStyle}} from 'styled-components'; import {{child}} from './child.mockup'; const Styles=createGlobalStyle`.unused{{color:{color}}}`; const Title=styled.h1`color:{color}`; export const card=defineComponent({{title:'Card',description:'',relatedDocs:[],element:'ui-card',propSchema:{{type:'object',properties:{{}},additionalProperties:false}},props:{{}},render:()=> <><Styles/><child.Component><Title>Title</Title></child.Component></>}});"
    );
    vec![
        ("child.mockup.tsx".into(), child.into()),
        ("card.mockup.tsx".into(), card),
        (
            "home.screen.html".into(),
            "---\ntitle: Home\n---\n<ui-card></ui-card>".into(),
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
