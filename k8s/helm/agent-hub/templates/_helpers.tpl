{{/*
Expand the name of the chart.
*/}}
{{- define "agent-hub.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "agent-hub.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "agent-hub.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "agent-hub.labels" -}}
helm.sh/chart: {{ include "agent-hub.chart" . }}
{{ include "agent-hub.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "agent-hub.selectorLabels" -}}
app.kubernetes.io/name: {{ include "agent-hub.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "agent-hub.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "agent-hub.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Backend image reference
*/}}
{{- define "agent-hub.backendImage" -}}
{{- printf "%s:%s" .Values.image.backend.repository .Values.image.backend.tag }}
{{- end }}

{{/*
Frontend image reference
*/}}
{{- define "agent-hub.frontendImage" -}}
{{- printf "%s:%s" .Values.image.frontend.repository .Values.image.frontend.tag }}
{{- end }}
