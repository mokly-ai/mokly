"""Round-trip SHA grammar agreement across admission, Postgres and OpenAPI."""

import json
from pathlib import Path
import re

from publication_exchange import ENVELOPE, current_only_files, plan, plan_archive, publish, reason, with_marker


def sha_contract(api, project, token, fixture_files):
    spec = json.loads((Path(__file__).parents[2] / "docs/api/openapi.json").read_text())
    field = spec["components"]["schemas"]["Publication"]["properties"]["headSha"]
    pattern = re.compile(field["pattern"])
    constraint = api.sql("""SELECT pg_get_constraintdef(oid) FROM pg_constraint
        WHERE conrelid='publications'::regclass AND conname='publications_head_sha_check'""")
    database_pattern = re.search(r"'([^']+)'", constraint)[1]
    files = current_only_files(fixture_files)
    manifest = json.loads(files[ENVELOPE])
    manifest.update(branch="sha-contract")
    cases = [("0123456789abcdef" * 3, False),
             (("0123456789abcdef" * 3)[:40], True),
             ("0123456789abcdef" * 4, True)]
    cases += [("a" * size, False) for size in [0, 39, 41, 63, 65]]
    cases += [(value, False) for value in ["A" * 40, "g" * 64, " " + "a" * 40,
                                          "a" * 40 + "\n", "é" * 40]]
    for head, expected in cases:
        assert bool(pattern.fullmatch(head)) == expected, ("OpenAPI", head)
        literal = head.replace("'", "''")
        assert (api.sql(f"SELECT '{literal}' ~ '{database_pattern}'") == "t") == expected, ("database CHECK", head)
        manifest["headSha"] = head
        files[ENVELOPE] = json.dumps(manifest).encode()
        owned = with_marker(files)
        if not expected:
            assert reason(plan(api, project, token["secret"], plan_archive(owned), 400)) == "upload-invalid-bundle"
        else:
            result = publish(api, project, token["secret"], owned)
            path = "/v1/projects/" + project["id"] + "/publications/" + result["id"]
            view, _ = api.call("GET", path)
            assert view["headSha"] == head
            assert pattern.fullmatch(view["headSha"])
            assert api.sql(f"SELECT head_sha FROM publications WHERE id='{result['id']}'") == head
    print("PASS SHA grammar: contract admission, database CHECK and OpenAPI round-trip agree")
