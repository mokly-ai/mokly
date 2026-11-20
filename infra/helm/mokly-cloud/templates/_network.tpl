{{- define "mkc.previewDnsEgress" -}}
- to:
    - namespaceSelector:
        matchLabels: { kubernetes.io/metadata.name: kube-system }
      podSelector:
        matchLabels: { k8s-app: kube-dns }
    - ipBlock: { cidr: 169.254.20.10/32 }
  ports: [{ protocol: UDP, port: 53 }, { protocol: TCP, port: 53 }]
{{- end -}}

{{- define "mkc.previewHttpsEgress" -}}
- to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except: [10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 127.0.0.0/8, 100.64.0.0/10]
    - ipBlock:
        cidr: "::/0"
        except: ["fc00::/7", "fe80::/10", "::1/128", "::/128"]
  ports: [{ protocol: TCP, port: 443 }]
{{- end -}}

{{- define "mkc.databaseClients" -}}
matchExpressions:
  - key: app.kubernetes.io/name
    operator: In
    values: [api, catalogue, maintenance]
{{- end -}}
