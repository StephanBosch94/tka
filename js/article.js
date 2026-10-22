(function () {
  var root = document.querySelector("[data-sanity-article]");
  if (!root || !window.tkaSanity) return;

  var lang = root.getAttribute("data-lang") || "sr";
  var preset = root.getAttribute("data-slug") || "";
  var params = new URLSearchParams(location.search);
  var slug = preset || params.get("slug") || "";
  var fallbackUrl = root.getAttribute("data-posts") || "";
  var prefix = root.getAttribute("data-prefix") || "";
  var titleEl = document.querySelector(".hero-title");
  var leadEl = document.querySelector(".hero-lead");
  var timeEl = document.querySelector(".article-meta time");
  var proseEl = document.querySelector(".prose");
  var heroEl = document.querySelector(".page-hero--article");
  var months = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];

  function label(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return iso || "";
    var month = months[Number(parts[1]) - 1];
    if (!month) return iso;
    return month + " " + Number(parts[2]) + ", " + parts[0];
  }

  function text(post, key) {
    var local = post[key + "_" + lang];
    return local || post[key + "_sr"] || "";
  }

  function show(post) {
    var title = text(post, "title");
    var lead = text(post, "lead") || text(post, "excerpt");
    var body = text(post, "body");
    if (titleEl) titleEl.textContent = title;
    if (leadEl) leadEl.textContent = lead;
    if (timeEl) {
      timeEl.dateTime = post.date || "";
      timeEl.textContent = label(post.date);
    }
    if (proseEl) proseEl.innerHTML = body || "";
    if (heroEl && post.image) {
      var image = /^https?:\/\//.test(post.image) ? post.image : prefix + post.image;
      heroEl.style.setProperty("--page-hero-image", "url('" + image.replace(/["'\\()]/g, "") + "')");
    }
    if (title) document.title = title + " – TKA";
    var description = document.querySelector('meta[name="description"]');
    if (description && lead) description.setAttribute("content", lead);
    var sr = document.getElementById("lang-sr");
    var en = document.getElementById("lang-en");
    if (sr) sr.href = "/blog/clanak/?slug=" + encodeURIComponent(post.slug);
    if (en) en.href = "/en/article/?slug=" + encodeURIComponent(post.slug);
  }

  function missing() {
    if (preset) return;
    if (titleEl) titleEl.textContent = lang === "en" ? "Article not found" : "Članak nije pronađen";
    if (leadEl) leadEl.textContent = "";
    if (proseEl) {
      proseEl.innerHTML = "<p>" + (lang === "en" ? "This article is not published." : "Ovaj članak nije objavljen.") + "</p>";
    }
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    missing();
    return;
  }

  if (preset && !window.tkaSanity.configured()) return;

  window.tkaSanity.loadPost(slug, fallbackUrl).then(function (post) {
    if (post) show(post);
    else missing();
  }).catch(function () {
    missing();
  });
})();
