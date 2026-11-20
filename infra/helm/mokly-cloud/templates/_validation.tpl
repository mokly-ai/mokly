{{- define "mkc.validateRuntimeEnv" -}}
{{- $app := dict "EXPO_PUBLIC_MKC_API_ORIGIN" (printf "https://%s" (include "mkc.host" (dict "root" . "kind" "api"))) "EXPO_PUBLIC_MKC_APP_ORIGIN" (include "mkc.publicAppOrigin" .) -}}
{{- $catalogue := dict "MKC_APP_ORIGIN" (include "mkc.publicAppOrigin" .) "MKC_CATALOGUE_ORIGIN" (printf "https://%s" (include "mkc.catalogueDomain" .)) "MKC_FILE_STORE" "gcs" "MKC_GCS_BUCKET" (printf "%s-%s-blobs" .Values.project (include "mkc.environment" .)) -}}
{{- if eq .Values.database.mode "namespace" -}}
{{- $_ := set $catalogue "MKC_GCS_BUCKET" .Values.preview.blobsBucket -}}
{{- $_ := set $catalogue "MKC_GCS_PREFIX" (include "mkc.previewLabel" .) -}}
{{- end -}}
{{- $_ := set $catalogue "MKC_DESKTOP_CLIENT" (toString .Values.desktopClient) -}}
{{- range $name, $expected := dict "app" $app "catalogue" $catalogue -}}
{{- range $key, $value := (index $.Values $name).env -}}
{{- if or (not (hasKey $expected $key)) (ne (toJson $value) (toJson (index $expected $key))) -}}
{{- fail "Runtime env must match the release origins and storage" -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
