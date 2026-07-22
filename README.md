# TKA Logistics – Website Visual Refresh

Modern visual redesign of [tka.rs](https://www.tka.rs/) content, inspired by [Zásilkovna](https://www.zasilkovna.cz/en), [One by Allegro](https://onedelivery.cz/), and [PPL](https://www.ppl.cz/).

## Languages

- **Serbian:** `/` — click **EN** (UK flag) in the navbar
- **English:** `/en/` — click **SR** (Serbia flag) to return

## Included

- Serbian and English homepages with navbar language switcher (flag icons)
- Services, network section, inquiry form fields, blog teasers, footer
- **Real TKA logo** and hero banners from the live site
- **Partner links** (Paneco, E.L.V.I.S., IFA)
- **Blog & service URLs** matching tka.rs permalinks
- **Contact Form 7** integration (form ID `10533`) via `api/submit-inquiry.php`
- **Deploy guide** in `deploy/DEPLOY.md`

## Preview locally

Static files only:

```bash
python3 -m http.server 8080
```

Form submission needs PHP:

```bash
php -S localhost:8080
```

## Deploy to production

See [deploy/DEPLOY.md](deploy/DEPLOY.md) for uploading to the WordPress root and `.htaccess` setup.

## Structure

```
tka/
├── index.html
├── en/index.html
├── assets/flags/rs.svg
├── assets/flags/en.svg
├── .htaccess
├── css/style.css
├── js/main.js
├── js/form.js
├── api/submit-inquiry.php
├── assets/images/     # logo, heroes, about photo
├── assets/partners/   # alliance SVG wordmarks
└── deploy/DEPLOY.md
```
