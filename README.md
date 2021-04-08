# Dedup Proxy

A lean and fast proxy designed to be a sidecar to deduplicate concurrent HTTP GET requests targeting the same endpoints. As a result, there will be at most 1 actual outstanding request against the same GET endpoint to the backend. Deduplicated requests in front of this proxy will then share the same response.

The primary use case for this is to batch concurrent Prometheus scraping requests and Kubernetes `kubelet` liveness/readiness probe requests targeting a container's `/metrics` endpoint. For some application, it's very expensive to construct and render `/metrics`.
