(function () {
  var grid = document.querySelector(".blog-grid[data-posts]");
  if (!grid) return;

  var postsUrl = grid.getAttribute("data-posts");
  var lang = grid.getAttribute("data-lang") || "sr";
  var prefix = grid.getAttribute("data-prefix") || "";
  var limitValue = grid.getAttribute("data-limit");
  var limit = limitValue ? Number(limitValue) : null;
  var months = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function label(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return iso || "";
    var month = months[Number(parts[1]) - 1];
    if (!month) return iso;
    return month + " " + Number(parts[2]) + ", " + parts[0];
  }

  fetch(postsUrl)
    .then(function (response) {
      if (!response.ok) throw new Error("posts");
      return response.json();
    })
    .then(function (posts) {
      if (!Array.isArray(posts)) return;
      var shown = limit ? posts.slice(0, limit) : posts;
      var more = lang === "en" ? "Read more" : "Dalje";
      grid.innerHTML = shown.map(function (post) {
        var title = (lang === "en" ? post.title_en : post.title_sr) || post.title_sr || "";
        var excerpt = (lang === "en" ? post.excerpt_en : post.excerpt_sr) || post.excerpt_sr || "";
        var href = prefix + post.slug + "/";
        return (
          '<article class="blog-card">' +
            '<a href="' + esc(href) + '" class="blog-card-media">' +
              '<img src="' + esc(prefix + post.image) + '" alt="' + esc(title) + '" width="1000" height="750" loading="lazy">' +
            "</a>" +
            '<div class="blog-card-body">' +
              '<time datetime="' + esc(post.date) + '">' + esc(label(post.date)) + "</time>" +
              "<h3><a href=\"" + esc(href) + "\">" + esc(title) + "</a></h3>" +
              "<p>" + esc(excerpt) + "</p>" +
              '<a href="' + esc(href) + '" class="link-arrow">' + more + ' <span aria-hidden="true">→</span></a>' +
            "</div>" +
          "</article>"
        );
      }).join("\n");
    })
    .catch(function () {});
})();
