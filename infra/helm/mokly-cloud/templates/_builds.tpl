{{- define "mkc.validBuildIpv4" -}}
{{- $pattern := "^(0|[1-9][0-9]{0,2})([.](0|[1-9][0-9]{0,2})){3}$" -}}
{{- if .network -}}{{- $pattern = "^[0-9]{1,3}([.][0-9]{1,3}){3}$" -}}{{- end -}}
{{- $valid := regexMatch $pattern .address -}}
{{- range splitList "." .address -}}
{{- if gt (atoi .) 255 -}}{{- $valid = false -}}{{- end -}}
{{- end -}}
{{- if $valid -}}true{{- end -}}
{{- end -}}

{{- define "mkc.validBuildDestination" -}}
{{- $parts := splitList "/" (trim .) -}}
{{- $address := index $parts 0 -}}
{{- $network := eq (len $parts) 2 -}}
{{- $ipv4 := eq (include "mkc.validBuildIpv4" (dict "address" $address "network" $network)) "true" -}}
{{- $valid := $ipv4 -}}
{{- $prefixLimit := 32 -}}
{{- $prefixDigits := 2 -}}
{{- if contains ":" $address -}}
{{- $prefixLimit = 128 -}}
{{- $prefixDigits = 3 -}}
{{- $valid = true -}}
{{- if contains "." $address -}}
{{- $tail := regexFind "[^:]+$" $address -}}
{{- $valid = eq (include "mkc.validBuildIpv4" (dict "address" $tail "network" $network)) "true" -}}
{{- $address = printf "%s0:0" (trimSuffix $tail $address) -}}
{{- end -}}
{{- if not (regexMatch "^[0-9a-fA-F:]+$" $address) -}}{{- $valid = false -}}{{- end -}}
{{- $segments := splitList ":" $address -}}
{{- $nonempty := without $segments "" -}}
{{- range $nonempty -}}
{{- if not (regexMatch "^[0-9a-fA-F]{1,4}$" .) -}}{{- $valid = false -}}{{- end -}}
{{- end -}}
{{- if contains "::" $address -}}
{{- if or (contains ":::" $address) (ne (len (regexFindAll "::" $address -1)) 1) (ge (len $nonempty) 8) -}}
{{- $valid = false -}}
{{- end -}}
{{- else if ne (len $segments) 8 -}}{{- $valid = false -}}{{- end -}}
{{- if or (and (hasPrefix ":" $address) (not (hasPrefix "::" $address))) (and (hasSuffix ":" $address) (not (hasSuffix "::" $address))) -}}
{{- $valid = false -}}
{{- end -}}
{{- end -}}
{{- if gt (len $parts) 2 -}}{{- $valid = false -}}{{- end -}}
{{- if eq (len $parts) 2 -}}
{{- $prefix := index $parts 1 -}}
{{- if or (not (regexMatch "^[0-9]+$" $prefix)) (gt (len $prefix) $prefixDigits) (gt (atoi $prefix) $prefixLimit) -}}
{{- $valid = false -}}
{{- end -}}
{{- end -}}
{{- if $valid -}}true{{- end -}}
{{- end -}}

{{- define "mkc.validateBuilds" -}}
{{- if .Values.builds.enabled -}}
{{- if eq .Values.environment "preview-pr" -}}{{- fail "PR previews cannot enable builds" -}}{{- end -}}
{{- if not .Values.github.enabled -}}{{- fail "Builds require GitHub configuration" -}}{{- end -}}
{{- if lt (int .Values.scaling.minReplicas) 2 -}}{{- fail "Builds require at least two API replicas" -}}{{- end -}}
{{- if lt (int .Values.scaling.maxReplicas) (int .Values.scaling.minReplicas) -}}{{- fail "Builds require maxReplicas at least minReplicas" -}}{{- end -}}
{{- if ne .Values.builds.template (trim .Values.builds.template) -}}{{- fail "Build template must have no surrounding whitespace" -}}{{- end -}}
{{- range .Values.builds.deniedDestinations -}}
{{- if ne (include "mkc.validBuildDestination" .) "true" -}}{{- fail "Build deniedDestinations accepts only IPs or CIDRs" -}}{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "mkc.buildEnv" -}}
{{- if .Values.builds.enabled }}
- name: MKC_E2B_BUILD_TEMPLATE
  value: {{ .Values.builds.template | quote }}
- name: MKC_E2B_DEPLOYMENT_ID
  value: {{ .Values.builds.deploymentId | quote }}
- name: MKC_BUILDS_PER_PROCESS
  value: {{ printf "%d" (int64 (default 4 .Values.builds.perProcess)) | quote }}
{{- if .Values.builds.deniedDestinations }}
- name: MKC_E2B_DENIED_DESTINATIONS
  value: {{ join "," .Values.builds.deniedDestinations | quote }}
{{- end }}
{{- end }}
{{- end -}}
