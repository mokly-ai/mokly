//! Fixed-seed edit sequences compare the public incremental builder with the full reference.

use mokly_catalogue::render_sources::RenderMethod;

use super::support::{A, B, C, Fixture};

fn next(state: &mut u64) -> usize {
    *state = state
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add(1);
    (*state >> 32) as usize
}

#[test]
fn fixed_seed_graph_edit_sequences_keep_full_reference_keys() {
    for seed in [7, 31, 113, 997] {
        let mut state = seed;
        let mut fixture = Fixture::new();
        for index in 0..20 {
            let path = format!("generated/{index}/module.ts");
            let imports = (0..3)
                .map(|_| format!("generated/{}/module.ts", next(&mut state) % 24))
                .collect();
            fixture.generation.modules.insert(path.clone(), imports);
            fixture.digest(&path, &format!("source:{index}"));
        }
        for (module, index) in [(A, 0), (B, 6), (C, 12)] {
            fixture
                .generation
                .modules
                .get_mut(module)
                .unwrap()
                .push(format!("generated/{index}/module.ts"));
        }
        let mut previous = fixture.check(None, &format!("seed={seed}, initial"));
        for step in 0..72 {
            let index = next(&mut state) % 24;
            let module = format!("generated/{index}/module.ts");
            let target = format!("generated/{}/module.ts", next(&mut state) % 24);
            let value = format!("seed={seed}, step={step}");
            match step % 12 {
                0 => fixture.digest(A, &value),
                1 => fixture.digest(&module, &value),
                2 => {
                    fixture
                        .generation
                        .modules
                        .entry(module)
                        .or_default()
                        .push(target);
                }
                3 => {
                    fixture.generation.modules.entry(module).or_default().pop();
                }
                4 => {
                    fixture
                        .generation
                        .modules
                        .entry(module)
                        .or_default()
                        .reverse();
                }
                5 => {
                    fixture.generation.modules.remove(&module);
                }
                6 => {
                    fixture.generation.modules.insert(module, vec![target]);
                }
                7 => {
                    fixture
                        .generation
                        .resolution_digests
                        .insert(format!("generated/{index}/tsconfig.json"), value);
                }
                8 => {
                    fixture
                        .bindings
                        .get_mut(&format!("{B}#default"))
                        .unwrap()
                        .title = value;
                }
                9 => {
                    fixture.declarations.insert(format!("{C}#default"), module);
                }
                10 => {
                    fixture.entries.get_mut("story").unwrap().method = if index.is_multiple_of(2) {
                        RenderMethod::Story
                    } else {
                        RenderMethod::Screen
                    };
                }
                _ => {
                    fixture.generation.environment = value;
                }
            }
            previous = fixture.check(Some(&previous), &format!("seed={seed}, step={step}"));
        }
    }
}
