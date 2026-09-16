#!/usr/bin/env bash
set -euo pipefail

if [ -z "${CLOUDFLARE_ACCOUNT_ID}" ] || [ -z "${CLOUDFLARE_API_TOKEN}" ]; then
  echo "status=retained: missing Cloudflare configuration" >> "${GITHUB_OUTPUT}"
  exit 0
fi

api_root="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PROJECT_NAME}"
deployments_file="$(mktemp)"
matches_file="$(mktemp)"
delete_file="$(mktemp)"
trap 'rm -f "${deployments_file}" "${matches_file}" "${delete_file}"' EXIT
page=1
while :; do
  if ! deployments_status="$(
    curl --silent --show-error --write-out "%{http_code}" --output "${deployments_file}" \
      --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      "${api_root}/deployments?per_page=100&page=${page}"
  )"; then
    echo "status=retained: failed to list Cloudflare deployments" >> "${GITHUB_OUTPUT}"
    exit 0
  fi

  if [ "${deployments_status}" -lt 200 ] || [ "${deployments_status}" -ge 300 ] ||
    ! jq -e '.success == true' "${deployments_file}" > /dev/null 2>&1; then
    list_error="$(jq -r '[.errors[]?.message] | join("; ")' "${deployments_file}" 2>/dev/null || true)"
    if [ -z "${list_error}" ]; then
      list_error="HTTP ${deployments_status}"
    else
      list_error="HTTP ${deployments_status}: ${list_error}"
    fi
    echo "status=retained: failed to list Cloudflare deployments (${list_error})" >> "${GITHUB_OUTPUT}"
    exit 0
  fi

  if ! jq -e '.result | type == "array"' "${deployments_file}" > /dev/null 2>&1 ||
    ! jq -r --arg branch "${PREVIEW_BRANCH}" '.result[] | select(.deployment_trigger.metadata.branch == $branch) | .id' "${deployments_file}" >> "${matches_file}"; then
    echo "status=retained: failed to parse Cloudflare deployments response" >> "${GITHUB_OUTPUT}"
    exit 0
  fi
  total_pages="$(jq -r '.result_info.total_pages // 0' "${deployments_file}")"
  page_count="$(jq '.result | length' "${deployments_file}")"
  if { [ "${total_pages}" -gt 0 ] && [ "${page}" -ge "${total_pages}" ]; } ||
    { [ "${total_pages}" -eq 0 ] && [ "${page_count}" -lt 100 ]; }; then
    break
  fi
  page=$((page + 1))
done

if [ ! -s "${matches_file}" ]; then
  echo "status=deleted: no matching branch deployments found" >> "${GITHUB_OUTPUT}"
  exit 0
fi

deleted_count=0
failed_delete_count=0
while IFS= read -r deployment_id; do
  [ -z "${deployment_id}" ] && continue
  if ! delete_status="$(
    curl --silent --show-error --write-out "%{http_code}" --output "${delete_file}" \
      --request DELETE \
      --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      "${api_root}/deployments/${deployment_id}?force=true"
  )"; then
    failed_delete_count=$((failed_delete_count + 1))
    echo "::warning title=Cloudflare deployment cleanup failed::Deployment ${deployment_id} delete request failed."
    continue
  fi
  if [ "${delete_status}" -ge 200 ] && [ "${delete_status}" -lt 300 ] &&
    jq -e '.success == true' "${delete_file}" > /dev/null 2>&1; then
    deleted_count=$((deleted_count + 1))
    continue
  fi
  delete_error="$(jq -r '[.errors[]?.message] | join("; ")' "${delete_file}" 2>/dev/null || true)"
  if [ -z "${delete_error}" ]; then
    delete_error="HTTP ${delete_status}"
  else
    delete_error="HTTP ${delete_status}: ${delete_error}"
  fi
  failed_delete_count=$((failed_delete_count + 1))
  echo "::warning title=Cloudflare deployment cleanup failed::Deployment ${deployment_id}: ${delete_error}"
done < "${matches_file}"

if [ "${failed_delete_count}" -gt 0 ]; then
  echo "status=retained: failed to delete ${failed_delete_count} Cloudflare deployment(s); deleted ${deleted_count}" >> "${GITHUB_OUTPUT}"
  exit 0
fi
echo "status=deleted: removed ${deleted_count} matching branch deployment(s)" >> "${GITHUB_OUTPUT}"
