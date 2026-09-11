# Security

Weekaboo is preparing its first public release. Local test builds do not constitute a security certification. The installed apps use direct provider connections; the browser development backend has a different, single-user trust boundary and should remain loopback-only.

## Report a vulnerability privately

Use GitHub's **Security → Report a vulnerability** when private reporting is enabled on this repository. If unavailable, request a private contact channel without posting the vulnerability, account data or exploit details publicly. Never include access tokens, app passwords, private keys, complete calendar exports or personal event screenshots in an issue.

Include the affected version/platform, a minimal reproduction using fictional data, the expected behavior and the observed impact. No response-time guarantee or bug-bounty program is offered.

## Handling local data

Keep OAuth user tokens, app-specific passwords, signing keys, environment files and local databases outside version control. The supplied native configuration examples contain public registration placeholders, not working user credentials. Task exports omit credentials but can contain personal task content; treat them as private files.

A public-source audit and a signed-artifact audit are separate checks. See the [release checklist](docs/release-checklist.md). If a real secret is exposed, revoke or rotate it at its issuer; deleting a file or rewriting Git history alone does not invalidate the secret.
