"""Pure PR lifecycle decision; untrusted metadata never becomes shell source."""

import json
import re
import sys


def decision(event):
    pr = event["pull_request"]
    repository_private = event["repository"].get("private")
    if type(repository_private) is not bool:
        raise ValueError("Invalid repository privacy flag")
    number = str(event["number"])
    revision = pr["head"]["sha"]
    if not re.fullmatch(r"[1-9][0-9]{0,8}", number) or not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("Invalid PR number or head SHA")
    action = "skip"
    same_repository = pr["head"]["repo"] and pr["head"]["repo"]["full_name"] == event["repository"]["full_name"]
    label = event.get("label", {}).get("name")
    if same_repository:
        if event["action"] == "closed" or (event["action"] == "unlabeled" and label == "preview"):
            action = "destroy"
        elif (pr["state"] == "open" and any(item["name"] == "preview" for item in pr["labels"]) and
              (event["action"] in ("synchronize", "reopened") or (event["action"] == "labeled" and label == "preview"))):
            action = "deploy"
    return {
        "action": action,
        "environment": "preview-pr-" + number,
        "revision": revision,
        "repository_private": str(repository_private).lower(),
    }


if __name__ == "__main__":
    for key, value in decision(json.load(open(sys.argv[1]))).items():
        print(key + "=" + value)
