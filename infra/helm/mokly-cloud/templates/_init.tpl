{{- define "mkc.namespaceInit" -}}
{{- /* API: wait for Postgres (at most 300 s), then run the release image's migrations. Catalogue: wait for the API health at the intended revision through files/wait-for-api.mjs (at most 600 s). */ -}}
{{- if eq .workload "api" -}}
- name: wait-for-postgres
  image: {{ .root.Values.postgres.image | quote }}
  command: [timeout, "300", bash, -ec]
  args:
    - |
      until pg_isready -d "$MKC_DATABASE_URL" >/dev/null 2>&1; do
        sleep 2
      done
  env:
    {{- include "mkc.databaseEnv" (dict "root" .root "identity" "api") | nindent 4 }}
  securityContext:
    {{- include "mkc.security" .root | nindent 4 }}
  resources:
    {{- toYaml .root.Values.postgres.resources | nindent 4 }}
- name: migrate
  image: {{ .root.Values.api.image | quote }}
  args: [migrate]
  env:
    {{- include "mkc.databaseEnv" (dict "root" .root "identity" "api") | nindent 4 }}
  securityContext:
    {{- include "mkc.security" .root | nindent 4 }}
  resources:
    {{- toYaml .root.Values.api.resources | nindent 4 }}
{{- else if eq .workload "catalogue" -}}
- name: wait-for-api
  image: {{ .root.Values.app.image | quote }}
  command: [node, --input-type=module, -e]
  args:
    - |
      {{- .root.Files.Get "files/wait-for-api.mjs" | trimSuffix "\n" | nindent 6 }}
  env:
    - name: MKC_EXPECTED_REVISION
      value: {{ .root.Values.revision | quote }}
  securityContext:
    {{- include "mkc.security" .root | nindent 4 }}
  resources:
    {{- toYaml .root.Values.app.resources | nindent 4 }}
{{- end -}}
{{- end -}}
