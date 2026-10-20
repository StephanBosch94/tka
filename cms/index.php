<?php

require __DIR__ . '/lib.php';
cms_start();

$action = $_POST['action'] ?? $_GET['action'] ?? 'list';
$error = '';
$notice = isset($_GET['saved']) ? 'Članak je sačuvan i objavljen.' : '';

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
            header('Location: ./?saved=1');
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

function cms_field(string $label, string $name, string $value, string $type = 'text'): void
{
    echo '<label>' . cms_e($label) . '<input type="' . $type . '" name="' . cms_e($name) . '" value="' . cms_e($value) . '"></label>';
}

header('Content-Type: text/html; charset=utf-8');
header('X-Frame-Options: DENY');
$token = cms_token();
?>
<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Blog CMS – TKA</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px/1.5 Manrope, system-ui, sans-serif; background: #f4f6fa; color: #0b1220; }
    header, main { width: min(980px, calc(100% - 2rem)); margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 0; }
    h1 { font-size: 1.6rem; margin: 0; }
    a { color: #18254b; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.25rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.75rem 0.4rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    form.stack, .grid { display: grid; gap: 0.9rem; }
    .grid { grid-template-columns: 1fr 1fr; }
    label { display: grid; gap: 0.35rem; font-size: 0.85rem; font-weight: 700; }
    input, textarea { width: 100%; padding: 0.7rem 0.8rem; border: 1px solid #d5dce8; border-radius: 10px; font: inherit; }
    textarea { min-height: 280px; font-weight: 400; }
    button, .button { border: 0; border-radius: 999px; padding: 0.7rem 1rem; background: #e48736; color: #fff; font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-block; }
    .ghost { background: #18254b; }
    .danger { background: transparent; color: #9b2c2c; padding: 0; }
    .error { background: #fff1f0; color: #9b2c2c; padding: 0.8rem 1rem; border-radius: 10px; }
    .ok { background: #eefaf1; color: #17663a; padding: 0.8rem 1rem; border-radius: 10px; }
    .actions { display: flex; gap: 0.75rem; align-items: center; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<header>
  <h1>Blog</h1>
  <?php if (cms_logged_in()): ?>
    <a href="?action=logout">Odjava</a>
  <?php endif; ?>
</header>
<main>
<?php if ($error !== ''): ?><p class="error"><?= cms_e($error) ?></p><?php endif; ?>
<?php if ($notice !== '' && $error === ''): ?><p class="ok"><?= cms_e($notice) ?></p><?php endif; ?>

<?php if ($action === 'setup'): ?>
  <form class="card stack" method="post">
    <input type="hidden" name="csrf" value="<?= cms_e($token) ?>">
    <input type="hidden" name="action" value="setup">
    <p>Napravite lozinku za uređivanje bloga. Biće sačuvana samo na serveru.</p>
    <label>Lozinka<input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
    <label>Ponovite lozinku<input type="password" name="password_again" required minlength="10" autocomplete="new-password"></label>
    <button type="submit">Sačuvaj lozinku</button>
  </form>

<?php elseif ($action === 'login'): ?>
  <form class="card stack" method="post">
    <input type="hidden" name="csrf" value="<?= cms_e($token) ?>">
    <input type="hidden" name="action" value="login">
    <label>Lozinka<input type="password" name="password" required autocomplete="current-password"></label>
    <button type="submit">Prijava</button>
  </form>

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
?>
  <form class="card stack" method="post" enctype="multipart/form-data">
    <input type="hidden" name="csrf" value="<?= cms_e($token) ?>">
    <input type="hidden" name="action" value="save">
    <input type="hidden" name="original_slug" value="<?= cms_e($slug) ?>">
    <input type="hidden" name="current_image" value="<?= cms_e($post['image']) ?>">
    <div class="grid">
      <?php cms_field('Naslov (srpski)', 'title_sr', $post['title_sr']); ?>
      <?php cms_field('Naslov (engleski)', 'title_en', $post['title_en']); ?>
      <?php cms_field('Kratak opis (srpski)', 'excerpt_sr', $post['excerpt_sr']); ?>
      <?php cms_field('Kratak opis (engleski)', 'excerpt_en', $post['excerpt_en']); ?>
      <?php cms_field('Uvod u heroju', 'lead_sr', $post['lead_sr']); ?>
      <?php cms_field('Datum', 'date', $post['date'], 'date'); ?>
      <?php cms_field('Adresa članka', 'slug', $post['slug']); ?>
      <label>Naslovna slika<input type="file" name="image" accept="image/jpeg,image/png,image/webp"></label>
    </div>
    <?php if ($post['image'] !== ''): ?><p>Trenutna slika: <?= cms_e($post['image']) ?></p><?php endif; ?>
    <label>Tekst
      <textarea name="body_sr"><?= cms_e($post['body_sr']) ?></textarea>
    </label>
    <p>Prazan red pravi novi pasus. Možete koristiti i oznake p, h2, h3, ul, ol, li, strong, em i a.</p>
    <div class="actions">
      <button type="submit">Objavi</button>
      <a class="button ghost" href="./">Nazad</a>
    </div>
  </form>

<?php else: ?>
  <div class="actions" style="margin-bottom:1rem">
    <a class="button" href="?action=edit">Novi članak</a>
  </div>
  <div class="card">
    <table>
      <thead><tr><th>Datum</th><th>Naslov</th><th></th></tr></thead>
      <tbody>
      <?php foreach (cms_posts() as $post): ?>
        <tr>
          <td><?= cms_e(cms_date_label($post['date'])) ?></td>
          <td><a href="/<?= cms_e($post['slug']) ?>/" target="_blank"><?= cms_e($post['title_sr']) ?></a></td>
          <td class="actions">
            <a href="?action=edit&slug=<?= cms_e($post['slug']) ?>">Izmeni</a>
            <form method="post" onsubmit="return confirm('Obrisati ovaj članak?')">
              <input type="hidden" name="csrf" value="<?= cms_e($token) ?>">
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="slug" value="<?= cms_e($post['slug']) ?>">
              <button class="danger" type="submit">Obriši</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
<?php endif; ?>
</main>
</body>
</html>
