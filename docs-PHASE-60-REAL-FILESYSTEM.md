# Phase 60 — Real Workspace Filesystem

Code Studio now exposes the actual persistent `/workspace` filesystem from the authenticated workspace container. The browser explorer can use the same filesystem that the terminal, TypeScript language service, Git, build and deployment processes use.

## Operations

- directory listing with folders and files
- read/write files
- create directories
- stat paths
- move/rename files and directories
- copy files/directories
- recursive delete with explicit flag
- bounded file size/list size/path length
- workspace ownership authentication
- canonical-path validation using `realpath`
- protection against deleting `/workspace`

## Source of truth

The container-mounted persistent workspace volume is the source of truth. IndexedDB/local browser state is not treated as the cloud filesystem.

## Security

All operations require an authenticated owner of a running workspace. Paths are relative to `/workspace`; traversal, absolute paths, NUL bytes, oversized paths and paths resolving outside `/workspace` are rejected. Existing symlink traversal is checked through canonicalization before reads, moves, copies and deletes.

## Production note

Live Docker storage and multi-node persistence must be exercised in the production-like environment before launch. This phase does not claim a live multi-node storage test from this development environment.
