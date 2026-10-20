<?php

const CMS_ROOT = __DIR__ . '/..';
const CMS_POSTS = CMS_ROOT . '/content/posts.json';
const CMS_CONFIG = __DIR__ . '/config.php';

function cms_e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function cms_start(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_set_cookie_params([
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function cms_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

function cms_check_token(): void
{
    $sent = $_POST['csrf'] ?? '';
    if (!is_string($sent) || !hash_equals(cms_token(), $sent)) {
        http_response_code(400);
        exit('Nevažeći zahtev. Osvežite stranicu i pokušajte ponovo.');
    }
}

function cms_config(): ?array
{
    if (!is_file(CMS_CONFIG)) {
        return null;
    }
    $config = require CMS_CONFIG;
    return is_array($config) ? $config : null;
}

function cms_logged_in(): bool
{
    return !empty($_SESSION['cms_user']);
}

function cms_posts(): array
{
    if (!is_file(CMS_POSTS)) {
        return [];
    }
    $data = json_decode((string) file_get_contents(CMS_POSTS), true);
    return is_array($data) ? $data : [];
}

function cms_save_posts(array $posts): void
{
    usort($posts, function ($a, $b) {
        return strcmp($b['date'] ?? '', $a['date'] ?? '');
    });
    $json = json_encode(array_values($posts), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Članak nije sačuvan.');
    }
    if (file_put_contents(CMS_POSTS, $json . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Članak nije sačuvan.');
    }
}

function cms_slug(string $value): string
{
    $map = [
        'š' => 's', 'đ' => 'dj', 'č' => 'c', 'ć' => 'c', 'ž' => 'z',
        'Š' => 's', 'Đ' => 'dj', 'Č' => 'c', 'Ć' => 'c', 'Ž' => 'z',
    ];
    $value = strtr(trim($value), $map);
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    return trim($value, '-');
}

function cms_reserved(string $slug): bool
{
    $blocked = [
        'assets', 'api', 'blog', 'cms', 'content', 'css', 'en', 'js',
        'kontakt', 'o-nama', 'medjunarodni-drumski-transport',
        'domaci-transport-i-distribucija', 'intermodalni-transport',
        'skladistenje-i-carinsko-zastupanje', 'avio-brodski-i-zeleznicki-transport',
        'medjunarodni-zbirni-transport', 'zbirni-transport-u-srbiji-i-distribucija',
    ];
    return $slug === '' || in_array($slug, $blocked, true);
}

function cms_date_label(string $iso): string
{
    $months = [1 => 'januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
    $time = strtotime($iso);
    if ($time === false) {
        return $iso;
    }
    $month = $months[(int) date('n', $time)] ?? '';
    return $month . ' ' . date('j', $time) . ', ' . date('Y', $time);
}

function cms_plain_to_html(string $text): string
{
    $text = trim($text);
    if ($text === '') {
        return '';
    }
    if (strpos($text, '<') !== false) {
        $text = preg_replace('#<(script|style|iframe|object|embed)\b[^>]*>.*?</\1>#is', '', $text) ?? '';
        $text = strip_tags($text, '<p><h2><h3><ul><ol><li><strong><em><a><br>');
        $text = preg_replace('/\son\w+\s*=\s*("[^"]*"|\'[^\']*\')/i', '', $text) ?? '';
        $text = preg_replace('/\s(href|src)\s*=\s*("|\')\s*javascript:[^"\']*\2/i', '', $text) ?? '';
        return trim($text);
    }
    $parts = preg_split("/\n\s*\n/", $text) ?: [];
    $html = '';
    foreach ($parts as $part) {
        $html .= '<p>' . nl2br(cms_e(trim($part))) . "</p>\n";
    }
    return trim($html);
}

function cms_excerpt(string $html, string $fallback): string
{
    $fallback = trim($fallback);
    if ($fallback !== '') {
        return $fallback;
    }
    $text = trim(preg_replace('/\s+/', ' ', strip_tags($html)) ?? '');
    if (strlen($text) <= 180) {
        return $text;
    }
    return rtrim(substr($text, 0, 177)) . '…';
}

function cms_find(array $posts, string $slug): ?int
{
    foreach ($posts as $i => $post) {
        if (($post['slug'] ?? '') === $slug) {
            return $i;
        }
    }
    return null;
}

function cms_card(array $post, string $prefix, string $lang): string
{
    $slug = cms_e($post['slug']);
    $href = '/' . $slug . '/';
    $title = $post[$lang === 'en' ? 'title_en' : 'title_sr'] ?: $post['title_sr'];
    $excerpt = $post[$lang === 'en' ? 'excerpt_en' : 'excerpt_sr'] ?: $post['excerpt_sr'];
    $more = $lang === 'en' ? 'Read more' : 'Dalje';
    $image = $prefix . $post['image'];
    $date = cms_e($post['date']);
    $label = cms_e(cms_date_label($post['date']));
    return <<<HTML
          <article class="blog-card">
            <a href="{$href}" class="blog-card-media">
              <img src="{$image}" alt="{$title}" width="1000" height="750" loading="lazy">
            </a>
            <div class="blog-card-body">
              <time datetime="{$date}">{$label}</time>
              <h3><a href="{$href}">{$title}</a></h3>
              <p>{$excerpt}</p>
              <a href="{$href}" class="link-arrow">{$more} <span aria-hidden="true">→</span></a>
            </div>
          </article>
HTML;
}

function cms_replace_grid(string $file, string $html): void
{
    $text = (string) file_get_contents($file);
    $start = '<!-- cms:blog-grid -->';
    $end = '<!-- /cms:blog-grid -->';
    $pattern = '/' . preg_quote($start, '/') . '.*?' . preg_quote($end, '/') . '/s';
    if (!preg_match($pattern, $text)) {
        throw new RuntimeException('Nije pronađen blog blok u ' . basename(dirname($file)) . '/' . basename($file));
    }
    $replacement = $start . "\n" . $html . "\n          " . $end;
    $updated = preg_replace($pattern, $replacement, $text, 1);
    if ($updated === null || file_put_contents($file, $updated, LOCK_EX) === false) {
        throw new RuntimeException('Blog lista nije ažurirana.');
    }
}

function cms_cards(array $posts, string $prefix, string $lang, ?int $limit): string
{
    if ($limit !== null) {
        $posts = array_slice($posts, 0, $limit);
    }
    $cards = [];
    foreach ($posts as $post) {
        $safe = $post;
        foreach (['title_sr', 'title_en', 'excerpt_sr', 'excerpt_en', 'image'] as $key) {
            $safe[$key] = cms_e((string) ($post[$key] ?? ''));
        }
        $cards[] = cms_card($safe, cms_e($prefix), $lang);
    }
    return implode("\n", $cards);
}

function cms_article(array $post): string
{
    $title = cms_e($post['title_sr']);
    $lead = cms_e($post['lead_sr'] !== '' ? $post['lead_sr'] : $post['excerpt_sr']);
    $image = cms_e('../' . $post['image']);
    $date = cms_e($post['date']);
    $label = cms_e(cms_date_label($post['date']));
    $slug = cms_e($post['slug']);
    $body = $post['body_sr'];
    $description = cms_e($post['excerpt_sr']);

    return <<<HTML
<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{$description}">
  <title>{$title} – TKA</title>
  <link rel="icon" href="../assets/images/favicon.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <header class="site-header" id="header">
    <div class="header-inner">
      <a href="/" class="logo" aria-label="TKA Logistics – početna"><img src="../assets/images/logo-tka.png" alt="TKA Logistics" width="173" height="75" class="logo-img"></a>
      <nav class="nav-main" aria-label="Glavna navigacija">
        <ul class="nav-list">
          <li><a href="/">Home</a></li>
          <li class="nav-has-dropdown">
            <button type="button" class="nav-dropdown-trigger" aria-expanded="false" aria-controls="nav-usluge">Usluge <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>
            <ul class="nav-dropdown" id="nav-usluge">
              <li><a href="/medjunarodni-drumski-transport/">Međunarodni drumski transport</a></li>
              <li><a href="/domaci-transport-i-distribucija/">Domaći transport i distribucija</a></li>
              <li><a href="/intermodalni-transport/">Intermodalni transport</a></li>
              <li><a href="/skladistenje-i-carinsko-zastupanje/">Skladištenje i carinsko zastupanje</a></li>
              <li><a href="/avio-brodski-i-zeleznicki-transport/">Avio, brodski i železnički transport</a></li>
            </ul>
          </li>
          <li><a href="/o-nama/">O nama</a></li>
          <li><a href="/blog/" aria-current="page">Blog</a></li>
          <li><a href="/kontakt/">Kontakt</a></li>
        </ul>
      </nav>
      <div class="lang-switch">
        <button type="button" class="lang-switch__trigger" aria-expanded="false" aria-controls="lang-menu" aria-label="Izaberite jezik">
          <img src="../assets/flags/rs.svg" alt="" width="20" height="14" class="lang-flag">
          <span>SR</span>
          <svg class="lang-switch__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <ul class="lang-switch__menu" id="lang-menu" role="listbox" aria-label="Jezik">
          <li><a href="/{$slug}/" hreflang="sr" lang="sr" aria-current="true"><img src="../assets/flags/rs.svg" alt="" width="20" height="14" class="lang-flag"><span>Srpski</span></a></li>
          <li><a href="/en/blog-2/" hreflang="en" lang="en"><img src="../assets/flags/en.svg" alt="" width="20" height="14" class="lang-flag"><span>English</span></a></li>
        </ul>
      </div>
      <a href="/kontakt/#upit" class="btn btn-primary header-cta">Pošalji upit</a>
      <button type="button" class="nav-toggle" aria-label="Otvori meni" aria-expanded="false" aria-controls="mobile-nav"><span></span><span></span><span></span></button>
    </div>
    <div class="mobile-nav" id="mobile-nav" hidden>
      <ul>
        <li><a href="/">Home</a></li>
        <li class="mobile-services"><span class="mobile-services__label">Usluge</span><ul>
          <li><a href="/medjunarodni-drumski-transport/">Međunarodni drumski transport</a></li>
          <li><a href="/domaci-transport-i-distribucija/">Domaći transport i distribucija</a></li>
          <li><a href="/intermodalni-transport/">Intermodalni transport</a></li>
          <li><a href="/skladistenje-i-carinsko-zastupanje/">Skladištenje i carinsko zastupanje</a></li>
          <li><a href="/avio-brodski-i-zeleznicki-transport/">Avio, brodski i železnički transport</a></li>
        </ul></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/kontakt/">Kontakt</a></li>
        <li><a href="/kontakt/#upit" class="btn btn-primary">Pošalji upit</a></li>
      </ul>
    </div>
  </header>
  <main id="main">
    <section class="page-hero page-hero--article" style="--page-hero-image: url('{$image}');">
      <div class="container page-hero-inner">
        <span class="pill-badge">Blog</span>
        <h1 class="hero-title">{$title}</h1>
        <p class="hero-lead">{$lead}</p>
      </div>
    </section>
    <section class="section page-section reveal">
      <div class="container">
        <div class="article-body">
        <p class="article-meta"><time datetime="{$date}">{$label}</time></p>
        <div class="prose">
          {$body}
        </div>
        </div>
      </div>
    </section>
    <section class="section cta-band reveal">
      <div class="container">
        <div class="cta-card">
          <div><h2>Želite da sarađujete sa TKA?</h2><p>Pošaljite upit i nastavimo razgovor.</p></div>
          <a href="/kontakt/#upit" class="btn btn-primary btn-lg">Pošaljite upit</a>
        </div>
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand"><img src="../assets/images/logo-tka.png" alt="TKA Logistics" width="140" height="60" class="footer-logo"><p>Transport Kombi As Logistics d.o.o.</p></div>
      <address class="footer-address"><p>Nikole Pašića 142, 11319 Krnjevo, Srbija</p></address>
      <div class="footer-links"><a href="/blog/">Blog</a></div>
    </div>
    <div class="container footer-bottom"><p>© 2026 TKA, All Rights Reserved</p><a class="footer-credit" href="https://gowithflow.rs">Created by gowithflow.rs</a></div>
  </footer>
  <script src="../js/main.js"></script>
</body>
</html>
HTML;
}

function cms_publish(array $posts, ?string $removeSlug = null): void
{
    if ($removeSlug !== null && !cms_reserved($removeSlug)) {
        $old = CMS_ROOT . '/' . $removeSlug;
        $page = $old . '/index.html';
        if (is_file($page)) {
            unlink($page);
        }
        if (is_dir($old) && count(scandir($old) ?: []) <= 2) {
            rmdir($old);
        }
    }

    foreach ($posts as $post) {
        $dir = CMS_ROOT . '/' . $post['slug'];
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new RuntimeException('Direktorijum članka nije napravljen.');
        }
        if (file_put_contents($dir . '/index.html', cms_article($post), LOCK_EX) === false) {
            throw new RuntimeException('Stranica članka nije sačuvana.');
        }
    }

    cms_replace_grid(CMS_ROOT . '/index.html', cms_cards($posts, '', 'sr', 3));
    cms_replace_grid(CMS_ROOT . '/en/index.html', cms_cards($posts, '../', 'en', 3));
    cms_replace_grid(CMS_ROOT . '/blog/index.html', cms_cards($posts, '../', 'sr', null));
    cms_replace_grid(CMS_ROOT . '/en/blog-2/index.html', cms_cards($posts, '../../', 'en', null));
}

function cms_store_image(array $file): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return '';
    }
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Slika nije otpremljena.');
    }
    $info = @getimagesize($file['tmp_name']);
    $allowed = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if ($info === false || !isset($allowed[$info[2]])) {
        throw new RuntimeException('Dozvoljene su JPG, PNG i WEBP slike.');
    }
    $name = date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $allowed[$info[2]];
    $dest = CMS_ROOT . '/assets/images/blog/' . $name;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        throw new RuntimeException('Slika nije sačuvana.');
    }
    return 'assets/images/blog/' . $name;
}
