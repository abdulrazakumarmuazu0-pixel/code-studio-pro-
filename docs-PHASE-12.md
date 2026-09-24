# Phase 12 — Custom Domains, DNS Verification & HTTPS Foundation

## Implemented
- `custom_domains` database table with ownership, verification token, TLS state and target deployment.
- API:
  - `POST /v1/projects/:projectId/domains`
  - `GET /v1/projects/:projectId/domains`
  - `POST /v1/domains/:id/verify`
  - `POST /v1/domains/:id/attach`
  - `DELETE /v1/domains/:id`
- DNS TXT verification at `_code-studio-verification.<hostname>`.
- Hostname validation and ownership checks.
- Nginx host configuration generation for static projects and Node runtimes.
- Shared proxy-config volume between API/worker and the deployment edge.
- ACME webroot volume and a Certbot provisioning script.
- ACME challenge route in the Nginx default server.

## DNS setup
1. Create the domain in Code Studio Pro.
2. Add the returned TXT record:
   `_code-studio-verification.example.com`
3. Set its value to the returned `code-studio-verification=<token>`.
4. Point the domain A/AAAA record to the production edge IP.
5. Verify the domain.
6. Attach a ready deployment.
7. Provision TLS with `scripts/provision-domain-cert.sh`.
8. Install/reload the generated TLS server block.

## Production security
- Do not expose the Docker socket publicly.
- Put the deployment edge behind a firewall/load balancer.
- Use a dedicated ACME email.
- Add certificate renewal automation before launch.
- Add DNS CAA records and rate limits.
- Run `nginx -t` before every reload.
- Keep domain proxy files generated only from verified, owned domains.
- For production, use an isolated domain/edge worker rather than letting the public API write Nginx configuration directly.

## Current limitation
This phase provides the production control-plane and edge foundation. Automatic certificate renewal and fully automated zero-downtime Nginx reloads should be completed before commercial public hosting.
