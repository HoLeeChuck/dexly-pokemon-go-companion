# CatchGrid security policy

## Supported version

Security fixes are applied to the current code on the protected `main` branch and the
currently deployed release at <https://dex.cjdev.app>. Older branches and private forks
are not supported.

## Report a vulnerability

Please use a
[private GitHub security advisory](https://github.com/HoLeeChuck/dexly-pokemon-go-companion/security/advisories/new).
Do not open a public issue containing an access key, exported collection, exploit,
personal information, or other sensitive material.

Include:

- the affected URL and release identifier from `/api/health`;
- the impact and minimum reproduction steps;
- whether credentials or collection data may have been exposed; and
- a safe way to clarify the report through the private advisory.

We will acknowledge actionable reports as soon as practical, investigate them privately,
and coordinate disclosure after a fix is available. Please do not access data that is not
yours, disrupt the service, use social engineering, or publish an unresolved issue.

## Security boundary

Public collections are browser-local and do not require credentials. The unlisted owner
mode is not a public account system; its private APIs require the separately configured
Cloudflare Worker secret and are rate limited. CatchGrid never asks for Pokémon GO
credentials.
