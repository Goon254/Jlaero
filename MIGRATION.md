# Jlaero — Migration Notes

Moving the existing **jlaero.com** WordPress site (hosted via cPanel, provider: Corzone)
into this git repository, ahead of rebuilding/revamping the project.

## What lives where

| Piece                     | Location                          | Status |
|---------------------------|-----------------------------------|--------|
| Site files (`public_html`)| `site/` in this repo              | mirrored via FTP |
| WordPress database        | MySQL `jlaadmin_wp483` (localhost)| **manual export needed** (see below) |
| Credentials               | `CREDENTIALS.md` (gitignored)     | done |

## Stack (from wp-config.php)

- WordPress, table prefix `wpel_`
- DB name/user: `jlaadmin_wp483`
- Security plugin: Really Simple Security
- PHP host: Apache on cPanel (Newfold/Bluehost-style stack)

## Database — DECISION: skipped

We are **not** migrating the old WordPress database. Reasons:

- The rebuild is a ground-up custom platform (web + mobile app), not WordPress,
  so WP pages/settings/theme config don't carry over.
- The only plugin is **WPForms Lite**, which does not store submissions in the
  DB (it emails them), so there are no customer leads to lose there.
- Media/images are captured in the file mirror (`site/wp-content/uploads`).
- The host was timing out (cPanel + live site both unreachable), making a clean
  export impractical, and the content isn't needed for the new build.

If a DB copy is ever wanted later, retry when the host is responsive:
cPanel → **Backup** → *Download a MySQL Database Backup* → `jlaadmin_wp483`.

## Rebuild direction

**Jlaero = "Uber for private jets."** Building from scratch:

- A cleaner **web app** (booking/charter platform)
- A **mobile app**
- Real product, not a WordPress marketing site

The `site/` mirror and the old marketing copy serve only as reference for
branding, imagery, and existing content — the codebase will be new.
