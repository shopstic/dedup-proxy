# Dedup Proxy

[![CI](https://github.com/shopstic/dedup-proxy/actions/workflows/ci.yaml/badge.svg)](https://github.com/shopstic/dedup-proxy/actions) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/shopstic/dedup-proxy/blob/main/LICENSE) [![Docker](https://img.shields.io/docker/v/shopstic/dedup-proxy?arch=amd64&color=purple&label=docker&sort=date)](https://hub.docker.com/repository/docker/shopstic/dedup-proxy/tags?page=1&ordering=last_updated)

A lean and fast proxy designed to be a sidecar to deduplicate concurrent HTTP GET requests targeting the same endpoints. As a result, there will be at most 1 actual outstanding request against the same GET endpoint to the backend. Deduplicated requests in front of this proxy will then share the same response.

The primary use case for this is to batch concurrent Prometheus scraping requests and Kubernetes `kubelet` liveness/readiness probe requests targeting a container's `/metrics` endpoint. For some application, it's very expensive to construct and render `/metrics`. This cost is then amplified when multiple Prometheus servers concurrently scrape together with `kubelet` hammering the same endpoint with probe requests.
