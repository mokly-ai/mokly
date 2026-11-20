import assert from "node:assert/strict";
import { test } from "node:test";

import { controlLabels } from "./control-labels";

test("control labels survive DOM backend attribute order and text elements", () => {
  for (const label of [
    '<div dir="auto" class="legacy">Save</div>',
    '<div class="firna-text" style="color:black" dir="auto">Save</div>',
    '<span class="firna-text"><strong>Save</strong></span>',
  ])
    assert.deepEqual(
      controlLabels(
        '<button data-testid="firna-button-primary">' + label + "</button>",
      ),
      ["Save"],
    );
});

test("a control without label text cannot borrow the next control's label", () => {
  assert.deepEqual(
    controlLabels(
      '<button data-testid="firna-button-quiet"><svg aria-hidden="true"></svg></button>' +
        '<button data-testid="firna-button-primary"><div dir="auto">Save</div></button>' +
        '<div dir="auto">Other screen copy</div>',
    ),
    ["Save"],
  );
});

test("radio option labels are independent of attribute order", () => {
  assert.deepEqual(
    controlLabels('<button role="radio" aria-label="Private"></button>'),
    ["Private"],
  );
});

test("control labels decode entities and normalize formatting whitespace", () => {
  assert.deepEqual(
    controlLabels(
      '<a data-testid="firna-button-primary"><span>Save &amp;\n continue</span></a>',
    ),
    ["Save & continue"],
  );
});
