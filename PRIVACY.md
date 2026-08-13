# CatchGrid privacy notice

**Last updated:** August 13, 2026

The published notice is available at <https://dex.cjdev.app/privacy/>.

CatchGrid is private by default. Public users do not create accounts. Collection entries,
settings, saved searches, and recovery snapshots are stored in that browser's site
storage and do not automatically sync to other browsers or devices.

## Data handling

- Public CSV and backup files are processed for the import or export the user chooses.
  They are not uploaded to a CatchGrid account.
- The unlisted owner mode stores one private administrator collection in Cloudflare D1.
  It is separate from public browser collections and protected by a Worker secret.
- Cloudflare processes ordinary request data needed to deliver and secure the site,
  including IP address, request path, browser information, diagnostic identifiers, and
  timestamps. Worker logs intentionally omit collection bodies and authorization values.
- Cloudflare Web Analytics may process privacy-focused aggregate usage and performance
  measurements. CatchGrid does not use advertising cookies or sell personal information.
- Pokémon sprite requests may be delivered by GitHub's raw-content service and are
  subject to GitHub's privacy practices.

## User control

Users should export a portable backup before changing browsers or clearing site data.
Removing CatchGrid's stored site data through browser settings deletes its local
collection from that browser. Exported files remain under the user's control and must be
deleted separately.

Privacy questions that contain no sensitive material may be filed in the public issue
tracker. Report sensitive or security-related matters using the private process in
`SECURITY.md`.
