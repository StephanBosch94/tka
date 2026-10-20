<?php

require __DIR__ . '/lib.php';
cms_start();

$action = $_POST['action'] ?? $_GET['action'] ?? 'list';
$error = '';
$notice = '';
if (isset($_GET['saved'])) {
    $notice = 'Članak je sačuvan i objavljen.';
} elseif (isset($_GET['deleted'])) {
    $notice = 'Članak je obrisan.';
}

if ($action === 'setup' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    cms_check_token();
    $password = (string) ($_POST['password'] ?? '');
    $again = (string) ($_POST['password_again'] ?? '');
    if (cms_config() !== null) {
        $error = 'Lozinka je već podešena.';
    } elseif (strlen($password) < 10) {
        $error = 'Lozinka mora imati najmanje 10 karaktera.';
    } elseif ($password !== $again) {
        $error = 'Lozinke se ne poklapaju.';
    } else {
        $export = var_export(password_hash($password, PASSWORD_DEFAULT), true);
        $php = "<?php\nreturn ['password_hash' => {$export}];\n";
        if (file_put_contents(CMS_CONFIG, $php, LOCK_EX) === false) {
            $error = 'Lozinka nije sačuvana. Proverite dozvole za fasciklu cms/.';
        } else {
            $_SESSION['cms_user'] = true;
            header('Location: ./');
            exit;
        }
    }
    $action = 'setup';
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    cms_check_token();
    $config = cms_config();
    $password = (string) ($_POST['password'] ?? '');
    if ($config && password_verify($password, (string) ($config['password_hash'] ?? ''))) {
        session_regenerate_id(true);
        $_SESSION['cms_user'] = true;
        header('Location: ./');
        exit;
    }
    $error = 'Pogrešna lozinka.';
    $action = 'login';
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    header('Location: ./');
    exit;
}

$config = cms_config();
if ($config === null) {
    $action = 'setup';
} elseif (!cms_logged_in() && $action !== 'login') {
    $action = 'login';
}

