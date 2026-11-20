{{- define "mkc.security" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop: [ALL]
{{- end -}}

{{- define "mkc.proxy" -}}
{{- if eq .Values.database.mode "cloudsql" -}}
- name: cloud-sql-proxy
  image: {{ .Values.sqlProxy.image | quote }}
  restartPolicy: Always
  args:
    - --structured-logs
    - --private-ip
    - --auto-iam-authn
    - --health-check
    - --http-address=0.0.0.0
    - --http-port=9090
    - --port=5432
    - {{ printf "%s:%s:mkc-%s" .Values.project .Values.region (include "mkc.environment" .) | quote }}
  securityContext:
    {{- include "mkc.security" . | nindent 4 }}
  startupProbe:
    httpGet: { path: /startup, port: 9090 }
    failureThreshold: 60
    periodSeconds: 2
  resources:
    {{- toYaml .Values.sqlProxy.resources | nindent 4 }}
{{- end -}}
{{- end -}}

{{- define "mkc.apiEnv" -}}
- name: MKC_BIND
  value: {{ printf "0.0.0.0:%v" .Values.api.port | quote }}
- name: MKC_ENV
  value: {{ ternary "preview" "production" (hasPrefix "preview-pr-" (include "mkc.environment" .)) }}
{{ include "mkc.databaseEnv" (dict "root" . "identity" "api") }}
- name: MKC_APP_ORIGIN
  value: {{ include "mkc.publicAppOrigin" . | quote }}
- name: MKC_DESKTOP_CLIENT
  value: {{ .Values.desktopClient | quote }}
- name: MKC_API_ORIGIN
  value: {{ printf "https://%s" (include "mkc.host" (dict "root" . "kind" "api")) | quote }}
- name: MKC_TRUSTED_PROXY_HOPS
  value: {{ .Values.api.trustedProxyHops | quote }}
- name: MKC_TRUSTED_PROXY_CIDRS
  value: {{ include "mkc.trustedProxyCidrs" . | quote }}
- name: MKC_INGEST_WORKERS
  value: {{ printf "%d" (int64 .Values.api.ingestWorkers) | quote }}
- name: MKC_UPLOAD_MEMORY_BYTES
  value: {{ printf "%d" (int64 .Values.api.uploadMemoryBytes) | quote }}
- name: MKC_UPLOAD_BLOB_GZIP
  value: {{ .Values.api.uploadBlobGzip | quote }}
{{- if .Values.github.enabled }}
- name: MKC_GITHUB_APP_ID
  value: {{ .Values.github.appId | quote }}
- name: MKC_GITHUB_CLIENT_ID
  value: {{ .Values.github.clientId | quote }}
- name: MKC_GITHUB_APP_SLUG
  value: {{ .Values.github.appSlug | quote }}
{{- end }}
{{- include "mkc.buildEnv" . }}
{{- if .Values.billing.enabled }}
- name: MKC_BILLING
  value: stripe
{{- end }}
{{ include "mkc.publicationEnv" . }}
- name: MKC_MAILER
  value: {{ ternary "log" "postmark" (hasPrefix "preview-pr-" (include "mkc.environment" .)) }}
{{- if hasPrefix "preview-pr-" (include "mkc.environment" .) }}
- name: MKC_PREVIEW_SIGN_IN_EMAIL
  value: {{ .Values.preview.signInEmail | quote }}
- name: MKC_PREVIEW_SIGN_IN_PLAN
  value: "team"
{{- end }}
{{- if not (hasPrefix "preview-pr-" (include "mkc.environment" .)) }}
- name: POSTMARK_FROM
  value: {{ .Values.postmarkFrom | quote }}
- name: MKC_SITE_ORIGIN
  value: {{ printf "https://%s" .Values.domain | quote }}
{{- end }}
{{- end -}}

{{- define "mkc.secretVolume" -}}
- name: secrets
  {{- if eq .root.Values.database.mode "namespace" }}
  projected:
    sources:
      - secret:
          name: catalogue-signing-key
          items:
            - { key: catalogue-signing-key, path: catalogue-signing-key }
      {{- if eq .workload "api" }}
      - secret:
          name: preview-sign-in
          items:
            - { key: preview-sign-in, path: preview-sign-in }
      {{- end }}
  {{- else }}
  csi:
    driver: secrets-store-gke.csi.k8s.io
    readOnly: true
    volumeAttributes:
      secretProviderClass: {{ .workload }}-secrets
  {{- end }}
{{- end -}}

{{- define "mkc.publicationEnv" -}}
- name: MKC_CATALOGUE_ORIGIN
  value: {{ printf "https://%s" (include "mkc.host" (dict "root" . "kind" "catalogue")) | quote }}
{{ include "mkc.storageEnv" . }}
{{- end -}}

{{- define "mkc.storageEnv" -}}
- name: MKC_FILE_STORE
  value: gcs
- name: MKC_GCS_BUCKET
  {{- if eq .Values.database.mode "namespace" }}
  value: {{ .Values.preview.blobsBucket | quote }}
- name: MKC_GCS_PREFIX
  value: {{ include "mkc.previewLabel" . | quote }}
  {{- else }}
  value: {{ printf "%s-%s-blobs" .Values.project (include "mkc.environment" .) | quote }}
  {{- end }}
{{- end -}}

{{- define "mkc.databaseEnv" -}}
- name: MKC_DATABASE_URL
  {{- if eq .root.Values.database.mode "namespace" }}
  valueFrom:
    secretKeyRef: { name: postgres-credentials, key: url }
  {{- else }}
  value: {{ printf "postgres://%s@127.0.0.1:5432/mokly?sslmode=disable&connect_timeout=5" (printf "mkc-%s-%s@%s.iam" (include "mkc.environment" .root) .identity .root.Values.project | urlquery) | quote }}
  {{- end }}
{{- end -}}

{{- define "mkc.catalogueEnv" -}}
{{ include "mkc.databaseEnv" (dict "root" . "identity" "cat") }}
{{ include "mkc.publicationEnv" . }}
- name: MKC_ENV
  value: {{ ternary "preview" "production" (eq .Values.database.mode "namespace") }}
- name: MKC_CATALOGUE_BIND
  value: {{ printf "0.0.0.0:%v" .Values.catalogue.port | quote }}
- name: MKC_APP_ORIGIN
  value: {{ include "mkc.publicAppOrigin" . | quote }}
- name: MKC_CATALOGUE_HOT_CACHE_BYTES
  value: {{ printf "%d" (int64 .Values.catalogue.hotCacheBytes) | quote }}
- name: MKC_DESKTOP_CLIENT
  value: {{ .Values.desktopClient | quote }}
{{- end -}}

{{- define "mkc.trustedProxyCidrs" -}}
{{- $cidrs := concat .Values.api.trustedProxyCidrs .Values.cloudflare.trustedProxyCidrs -}}
{{- if eq .Values.database.mode "cloudsql" -}}
{{- $cidrs = append $cidrs (printf "%s/32" .Values.ingressAddress) -}}
{{- end -}}
{{- join "," $cidrs -}}
{{- end -}}

{{- define "mkc.appEnv" -}}
- name: EXPO_PUBLIC_MKC_API_ORIGIN
  value: {{ printf "https://%s" (include "mkc.host" (dict "root" . "kind" "api")) | quote }}
- name: EXPO_PUBLIC_MKC_APP_ORIGIN
  value: {{ include "mkc.publicAppOrigin" . | quote }}
- name: MKC_EXPECTED_REVISION
  value: {{ .Values.revision | quote }}
- name: PORT
  value: {{ .Values.app.port | quote }}
{{- end -}}
