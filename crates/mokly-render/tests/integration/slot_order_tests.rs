//! Nested supplied slots share the caller's logical input encounter order.

use std::fs;

use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};

use super::support::Consumer;

#[test]
fn nested_slot_inputs_keep_one_contiguous_order_per_supplier_scope() {
    let consumer = Consumer::new();
    fs::write(
        consumer.root().join("mokly.config.json"),
        r#"{"roots":[{"dir":"specs","files":["order.mockup.tsx"]}]}"#,
    )
    .unwrap();
    fs::write(consumer.root().join("specs/order.mockup.tsx"), r#"
import React from 'react';
import {defineComponent,defineScreen} from '@mokly/mokly';
const schema={type:'object',additionalProperties:false,properties:{}};
export const box=defineComponent({path:'box',title:'Box',description:'',relatedDocs:[],propSchema:schema,props:{},slots:['children'],render:props=><section>{props.children}</section>});
export const leaf=defineComponent({path:'leaf',title:'Leaf',description:'',relatedDocs:[],propSchema:schema,props:{},render:()=> <b>Leaf</b>});
export const screen=defineScreen({path:'screen',title:'Screen',description:'',relatedDocs:[],props:{},render:()=> <box.Component moklyInstance="outer"><leaf.Component moklyInstance="first"/><box.Component moklyInstance="inner"><leaf.Component moklyInstance="last"/></box.Component></box.Component>});
"#).unwrap();
    let generation = consumer.generation(consumer.prepare().unwrap());
    let document = generation.render("screen/index.mobile.html").unwrap();
    let CatalogueUsage::Ready {
        instances, slots, ..
    } = &document.document.as_ref().unwrap().usage
    else {
        panic!("ready usage")
    };
    assert_eq!(instances.len(), 4);
    assert_eq!(slots.len(), 2);
    let first = instances
        .iter()
        .find(|instance| instance.id == "first")
        .unwrap();
    for (id, order) in [("first", 0), ("inner", 1), ("last", 2)] {
        let instance = instances.iter().find(|instance| instance.id == id).unwrap();
        assert_eq!(instance.order, order);
        assert!(matches!(instance.owner, ComponentInputOwner::Entry));
        assert_eq!(instance.slot_key, first.slot_key);
    }
}