if (cms_logged_in() && $_SERVER['REQUEST_METHOD'] === 'POST' && in_array($action, ['save', 'delete'], true)) {
    cms_check_token();
    try {
        $posts = cms_posts();
        if ($action === 'delete') {
            $slug = cms_slug((string) ($_POST['slug'] ?? ''));
            $index = cms_find($posts, $slug);
            if ($index === null) {
                throw new RuntimeException('Članak nije pronađen.');
            }
            array_splice($posts, $index, 1);
            cms_save_posts($posts);
            cms_publish($posts, $slug);
            header('Location: ./?deleted=1');
            exit;
        }

        $original = cms_slug((string) ($_POST['original_slug'] ?? ''));
        $slug = cms_slug((string) ($_POST['slug'] ?? ''));
        if ($slug === '') {
            $slug = cms_slug((string) ($_POST['title_sr'] ?? ''));
        }
        if (cms_reserved($slug)) {
            throw new RuntimeException('Taj naziv adrese je rezervisan. Izaberite drugi.');
        }
        $date = (string) ($_POST['date'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new RuntimeException('Datum nije ispravan.');
        }
        $title = trim((string) ($_POST['title_sr'] ?? ''));
        if ($title === '') {
            throw new RuntimeException('Naslov na srpskom je obavezan.');
        }
        $body = cms_plain_to_html((string) ($_POST['body_sr'] ?? ''));
        if ($body === '') {
            throw new RuntimeException('Tekst članka je obavezan.');
        }
        $image = cms_store_image($_FILES['image'] ?? []);
        if ($image === '') {
            $image = trim((string) ($_POST['current_image'] ?? ''));
        }
        if (!preg_match('#^assets/images/blog/[A-Za-z0-9._-]+$#', $image)) {
            throw new RuntimeException('Članak mora imati sliku.');
        }

        $post = [
            'slug' => $slug,
            'date' => $date,
            'image' => $image,
            'title_sr' => $title,
            'title_en' => trim((string) ($_POST['title_en'] ?? '')),
            'excerpt_sr' => cms_excerpt($body, (string) ($_POST['excerpt_sr'] ?? '')),
            'excerpt_en' => trim((string) ($_POST['excerpt_en'] ?? '')),
            'lead_sr' => trim((string) ($_POST['lead_sr'] ?? '')),
            'body_sr' => $body,
        ];

        $existing = $original !== '' ? cms_find($posts, $original) : null;
        $duplicate = cms_find($posts, $slug);
        if ($duplicate !== null && $duplicate !== $existing) {
            throw new RuntimeException('Članak sa tom adresom već postoji.');
        }
        if ($existing === null) {
            $posts[] = $post;
            $remove = null;
        } else {
            $posts[$existing] = $post;
            $remove = $original !== $slug ? $original : null;
        }
        cms_save_posts($posts);
        cms_publish(cms_posts(), $remove);
        header('Location: ./?saved=1');
        exit;
    } catch (RuntimeException $exception) {
        $error = $exception->getMessage();
        $action = 'edit';
    }
}

header('Content-Type: text/html; charset=utf-8');
header('X-Frame-Options: DENY');
$token = cms_token();
$loggedIn = cms_logged_in();
?>
<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Blog – TKA</title>
  <link rel="icon" href="../assets/images/favicon.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px/1.5 Manrope, system-ui, sans-serif; background: #f4f6fa; color: #0b1220; }
    a { color: #18254b; }
    button, input, textarea { font: inherit; }
    .topbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.85rem 1.25rem; background: #fff; border-bottom: 1px solid #e2e8f0; }
    .brand { display: flex; align-items: center; gap: 0.85rem; color: inherit; text-decoration: none; }
    .brand img { width: 92px; height: auto; }
    .brand span { font-family: "Plus Jakarta Sans", Manrope, sans-serif; font-weight: 700; }
    .top-links { display: flex; align-items: center; gap: 0.4rem; }
    .text-link { padding: 0.45rem 0.7rem; color: #4a5568; text-decoration: none; font-weight: 700; font-size: 0.92rem; }
    .wrap { width: min(1100px, calc(100% - 2rem)); margin: 0 auto; padding: 1.5rem 0 3rem; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; margin-bottom: 1rem; }
    h1 { margin: 0; font-family: "Plus Jakarta Sans", Manrope, sans-serif; font-size: 1.85rem; letter-spacing: -0.03em; }
    .muted { margin: 0.2rem 0 0; color: #718096; }
    .button, button.primary { border: 0; border-radius: 999px; padding: 0.72rem 1.05rem; background: #e48736; color: #fff; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
    .button:hover, button.primary:hover { background: #c46f22; }
    .ghost { background: #fff; color: #18254b; border: 1px solid #d5dce8; }
    .ghost:hover { background: #f4f6fa; }
    .error, .ok { margin: 0 0 1rem; padding: 0.85rem 1rem; border-radius: 12px; }
    .error { background: #fff1f0; color: #9b2c2c; }
    .ok { background: #eefaf1; color: #17663a; }
    .post-list { display: grid; gap: 0.85rem; list-style: none; margin: 0; padding: 0; }
    .post { display: grid; grid-template-columns: 168px minmax(0, 1fr) auto; gap: 1rem; align-items: center; padding: 0.75rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; }
    .post img, .thumb-empty { width: 168px; height: 112px; object-fit: cover; border-radius: 12px; background: #e8ecf4; }
    .thumb-empty { display: grid; place-items: center; color: #718096; font-size: 0.8rem; font-weight: 700; }
    .post h2 { margin: 0.15rem 0 0.3rem; font-size: 1.05rem; line-height: 1.35; }
    .post h2 a { color: inherit; text-decoration: none; }
    .post h2 a:hover { color: #c46f22; }
    .post time { color: #e48736; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
    .post p { margin: 0; color: #4a5568; font-size: 0.92rem; }
    .row-actions { display: flex; flex-direction: column; align-items: stretch; gap: 0.4rem; min-width: 7.5rem; }
    .row-actions a, .row-actions button { border-radius: 999px; padding: 0.45rem 0.8rem; text-align: center; text-decoration: none; font-weight: 700; font-size: 0.9rem; }
    .row-actions a { background: #18254b; color: #fff; }
    .row-actions .view { background: transparent; color: #18254b; }
    .danger { border: 0; background: transparent; color: #9b2c2c; cursor: pointer; }
    .empty { padding: 2.5rem 1.5rem; text-align: center; background: #fff; border: 1px dashed #d5dce8; border-radius: 18px; }
    .empty h2 { margin: 0 0 0.4rem; }
    .gate { width: min(440px, calc(100% - 2rem)); margin: 8vh auto; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 1.25rem; }
    .stack { display: grid; gap: 0.9rem; }
    .editor { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 1.25rem; align-items: start; }
    .fields { display: grid; gap: 1rem; }
    .panel h2 { margin: 0 0 0.9rem; font-size: 1rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
    label, .field { display: grid; gap: 0.35rem; font-size: 0.82rem; font-weight: 800; }
    .hint { font-weight: 500; color: #718096; }
    input, textarea { width: 100%; padding: 0.72rem 0.8rem; border: 1px solid #d5dce8; border-radius: 10px; background: #fff; color: inherit; font-weight: 500; }
    textarea { min-height: 320px; line-height: 1.55; resize: vertical; }
    input:focus, textarea:focus { outline: 2px solid rgba(228, 135, 54, 0.45); border-color: #e48736; }
    .cover { position: relative; display: grid; min-height: 180px; border: 1px dashed #d5dce8; border-radius: 14px; overflow: hidden; background: #f8fafc; cursor: pointer; }
    .cover img { width: 100%; height: 220px; object-fit: cover; }
    .cover span { position: absolute; right: 0; bottom: 0; left: 0; padding: 0.7rem 0.8rem; background: rgba(11, 18, 32, 0.72); color: #fff; text-align: center; font-weight: 700; }
    .cover input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.45rem; }
    .toolbar button { border: 1px solid #d5dce8; background: #fff; border-radius: 8px; padding: 0.28rem 0.55rem; font-size: 0.82rem; font-weight: 800; cursor: pointer; }
    .form-actions { display: flex; gap: 0.6rem; align-items: center; }
    .preview { position: sticky; top: 5.5rem; }
    .mini-card { overflow: hidden; padding: 0; }
    .mini-card img, .mini-fallback { width: 100%; height: 168px; object-fit: cover; background: #e8ecf4; }
    .mini-card img:not([hidden]) { display: block; }
    .mini-fallback:not([hidden]) { display: grid; place-items: center; color: #718096; font-size: 0.85rem; font-weight: 700; }
    .mini-body { padding: 1rem 1rem 1.15rem; }
    .mini-body time { color: #e48736; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
    .mini-body h3 { margin: 0.35rem 0; font-size: 1.02rem; line-height: 1.35; }
    .mini-body p { margin: 0; color: #4a5568; font-size: 0.88rem; }
    @media (max-width: 860px) {
      .post, .editor, .grid { grid-template-columns: 1fr; }
      .post img, .thumb-empty { width: 100%; height: 180px; }
      .row-actions { flex-direction: row; flex-wrap: wrap; }
      .preview { position: static; }
      .page-head, .topbar { align-items: flex-start; }
      .topbar { flex-wrap: wrap; }
    }
  </style>
</head>
<body>
<header class="topbar">
  <a class="brand" href="./">
    <img src="../assets/images/logo-tka.png" alt="TKA Logistics" width="173" height="75">
    <span>Blog</span>
  </a>
  <?php if ($loggedIn): ?>
    <nav class="top-links" aria-label="CMS">
      <a class="text-link" href="/blog/" target="_blank" rel="noopener">Pogledaj blog</a>
      <a class="text-link" href="?action=logout">Odjava</a>
    </nav>
  <?php endif; ?>
</header>

<?php if ($action === 'setup' || $action === 'login'): ?>
  <main class="gate">
    <?php if ($error !== ''): ?><p class="error"><?= cms_e($error) ?></p><?php endif; ?>
    <?php if ($action === 'setup'): ?>
      <form class="card stack" method="post">
        <input type="hidden" name="csrf" value="<?= cms_e($token) ?>">
        <input type="hidden" name="action" value="setup">
        <h1>Lozinka za blog</h1>
        <p class="muted">Prvi put ovde. Lozinka ostaje samo na serveru i otvara dodavanje i izmenu članaka.</p>
        <label>Lozinka<input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
        <label>Ponovite lozinku<input type="password" name="password_again" required minlength="10" autocomplete="new-password"></label>
        <button class="primary" type="submit">Sačuvaj lozinku</button>
      </form>
    <?php else: ?>
      <form class="card stack" method="post">
        <input type="hidden" name="csrf" value="<?= cms_e($token) ?>">
        <input type="hidden" name="action" value="login">
        <h1>Prijava</h1>
        <p class="muted">Unesite lozinku da biste dodali ili izmenili članak.</p>
        <label>Lozinka<input type="password" name="password" required autocomplete="current-password"></label>
        <button class="primary" type="submit">Prijava</button>
      </form>
    <?php endif; ?>
  </main>

<?php elseif ($action === 'edit'):
    $slug = cms_slug((string) ($_GET['slug'] ?? $_POST['original_slug'] ?? ''));
    $posts = cms_posts();
    $index = cms_find($posts, $slug);
    $post = $index !== null ? $posts[$index] : [
        'slug' => '', 'date' => date('Y-m-d'), 'image' => '',
        'title_sr' => '', 'title_en' => '', 'excerpt_sr' => '', 'excerpt_en' => '', 'lead_sr' => '', 'body_sr' => '',
    ];
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        foreach (['slug', 'date', 'title_sr', 'title_en', 'excerpt_sr', 'excerpt_en', 'lead_sr', 'body_sr'] as $key) {
            $post[$key] = (string) ($_POST[$key] ?? $post[$key]);
        }
        $post['image'] = (string) ($_POST['current_image'] ?? $post['image']);
        $post['slug'] = $slug !== '' ? (string) ($_POST['slug'] ?? $slug) : $post['slug'];
    }
    $isNew = $slug === '';
    $imageUrl = $post['image'] !== '' ? '../' . $post['image'] : '';
?>
  <main class="wrap">
    <?php if ($error !== ''): ?><p class="error"><?= cms_e($error) ?></p><?php endif; ?>
    <form id="editor" method="post" enctype="multipart/form-data">
      <input type="hidden" name="csrf" value="<?= cms_e($token) ?>">
      <input type="hidden" name="action" value="save">
      <input type="hidden" name="original_slug" value="<?= cms_e($slug) ?>">
      <input type="hidden" name="current_image" value="<?= cms_e($post['image']) ?>">
      <div class="page-head">
        <div>
          <a class="text-link" href="./">← Svi članci</a>
          <h1><?= $isNew ? 'Novi članak' : 'Izmena članka' ?></h1>
        </div>
        <div class="form-actions">
          <a class="button ghost" href="./">Otkaži</a>
          <button class="primary" type="submit">Objavi</button>
        </div>
      </div>
      <div class="editor">
        <div class="fields">
          <section class="card panel">
            <h2>Naslov i opis</h2>
            <div class="grid">
              <label>Naslov (srpski)<input name="title_sr" value="<?= cms_e($post['title_sr']) ?>" required></label>
              <label>Naslov (engleski)<input name="title_en" value="<?= cms_e($post['title_en']) ?>"></label>
              <label>Kratak opis (srpski)<input name="excerpt_sr" value="<?= cms_e($post['excerpt_sr']) ?>"></label>
              <label>Kratak opis (engleski)<input name="excerpt_en" value="<?= cms_e($post['excerpt_en']) ?>"></label>
              <label>Uvod u heroju<input name="lead_sr" value="<?= cms_e($post['lead_sr']) ?>"></label>
              <label>Datum<input type="date" name="date" value="<?= cms_e($post['date']) ?>" required></label>
            </div>
          </section>
          <section class="card panel">
            <h2>Objava</h2>
            <div class="stack">
              <label>Adresa članka
                <input name="slug" value="<?= cms_e($post['slug']) ?>" placeholder="npr. novi-clanak" autocomplete="off">
                <span class="hint">Ako ostane prazno, adresa se pravi iz srpskog naslova.</span>
              </label>
              <div class="field">Naslovna slika
                <label class="cover">
                  <img id="cover-preview" src="<?= cms_e($imageUrl) ?>" alt=""<?= $imageUrl === '' ? ' hidden' : '' ?>>
                  <span id="cover-label"><?= $imageUrl === '' ? 'Kliknite i izaberite JPG, PNG ili WEBP' : 'Kliknite da zamenite sliku' ?></span>
                  <input id="cover-input" type="file" name="image" accept="image/jpeg,image/png,image/webp"<?= $imageUrl === '' ? ' required' : '' ?>>
                </label>
              </div>
            </div>
          </section>
          <section class="card panel">
            <h2>Tekst</h2>
            <div class="toolbar" aria-label="Umetanje">
              <button type="button" data-wrap="<p>" data-end="</p>">Pasus</button>
              <button type="button" data-wrap="<h2>" data-end="</h2>">Naslov</button>
              <button type="button" data-wrap="<strong>" data-end="</strong>">Podebljano</button>
              <button type="button" data-wrap="<em>" data-end="</em>">Kurziv</button>
              <button type="button" data-wrap="<ul>\n  <li>" data-end="</li>\n</ul>">Lista</button>
              <button type="button" id="insert-link">Link</button>
            </div>
            <label>Tekst članka
              <textarea name="body_sr" required><?= cms_e($post['body_sr']) ?></textarea>
              <span class="hint">Prazan red pravi novi pasus. Možete koristiti i oznake p, h2, h3, ul, ol, li, strong, em i a.</span>
            </label>
          </section>
        </div>
        <aside class="preview">
          <p class="muted" style="margin-bottom:0.5rem">Ovako izgleda kartica na blogu</p>
          <article class="card mini-card">
            <img id="mini-image" src="<?= cms_e($imageUrl) ?>" alt=""<?= $imageUrl === '' ? ' hidden' : '' ?>>
            <div class="mini-fallback" id="mini-fallback"<?= $imageUrl !== '' ? ' hidden' : '' ?>>Slika</div>
            <div class="mini-body">
              <time id="mini-date"><?= cms_e($post['date'] !== '' ? cms_date_label($post['date']) : '') ?></time>
              <h3 id="mini-title"><?= cms_e($post['title_sr'] !== '' ? $post['title_sr'] : 'Naslov članka') ?></h3>
              <p id="mini-excerpt"><?= cms_e($post['excerpt_sr'] !== '' ? $post['excerpt_sr'] : 'Kratak opis će se pojaviti ovde.') ?></p>
            </div>
          </article>
        </aside>
      </div>
    </form>
  </main>
  <script>
    (function () {
      const form = document.getElementById('editor');
      const title = form.querySelector('[name="title_sr"]');
      const excerpt = form.querySelector('[name="excerpt_sr"]');
      const date = form.querySelector('[name="date"]');
      const slug = form.querySelector('[name="slug"]');
      const body = form.querySelector('[name="body_sr"]');
      const cover = document.getElementById('cover-input');
      const coverPreview = document.getElementById('cover-preview');
      const coverLabel = document.getElementById('cover-label');
      const miniImage = document.getElementById('mini-image');
      const miniFallback = document.getElementById('mini-fallback');
      const months = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
      let slugTouched = slug.value !== '';

      function cmsSlug(value) {
        const map = { 'š': 's', 'đ': 'dj', 'č': 'c', 'ć': 'c', 'ž': 'z', 'Š': 's', 'Đ': 'dj', 'Č': 'c', 'Ć': 'c', 'Ž': 'z' };
        return value.trim().replace(/[šđčćžŠĐČĆŽ]/g, function (ch) { return map[ch] || ch; })
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }

      function labelDate(value) {
        const parts = value.split('-');
        if (parts.length !== 3) return '';
        const month = months[Number(parts[1]) - 1];
        if (!month) return value;
        return month + ' ' + Number(parts[2]) + ', ' + parts[0];
      }

      function showImage(src) {
        coverPreview.hidden = false;
        miniImage.hidden = false;
        miniFallback.hidden = true;
        coverPreview.src = src;
        miniImage.src = src;
        coverLabel.textContent = 'Kliknite da zamenite sliku';
      }

      function render() {
        document.getElementById('mini-title').textContent = title.value.trim() || 'Naslov članka';
        document.getElementById('mini-excerpt').textContent = excerpt.value.trim() || 'Kratak opis će se pojaviti ovde.';
        document.getElementById('mini-date').textContent = labelDate(date.value);
      }

      title.addEventListener('input', function () {
        if (!slugTouched) slug.value = cmsSlug(title.value);
        render();
      });
      slug.addEventListener('input', function () { slugTouched = true; });
      excerpt.addEventListener('input', render);
      date.addEventListener('input', render);
      cover.addEventListener('change', function () {
        const file = cover.files && cover.files[0];
        if (!file) return;
        showImage(URL.createObjectURL(file));
      });
      form.querySelectorAll('[data-wrap]').forEach(function (button) {
        button.addEventListener('click', function () {
          const start = body.selectionStart;
          const end = body.selectionEnd;
          const selected = body.value.slice(start, end) || 'tekst';
          body.setRangeText(button.dataset.wrap + selected + button.dataset.end, start, end, 'end');
          body.focus();
        });
      });
      document.getElementById('insert-link').addEventListener('click', function () {
        const url = window.prompt('Adresa linka (https://...)');
        if (!url || !/^(https?:\/\/|\/)/.test(url)) return;
        const start = body.selectionStart;
        const end = body.selectionEnd;
        const selected = body.value.slice(start, end) || 'link';
        body.setRangeText('<a href="' + url.replace(/"/g, '') + '">' + selected + '</a>', start, end, 'end');
        body.focus();
      });
    })();
  </script>

<?php else:
    $posts = cms_posts();
?>
  <main class="wrap">
    <?php if ($error !== ''): ?><p class="error"><?= cms_e($error) ?></p><?php endif; ?>
    <?php if ($notice !== ''): ?><p class="ok"><?= cms_e($notice) ?></p><?php endif; ?>
    <div class="page-head">
      <div>
        <h1>Članci</h1>
        <p class="muted"><?php $n = count($posts); echo $n === 1 ? '1 objavljen članak' : ($n >= 2 && $n <= 4 ? $n . ' objavljena članka' : $n . ' objavljenih članaka'); ?></p>
      </div>
      <a class="button" href="?action=edit">Novi članak</a>
    </div>
    <?php if ($posts === []): ?>
      <div class="empty">
        <h2>Još nema članaka</h2>
        <p class="muted">Dodajte prvi tekst i on će se pojaviti na početnoj i na blogu.</p>
        <p style="margin-top:1rem"><a class="button" href="?action=edit">Novi članak</a></p>
      </div>
    <?php else: ?>
      <ul class="post-list">
        <?php foreach ($posts as $post): ?>
          <li class="post">
            <?php if (($post['image'] ?? '') !== ''): ?>
              <img src="../<?= cms_e($post['image']) ?>" alt="">
            <?php else: ?>
              <div class="thumb-empty">Bez slike</div>
            <?php endif; ?>
            <div>
              <time datetime="<?= cms_e($post['date']) ?>"><?= cms_e(cms_date_label($post['date'])) ?></time>
              <h2><a href="?action=edit&slug=<?= cms_e($post['slug']) ?>"><?= cms_e($post['title_sr']) ?></a></h2>
              <p><?= cms_e($post['excerpt_sr']) ?></p>
            </div>
            <div class="row-actions">
              <a href="?action=edit&slug=<?= cms_e($post['slug']) ?>">Izmeni</a>
              <a class="view" href="/<?= cms_e($post['slug']) ?>/" target="_blank" rel="noopener">Pogledaj</a>
              <form method="post" onsubmit="return confirm('Obrisati ovaj članak?')">
                <input type="hidden" name="csrf" value="<?= cms_e($token) ?>">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="slug" value="<?= cms_e($post['slug']) ?>">
                <button class="danger" type="submit">Obriši</button>
              </form>
            </div>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </main>
<?php endif; ?>
</body>
</html>
