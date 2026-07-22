# Deploy TKA visual refresh to tka.rs

## What gets deployed

- `index.html` — new homepage (replaces Elementor homepage visually)
- `css/`, `js/`, `assets/`, `api/submit-inquiry.php`
- `.htaccess` — routes `/` to `index.html`, all other paths stay on WordPress

## Before deploy

1. **Backup** the current site (files + database) via hosting panel or WP plugin.
2. **Export** the current homepage from Elementor if you need to roll back.

## Upload (FTP / SFTP / cPanel File Manager)

Upload the project contents to the WordPress root (same folder as `wp-config.php`):

```
public_html/   (or www/)
├── index.html          ← new
├── .htaccess           ← merge carefully with existing WP rules (see below)
├── css/
├── js/
├── assets/
└── api/
    └── submit-inquiry.php
```

### Merging `.htaccess` with WordPress

If WordPress already has rewrite rules, add **above** the WordPress block:

```apache
DirectoryIndex index.html index.php

RewriteEngine On
RewriteBase /
RewriteRule ^index\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^$ index.html [L]
```

Keep the existing `# BEGIN WordPress` … `# END WordPress` section unchanged below.

## Form submissions

The inquiry form posts through `api/submit-inquiry.php`, which forwards to Contact Form 7 (form ID `10533`) on the live site, including honeypot tokens.

**Requires PHP** on the server (standard on tka.rs hosting).

## Local preview with working forms

```bash
cd /path/to/tka
php -S localhost:8080
```

Open http://localhost:8080 — form uses the PHP proxy.

## Rollback

Remove `index.html` and restore the previous `.htaccess`, or set WordPress homepage back to page ID `11123` in **Settings → Reading**.
