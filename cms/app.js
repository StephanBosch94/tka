(function () {
  var app = document.getElementById("app");
  var logout = document.getElementById("logout");
  var months = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];
  var reserved = ["assets", "api", "blog", "cms", "content", "css", "en", "js", "kontakt", "o-nama", "medjunarodni-drumski-transport", "domaci-transport-i-distribucija", "intermodalni-transport", "skladistenje-i-carinsko-zastupanje", "avio-brodski-i-zeleznicki-transport", "medjunarodni-zbirni-transport", "zbirni-transport-u-srbiji-i-distribucija"];
  var php = null;
  var posts = [];

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function slugify(value) {
    var map = { "š": "s", "đ": "dj", "č": "c", "ć": "c", "ž": "z", "Š": "s", "Đ": "dj", "Č": "c", "Ć": "c", "Ž": "z" };
    return String(value || "").trim().replace(/[šđčćžŠĐČĆŽ]/g, function (ch) { return map[ch] || ch; })
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function dateLabel(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return iso || "";
    var month = months[Number(parts[1]) - 1];
    return month ? month + " " + Number(parts[2]) + ", " + parts[0] : iso;
  }

  function today() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  function plainToHtml(text) {
    text = String(text || "").trim();
    if (!text) return "";
    if (text.indexOf("<") !== -1) {
      return text
        .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
        .replace(/\s(href|src)\s*=\s*("|\')\s*javascript:[^"\']*\2/gi, "")
        .trim();
    }
    return text.split(/\n\s*\n/).map(function (part) {
      return "<p>" + esc(part.trim()).replace(/\n/g, "<br>") + "</p>";
    }).join("\n");
  }

  function excerpt(html, fallback) {
    fallback = String(fallback || "").trim();
    if (fallback) return fallback;
    var text = String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.length <= 180 ? text : text.slice(0, 177).trim() + "…";
  }

  function countLabel(n) {
    if (n === 1) return "1 objavljen članak";
    if (n >= 2 && n <= 4) return n + " objavljena članka";
    return n + " objavljenih članaka";
  }

  function params() {
    return new URLSearchParams(location.search);
  }

  async function phpStatus() {
    try {
      var response = await fetch("index.php?action=status&format=json", { credentials: "same-origin", headers: { Accept: "application/json" } });
      var text = await response.text();
      if (!text || text.trim().charAt(0) === "<") return null;
      var data = JSON.parse(text);
      return data && data.php === true ? data : null;
    } catch (error) {
      return null;
    }
  }

  async function loadPosts() {
    if (php && php.auth) {
      var response = await fetch("index.php?action=posts&format=json", { credentials: "same-origin" });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || "Članci nisu učitani.");
      posts = data.posts || [];
      return;
    }
    var file = await fetch("../content/posts.json");
    if (!file.ok) throw new Error("Članci nisu učitani.");
    posts = await file.json();
  }

  function message() {
    var query = params();
    if (query.get("saved") === "1") return '<p class="ok">Članak je sačuvan i objavljen.</p>';
    if (query.get("deleted") === "1") return '<p class="ok">Članak je obrisan.</p>';
    return "";
  }

  function renderList() {
    logout.hidden = !(php && php.auth);
    var tokenBox = "";
    if (!php) {
      tokenBox = '<label class="card">GitHub token za objavu<input id="token" type="password" autocomplete="off" value="' + esc(sessionStorage.getItem("tka-cms-token") || "") + '"><span class="hint">Potreban je samo na hostu bez PHP-a. Token ostaje u ovom pregledaču i upisuje članak u repozitorijum sa kog se sajt postavlja.</span></label>';
    }
    var rows = posts.map(function (post) {
      var image = post.image ? '<img src="../' + esc(post.image) + '" alt="">' : '<div class="thumb-empty">Bez slike</div>';
      return '<li class="post">' + image +
        "<div><time>" + esc(dateLabel(post.date)) + "</time><h2><a href=\"?edit=" + esc(post.slug) + "\">" + esc(post.title_sr) + "</a></h2><p>" + esc(post.excerpt_sr) + "</p></div>" +
        '<div class="row-actions"><a href="?edit=' + esc(post.slug) + '">Izmeni</a><a class="view" href="../' + esc(post.slug) + '/">Pogledaj</a>' +
        '<button class="danger" type="button" data-delete="' + esc(post.slug) + '">Obriši</button></div></li>';
    }).join("");
    app.className = "wrap";
    app.innerHTML = message() +
      '<div class="page-head"><div><h1>Članci</h1><p class="muted">' + countLabel(posts.length) + "</p></div>" +
      '<a class="button" href="?edit=new">Novi članak</a></div>' + tokenBox +
      (posts.length ? '<ul class="post-list">' + rows + "</ul>" : '<div class="empty"><h2>Još nema članaka</h2><p class="muted">Dodajte prvi tekst i on će se pojaviti na početnoj i na blogu.</p></div>');
    var token = document.getElementById("token");
    if (token) token.addEventListener("change", function () { sessionStorage.setItem("tka-cms-token", token.value.trim()); });
    app.querySelectorAll("[data-delete]").forEach(function (button) {
      button.addEventListener("click", function () { removePost(button.getAttribute("data-delete")); });
    });
  }

  function renderGate() {
    logout.hidden = true;
    app.className = "gate";
    if (php.setup) {
      app.innerHTML = '<form class="card stack" id="gate"><h1>Lozinka za blog</h1><p class="muted">Prvi put ovde. Lozinka ostaje samo na serveru.</p><label>Lozinka<input type="password" name="password" required minlength="10" autocomplete="new-password"></label><label>Ponovite lozinku<input type="password" name="password_again" required minlength="10" autocomplete="new-password"></label><p class="error" hidden></p><button class="primary" type="submit">Sačuvaj lozinku</button></form>';
    } else {
      app.innerHTML = '<form class="card stack" id="gate"><h1>Prijava</h1><p class="muted">Unesite lozinku da biste dodali ili izmenili članak.</p><label>Lozinka<input type="password" name="password" required autocomplete="current-password"></label><p class="error" hidden></p><button class="primary" type="submit">Prijava</button></form>';
    }
    document.getElementById("gate").addEventListener("submit", submitGate);
  }

  function renderEdit(slug) {
    logout.hidden = !(php && php.auth);
    var post = posts.filter(function (item) { return item.slug === slug; })[0] || {
      slug: "", date: today(), image: "", title_sr: "", title_en: "", excerpt_sr: "", excerpt_en: "", lead_sr: "", body_sr: ""
    };
    var isNew = !slug || slug === "new";
    if (isNew) post = { slug: "", date: today(), image: "", title_sr: "", title_en: "", excerpt_sr: "", excerpt_en: "", lead_sr: "", body_sr: "" };
    var imageUrl = post.image ? "../" + post.image : "";
    app.className = "wrap";
    app.innerHTML = '<form id="editor">' +
      '<div class="page-head"><div><a class="text-link" href="./">← Svi članci</a><h1>' + (isNew ? "Novi članak" : "Izmena članka") + "</h1></div>" +
      '<div class="form-actions"><a class="button ghost" href="./">Otkaži</a><button class="primary" type="submit">Objavi</button></div></div>' +
      '<p class="error" id="form-error" hidden></p>' +
      '<div class="editor"><div class="fields">' +
      '<section class="card panel"><h2>Naslov i opis</h2><div class="grid">' +
      field("Naslov (srpski)", "title_sr", post.title_sr, true) +
      field("Naslov (engleski)", "title_en", post.title_en) +
      field("Kratak opis (srpski)", "excerpt_sr", post.excerpt_sr) +
      field("Kratak opis (engleski)", "excerpt_en", post.excerpt_en) +
      field("Uvod u heroju", "lead_sr", post.lead_sr) +
      '<label>Datum<input type="date" name="date" value="' + esc(post.date) + '" required></label></div></section>' +
      '<section class="card panel"><h2>Objava</h2><div class="stack"><label>Adresa članka<input name="slug" value="' + esc(isNew ? "" : post.slug) + '" placeholder="npr. novi-clanak" autocomplete="off"><span class="hint">Ako ostane prazno, adresa se pravi iz srpskog naslova.</span></label>' +
      '<div class="field">Naslovna slika<label class="cover"><img id="cover-preview" alt="" src="' + esc(imageUrl) + '"' + (imageUrl ? "" : " hidden") + "><span id=\"cover-label\">" + (imageUrl ? "Kliknite da zamenite sliku" : "Kliknite i izaberite JPG, PNG ili WEBP") + '</span><input id="cover-input" type="file" name="image" accept="image/jpeg,image/png,image/webp"' + (imageUrl ? "" : " required") + "></label></div></div></section>" +
      '<section class="card panel"><h2>Tekst</h2><div class="toolbar"><button type="button" data-wrap="<p>" data-end="</p>">Pasus</button><button type="button" data-wrap="<h2>" data-end="</h2>">Naslov</button><button type="button" data-wrap="<strong>" data-end="</strong>">Podebljano</button><button type="button" data-wrap="<em>" data-end="</em>">Kurziv</button><button type="button" data-wrap="<ul>\\n  <li>" data-end="</li>\\n</ul>">Lista</button><button type="button" id="insert-link">Link</button></div>' +
      '<label>Tekst članka<textarea name="body_sr" required>' + esc(post.body_sr) + '</textarea><span class="hint">Prazan red pravi novi pasus.</span></label></section></div>' +
      '<aside class="preview"><p class="muted" style="margin-bottom:0.5rem">Ovako izgleda kartica na blogu</p><article class="card mini-card">' +
      '<img id="mini-image" alt="" src="' + esc(imageUrl) + '"' + (imageUrl ? "" : " hidden") + "><div class=\"mini-fallback\" id=\"mini-fallback\"" + (imageUrl ? " hidden" : "") + ">Slika</div>" +
      '<div class="mini-body"><time id="mini-date">' + esc(dateLabel(post.date)) + '</time><h3 id="mini-title">' + esc(post.title_sr || "Naslov članka") + '</h3><p id="mini-excerpt">' + esc(post.excerpt_sr || "Kratak opis će se pojaviti ovde.") + "</p></div></article></aside></div>" +
      '<input type="hidden" name="original_slug" value="' + esc(isNew ? "" : post.slug) + '"><input type="hidden" name="current_image" value="' + esc(post.image) + '"></form>';
    bindEditor(isNew);
  }

  function field(label, name, value, required) {
    return "<label>" + label + '<input name="' + name + '" value="' + esc(value) + '"' + (required ? " required" : "") + "></label>";
  }

  function bindEditor(isNew) {
    var form = document.getElementById("editor");
    var title = form.querySelector('[name="title_sr"]');
    var excerptInput = form.querySelector('[name="excerpt_sr"]');
    var date = form.querySelector('[name="date"]');
    var slug = form.querySelector('[name="slug"]');
    var body = form.querySelector('[name="body_sr"]');
    var cover = document.getElementById("cover-input");
    var slugTouched = slug.value !== "";

    function showImage(src) {
      ["cover-preview", "mini-image"].forEach(function (id) {
        var image = document.getElementById(id);
        image.hidden = false;
        image.src = src;
      });
      document.getElementById("mini-fallback").hidden = true;
      document.getElementById("cover-label").textContent = "Kliknite da zamenite sliku";
    }

    function renderPreview() {
      document.getElementById("mini-title").textContent = title.value.trim() || "Naslov članka";
      document.getElementById("mini-excerpt").textContent = excerptInput.value.trim() || "Kratak opis će se pojaviti ovde.";
      document.getElementById("mini-date").textContent = dateLabel(date.value);
    }

    title.addEventListener("input", function () {
      if (!slugTouched) slug.value = slugify(title.value);
      renderPreview();
    });
    slug.addEventListener("input", function () { slugTouched = true; });
    excerptInput.addEventListener("input", renderPreview);
    date.addEventListener("input", renderPreview);
    cover.addEventListener("change", function () {
      var file = cover.files && cover.files[0];
      if (file) showImage(URL.createObjectURL(file));
    });
    form.querySelectorAll("[data-wrap]").forEach(function (button) {
      button.addEventListener("click", function () {
        var selected = body.value.slice(body.selectionStart, body.selectionEnd) || "tekst";
        var wrap = button.getAttribute("data-wrap").replace(/\\n/g, "\n");
        var end = button.getAttribute("data-end").replace(/\\n/g, "\n");
        body.setRangeText(wrap + selected + end, body.selectionStart, body.selectionEnd, "end");
        body.focus();
      });
    });
    document.getElementById("insert-link").addEventListener("click", function () {
      var url = window.prompt("Adresa linka (https://...)");
      if (!url || !/^(https?:\/\/|\/)/.test(url)) return;
      var selected = body.value.slice(body.selectionStart, body.selectionEnd) || "link";
      body.setRangeText('<a href="' + url.replace(/"/g, "") + '">' + selected + "</a>", body.selectionStart, body.selectionEnd, "end");
      body.focus();
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      savePost(new FormData(form), isNew);
    });
  }

  function showError(text) {
    var box = document.getElementById("form-error");
    if (!box) {
      app.insertAdjacentHTML("afterbegin", '<p class="error">' + esc(text) + "</p>");
      return;
    }
    box.hidden = false;
    box.textContent = text;
  }

  async function submitGate(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var body = new FormData(form);
    body.set("action", php.setup ? "setup" : "login");
    body.set("format", "json");
    body.set("csrf", php.csrf || "");
    var response = await fetch("index.php", { method: "POST", body: body, credentials: "same-origin" });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = form.querySelector(".error");
      error.hidden = false;
      error.textContent = data.error || "Prijava nije uspela.";
      return;
    }
    location.href = "./";
  }

  async function savePost(formData, isNew) {
    if (php) {
      formData.set("action", "save");
      formData.set("format", "json");
      formData.set("csrf", php.csrf || "");
      var response = await fetch("index.php", { method: "POST", body: formData, credentials: "same-origin" });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) return showError(data.error || "Članak nije sačuvan.");
      location.href = "./?saved=1";
      return;
    }
    try {
      await publishStatic(formData, null);
      location.href = "./?saved=1";
    } catch (error) {
      showError(error.message || "Članak nije sačuvan.");
    }
  }

  async function removePost(slug) {
    if (!window.confirm("Obrisati ovaj članak?")) return;
    if (php) {
      var body = new FormData();
      body.set("action", "delete");
      body.set("format", "json");
      body.set("csrf", php.csrf || "");
      body.set("slug", slug);
      var response = await fetch("index.php", { method: "POST", body: body, credentials: "same-origin" });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) return showError(data.error || "Članak nije obrisan.");
      location.href = "./?deleted=1";
      return;
    }
    try {
      var formData = new FormData();
      formData.set("original_slug", slug);
      formData.set("delete", "1");
      await publishStatic(formData, slug);
      location.href = "./?deleted=1";
    } catch (error) {
      showError(error.message || "Članak nije obrisan.");
    }
  }

  function buildPost(formData) {
    var title = String(formData.get("title_sr") || "").trim();
    var slug = slugify(String(formData.get("slug") || "")) || slugify(title);
    var date = String(formData.get("date") || "");
    var body = plainToHtml(String(formData.get("body_sr") || ""));
    if (!title) throw new Error("Naslov na srpskom je obavezan.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Datum nije ispravan.");
    if (!body) throw new Error("Tekst članka je obavezan.");
    if (!slug || reserved.indexOf(slug) !== -1) throw new Error("Taj naziv adrese je rezervisan. Izaberite drugi.");
    return {
      slug: slug,
      date: date,
      image: String(formData.get("current_image") || ""),
      title_sr: title,
      title_en: String(formData.get("title_en") || "").trim(),
      excerpt_sr: excerpt(body, String(formData.get("excerpt_sr") || "")),
      excerpt_en: String(formData.get("excerpt_en") || "").trim(),
      lead_sr: String(formData.get("lead_sr") || "").trim(),
      body_sr: body
    };
  }

  function articleHtml(post) {
    var title = esc(post.title_sr);
    var lead = esc(post.lead_sr || post.excerpt_sr);
    var image = esc("../" + post.image);
    var description = esc(post.excerpt_sr);
    return "<!DOCTYPE html>\n<html lang=\"sr\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <meta name=\"description\" content=\"" + description + "\">\n  <title>" + title + " – TKA</title>\n  <link rel=\"icon\" href=\"../assets/images/favicon.png\" type=\"image/png\">\n  <link rel=\"stylesheet\" href=\"../css/style.css\">\n</head>\n<body>\n  <header class=\"site-header\" id=\"header\"><div class=\"header-inner\">" +
      "<a href=\"../\" class=\"logo\" aria-label=\"TKA Logistics – početna\"><img src=\"../assets/images/logo-tka.png\" alt=\"TKA Logistics\" width=\"173\" height=\"75\" class=\"logo-img\"></a>" +
      "<nav class=\"nav-main\" aria-label=\"Glavna navigacija\"><ul class=\"nav-list\"><li><a href=\"../\">Home</a></li><li><a href=\"../o-nama/\">O nama</a></li><li><a href=\"../blog/\" aria-current=\"page\">Blog</a></li><li><a href=\"../kontakt/\">Kontakt</a></li></ul></nav>" +
      "<a href=\"../kontakt/#upit\" class=\"btn btn-primary header-cta\">Pošalji upit</a></div></header>\n  <main id=\"main\">\n    <section class=\"page-hero page-hero--article\" style=\"--page-hero-image: url('" + image + "');\">\n      <div class=\"container page-hero-inner\"><span class=\"pill-badge\">Blog</span><h1 class=\"hero-title\">" + title + "</h1><p class=\"hero-lead\">" + lead + "</p></div>\n    </section>\n    <section class=\"section page-section\"><div class=\"container\"><div class=\"article-body\"><p class=\"article-meta\"><time datetime=\"" + esc(post.date) + "\">" + esc(dateLabel(post.date)) + "</time></p><div class=\"prose\">\n" + post.body_sr + "\n</div></div></div></section>\n  </main>\n  <footer class=\"site-footer\"><div class=\"container footer-bottom\"><p>© 2026 TKA, All Rights Reserved</p><a class=\"footer-credit\" href=\"https://gowithflow.rs\">Created by gowithflow.rs</a></div></footer>\n  <script src=\"../js/main.js\"></script>\n</body>\n</html>\n";
  }

  function fill(text, pattern, value) {
    return text.replace(pattern, function () { return value; });
  }

  async function articleFor(site, token, post) {
    var current = "";
    try {
      current = await githubFile(site, token, post.slug + "/index.html");
    } catch (error) {
      return articleHtml(post);
    }
    return fill(fill(fill(fill(fill(fill(current,
      /<title>[\s\S]*?<\/title>/, "<title>" + esc(post.title_sr) + " – TKA</title>"),
      /<meta name="description" content="[^"]*"/, '<meta name="description" content="' + esc(post.excerpt_sr) + '"'),
      /<h1 class="hero-title">[\s\S]*?<\/h1>/, '<h1 class="hero-title">' + esc(post.title_sr) + "</h1>"),
      /<p class="hero-lead">[\s\S]*?<\/p>/, '<p class="hero-lead">' + esc(post.lead_sr || post.excerpt_sr) + "</p>"),
      /<time datetime="[^"]*">[\s\S]*?<\/time>/, '<time datetime="' + esc(post.date) + '">' + esc(dateLabel(post.date)) + "</time>"),
      /<div class="prose">[\s\S]*?<\/div>/, '<div class="prose">\n' + post.body_sr + "\n</div>")
      .replace(/--page-hero-image:\s*url\((['"]?)[^)'"]+\1\)/, "--page-hero-image: url('" + esc("../" + post.image) + "')");
  }

  function cardHtml(post, prefix, lang) {
    var title = esc((lang === "en" ? post.title_en : post.title_sr) || post.title_sr);
    var text = esc((lang === "en" ? post.excerpt_en : post.excerpt_sr) || post.excerpt_sr);
    var href = prefix + esc(post.slug) + "/";
    var more = lang === "en" ? "Read more" : "Dalje";
    return "          <article class=\"blog-card\">\n            <a href=\"" + href + "\" class=\"blog-card-media\">\n              <img src=\"" + prefix + esc(post.image) + "\" alt=\"" + title + "\" width=\"1000\" height=\"750\" loading=\"lazy\">\n            </a>\n            <div class=\"blog-card-body\">\n              <time datetime=\"" + esc(post.date) + "\">" + esc(dateLabel(post.date)) + "</time>\n              <h3><a href=\"" + href + "\">" + title + "</a></h3>\n              <p>" + text + "</p>\n              <a href=\"" + href + "\" class=\"link-arrow\">" + more + " <span aria-hidden=\"true\">→</span></a>\n            </div>\n          </article>";
  }

  function replaceGrid(text, html) {
    var start = "<!-- cms:blog-grid -->";
    var end = "<!-- /cms:blog-grid -->";
    var pattern = new RegExp(start + "[\\s\\S]*?" + end);
    if (!pattern.test(text)) throw new Error("Blog lista nije pronađena u repozitorijumu.");
    return text.replace(pattern, start + "\n" + html + "\n          " + end);
  }

  async function publishStatic(formData, deleteSlug) {
    var token = (document.getElementById("token") && document.getElementById("token").value.trim()) || sessionStorage.getItem("tka-cms-token") || "";
    if (!token) token = window.prompt("GitHub token za objavu. Na ovom hostu nema PHP-a, pa se članak upisuje u repozitorijum.") || "";
    if (!token) throw new Error("Objava je zaustavljena jer nema tokena.");
    sessionStorage.setItem("tka-cms-token", token);
    var siteResponse = await fetch("site.json");
    if (!siteResponse.ok) throw new Error("Repozitorijum nije podešen.");
    var site = await siteResponse.json();
    var next = posts.slice();
    var remove = null;
    var savedPost = null;
    var imageFile = formData.get("image");
    var imagePath = "";

    if (deleteSlug) {
      next = next.filter(function (post) { return post.slug !== deleteSlug; });
      remove = deleteSlug;
    } else {
      var post = buildPost(formData);
      savedPost = post;
      var original = slugify(String(formData.get("original_slug") || ""));
      if (imageFile && imageFile.size) {
        var ext = (imageFile.type === "image/png") ? "png" : (imageFile.type === "image/webp" ? "webp" : "jpg");
        imagePath = "assets/images/blog/" + today().replace(/-/g, "") + "-" + Math.random().toString(16).slice(2, 10) + "." + ext;
        post.image = imagePath;
      }
      if (!/^assets\/images\/blog\/[A-Za-z0-9._-]+$/.test(post.image)) throw new Error("Članak mora imati sliku.");
      var duplicate = next.findIndex(function (item) { return item.slug === post.slug; });
      var existing = original ? next.findIndex(function (item) { return item.slug === original; }) : -1;
      if (duplicate !== -1 && duplicate !== existing) throw new Error("Članak sa tom adresom već postoji.");
      if (existing === -1) next.push(post);
      else {
        next[existing] = post;
        if (original && original !== post.slug) remove = original;
      }
    }

    next.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var tree = [];
    tree.push({ path: "content/posts.json", mode: "100644", type: "blob", sha: await githubBlob(site, token, JSON.stringify(next, null, 2) + "\n", "utf-8") });
    if (savedPost) {
      var page = await articleFor(site, token, savedPost);
      tree.push({ path: savedPost.slug + "/index.html", mode: "100644", type: "blob", sha: await githubBlob(site, token, page, "utf-8") });
    }
    if (remove) tree.push({ path: remove + "/index.html", mode: "100644", type: "blob", sha: null });
    if (imageFile && imageFile.size && imagePath) {
      var bytes = await fileBase64(imageFile);
      tree.push({ path: imagePath, mode: "100644", type: "blob", sha: await githubBlob(site, token, bytes, "base64") });
    }
    var grids = [
      ["index.html", "", "sr", 3],
      ["en/index.html", "../", "en", 3],
      ["blog/index.html", "../", "sr", null],
      ["en/blog-2/index.html", "../../", "en", null]
    ];
    for (var g = 0; g < grids.length; g++) {
      var current = await githubFile(site, token, grids[g][0]);
      var cards = (grids[g][3] ? next.slice(0, grids[g][3]) : next).map(function (post) {
        return cardHtml(post, grids[g][1], grids[g][2]);
      }).join("\n");
      tree.push({ path: grids[g][0], mode: "100644", type: "blob", sha: await githubBlob(site, token, replaceGrid(current, cards), "utf-8") });
    }
    await githubCommit(site, token, tree, deleteSlug ? "Obriši članak iz CMS-a." : "Objavi članak iz CMS-a.");
  }

  function fileBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(",")[1]); };
      reader.onerror = function () { reject(new Error("Slika nije pročitana.")); };
      reader.readAsDataURL(file);
    });
  }

  async function github(site, token, path, options) {
    var response = await fetch("https://api.github.com/repos/" + site.owner + "/" + site.repo + path, {
      method: options && options.method || "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: options && options.body ? JSON.stringify(options.body) : undefined
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.message || "Repozitorijum nije ažuriran.");
    return data;
  }

  function githubBlob(site, token, content, encoding) {
    return github(site, token, "/git/blobs", { method: "POST", body: { content: content, encoding: encoding } }).then(function (data) { return data.sha; });
  }

  async function githubFile(site, token, path) {
    var data = await github(site, token, "/contents/" + path + "?ref=" + encodeURIComponent(site.branch));
    var binary = atob(String(data.content || "").replace(/\n/g, ""));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function githubCommit(site, token, tree, message) {
    var ref = await github(site, token, "/git/ref/heads/" + site.branch);
    var parent = ref.object.sha;
    var commit = await github(site, token, "/git/commits/" + parent);
    var nextTree = await github(site, token, "/git/trees", { method: "POST", body: { base_tree: commit.tree.sha, tree: tree } });
    var nextCommit = await github(site, token, "/git/commits", { method: "POST", body: { message: message, tree: nextTree.sha, parents: [parent] } });
    await github(site, token, "/git/refs/heads/" + site.branch, { method: "PATCH", body: { sha: nextCommit.sha } });
  }

  async function start() {
    var edit = params().get("edit");
    php = await phpStatus();
    if (php && (php.setup || !php.auth)) {
      renderGate();
      return;
    }
    try {
      await loadPosts();
    } catch (error) {
      app.innerHTML = '<p class="error">' + esc(error.message) + "</p>";
      return;
    }
    if (edit) renderEdit(edit);
    else renderList();
  }

  start();
})();
