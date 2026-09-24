# Phase 40 — Docker Socket Least-Privilege & Runtime Worker Isolation

This phase removes the direct Docker socket mount from the runtime worker and routes Docker API access through a dedicated socket proxy.

## Changes

- Runtime worker uses `DOCKER_HOST=tcp://docker-socket-proxy:2375`.
- Runtime worker no longer mounts `/var/run/docker.sock`.
- Runtime-worker proxy allows only the Docker API families required for container/network lifecycle.
- Runtime-worker proxy explicitly denies image, volume, exec, system, info, swarm, service, task, secret, config, plugin, auth, event and build/commit management APIs.
- Production and HA socket proxies now deny image-management and Docker info APIs because the application paths inspected in this release do not require them.
- Runtime worker Docker client supports both TCP proxy and local socket modes, preserving controlled development compatibility.
- A release security gate validates the boundary and fails closed when the runtime worker has a direct socket mount.

## Security boundary

The Docker socket remains a highly privileged host control plane. The proxy is a reduction of exposed API surface, not a replacement for dedicated worker hosts, kernel/container isolation, or a hardened orchestration layer.

## Verification

- Node syntax validation passed for the runtime worker.
- Compose YAML parsing passed for production, HA, and runtime-worker manifests.
- The boundary gate is fail-closed and requires Docker Compose to validate the rendered manifests.
