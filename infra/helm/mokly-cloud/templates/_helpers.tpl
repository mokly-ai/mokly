{{- define "mkc.environment" -}}
{{- if eq .Values.environment "preview-pr" -}}
{{- printf "preview-pr-%v" .Values.prNumber -}}
{{- else -}}{{ .Values.environment }}{{- end -}}
{{- end -}}

{{- define "mkc.previewLabel" -}}
{{- $environment := include "mkc.environment" . -}}
{{- if hasPrefix "preview-pr-" $environment -}}
{{- printf "pr-%s" (trimPrefix "preview-pr-" $environment) -}}
{{- else -}}
{{- printf "br-%s" (trimSuffix "-preview" $environment) -}}
{{- end -}}
{{- end -}}

{{- define "mkc.catalogueDomain" -}}
{{- $environment := include "mkc.environment" . -}}
{{- if eq $environment "production" -}}
{{- .Values.catalogueBaseDomain -}}
{{- else -}}
{{- printf "%s.preview.%s" (include "mkc.previewLabel" .) .Values.catalogueBaseDomain -}}
{{- end -}}
{{- end -}}

{{- define "mkc.host" -}}
{{- $environment := include "mkc.environment" .root -}}
{{- if eq .kind "catalogue" -}}
{{- include "mkc.catalogueDomain" .root -}}
{{- else if eq .kind "app" -}}
{{- if eq .root.Values.environment "preview-pr" -}}
{{- printf "app-origin-%s.preview.%s" (include "mkc.previewLabel" .root) .root.Values.domain -}}
{{- else -}}
{{- $suffix := "" -}}
{{- if ne $environment "production" -}}
{{- $suffix = printf "-%s" $environment -}}
{{- end -}}
{{- printf "app-origin%s.%s" $suffix .root.Values.domain -}}
{{- end -}}
{{- else if eq .kind "api" -}}
{{- if eq $environment "production" -}}
{{- printf "api.%s" .root.Values.domain -}}
{{- else -}}
{{- printf "%s.preview.api.%s" (include "mkc.previewLabel" .root) .root.Values.domain -}}
{{- end -}}
{{- else -}}
{{- fail "Unknown workload host kind" -}}
{{- end -}}
{{- end -}}

{{- define "mkc.publicAppOrigin" -}}
{{- if eq (include "mkc.environment" .) "production" -}}
{{- printf "https://%s" .Values.domain -}}
{{- else -}}
{{- printf "https://%s.preview.%s" (include "mkc.previewLabel" .) .Values.domain -}}
{{- end -}}
{{- end -}}

{{- define "mkc.validate" -}}
{{- $env := include "mkc.environment" . -}}
{{- if not (regexMatch "^(production|main-preview|preview-pr-[1-9][0-9]{0,8})$" $env) -}}
{{- fail "Invalid environment or PR number" -}}
{{- end -}}
{{- if eq .Values.environment "preview-pr" -}}
{{- if ne .Values.database.mode "namespace" -}}{{ fail "PR previews require database.mode=namespace" }}{{- end -}}
{{- if .Values.resetDatabase -}}{{ fail "PR previews reset by deleting their namespace" }}{{- end -}}
{{- if .Values.github.enabled -}}{{ fail "PR previews cannot enable GitHub configuration" }}{{- end -}}
{{- if ne .Values.preview.signInEmail "preview@mokly.ai" -}}{{ fail "PR previews require the preview sign-in account" }}{{- end -}}
{{- if or (ne (int .Values.scaling.minReplicas) 1) (ne (int .Values.scaling.maxReplicas) 1) .Values.pdb.enabled -}}
{{- fail "PR previews require single replicas and no PDB" -}}
{{- end -}}
{{- if or (ne (toString .Values.api.trustedProxyHops) "2") (ne (toJson .Values.api.trustedProxyCidrs) (toJson (list "10.24.0.0/14"))) -}}
{{- fail "PR previews require two trusted proxy hops and the pod CIDR" -}}
{{- end -}}
{{- if or (ne (toString .Values.api.port) "8080") (ne .Values.api.healthPath "/v1/health") -}}
{{- fail "PR previews require api:8080/v1/health for the catalogue startup gate" -}}
{{- end -}}
{{- else -}}
{{- if ne .Values.database.mode "cloudsql" -}}{{ fail "Stable environments require database.mode=cloudsql" }}{{- end -}}
{{- end -}}
{{- if and (ne .Values.environment "preview-pr") .Values.preview.signInEmail -}}{{ fail "Stable environments cannot configure preview sign-in" }}{{- end -}}
{{- if ne .Release.Namespace (printf "mkc-%s" $env) -}}
{{- fail "Namespace must match mkc-<environment>" -}}
{{- end -}}
{{- if not (regexMatch "^[a-z0-9][a-z0-9.-]*[.][a-z]+$" .Values.domain) -}}
{{- fail "Set the real domain" -}}
{{- end -}}
{{- if or (not (regexMatch "^[a-z0-9][a-z0-9.-]*[.][a-z]+$" .Values.catalogueBaseDomain)) (eq .Values.domain .Values.catalogueBaseDomain) -}}
{{- fail "Set an independent catalogue base domain" -}}
{{- end -}}
{{- if not (regexMatch "^[0-9]+[.][0-9]+[.][0-9]+[.][0-9]+$" .Values.ingressAddress) -}}
{{- fail "Set the reserved ingress IPv4 address" -}}
{{- end -}}
{{- if not (regexMatch "^[a-f0-9]{40}$" .Values.revision) -}}
{{- fail "Set the built Git revision" -}}
{{- end -}}
{{- if and (not (hasPrefix "preview-pr-" $env)) (not .Values.postmarkFrom) -}}{{ fail "Set postmarkFrom" }}{{- end -}}
{{- if .Values.github.enabled -}}
{{- if or (not (regexMatch "^[1-9][0-9]*$" .Values.github.appId)) (not .Values.github.clientId) (not (regexMatch "^[A-Za-z0-9-]+$" .Values.github.appSlug)) -}}
{{- fail "GitHub App requires appId, clientId and appSlug" -}}
{{- end -}}
{{- end -}}
{{- if .Values.billing.enabled -}}
{{- if hasPrefix "preview-pr-" $env -}}
{{- fail "Billing is not enabled in PR environments" -}}
{{- end -}}
{{- end -}}
{{- include "mkc.validateBuilds" . -}}
{{- range $name := list "api" "app" "catalogue" -}}
{{- $workload := index $.Values $name -}}
{{- if $workload.enabled -}}
{{- if not (regexMatch "^[a-zA-Z0-9./:_-]+@sha256:[a-f0-9]{64}$" $workload.image) -}}
{{- fail (printf "%s needs a built image pinned by digest" $name) -}}
{{- end -}}
{{- if not (hasPrefix "/" $workload.healthPath) -}}
{{- fail (printf "%s needs its implemented health path" $name) -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- include "mkc.validateRuntimeEnv" . -}}
{{- end -}}
