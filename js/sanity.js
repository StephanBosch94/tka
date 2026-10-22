(function () {
  var cfg = window.TKA_SANITY || {};
  var projectId = String(cfg.projectId || "");
  var dataset = String(cfg.dataset || "production");
  var api = "2024-10-21";
  var listQuery =
    '*[_type == "post" && defined(slug.current)] | order(date desc) {' +
    '"slug": slug.current, date, "title_sr": titleSr, "title_en": titleEn,' +
    '"excerpt_sr": excerptSr, "excerpt_en": excerptEn, "lead_sr": leadSr, "lead_en": leadEn,' +
    '"image": image.asset->url, bodySr, bodyEn}';
  var oneQuery =
    '*[_type == "post" && slug.current == $slug][0] {' +
    '"slug": slug.current, date, "title_sr": titleSr, "title_en": titleEn,' +
    '"excerpt_sr": excerptSr, "excerpt_en": excerptEn, "lead_sr": leadSr, "lead_en": leadEn,' +
    '"image": image.asset->url, bodySr, bodyEn}';

  function configured() {
    return /^[a-z0-9-]+$/.test(projectId);
  }

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function safeHref(href) {
    var value = String(href || "").trim();
    if (/^(https?:|mailto:|\/)/i.test(value)) return value;
    return "";
  }

  function blocksToHtml(blocks) {
    if (!Array.isArray(blocks)) return "";
    var html = "";
    var list = "";
    function closeList() {
      if (!list) return;
      html += "</" + list + ">";
      list = "";
    }
    blocks.forEach(function (block) {
      if (!block || block._type !== "block") return;
      var text = (block.children || []).map(function (child) {
        var piece = esc(child.text).replace(/\n/g, "<br>");
        var marks = child.marks || [];
        marks.forEach(function (mark) {
          if (mark === "strong") piece = "<strong>" + piece + "</strong>";
          if (mark === "em") piece = "<em>" + piece + "</em>";
          var def = (block.markDefs || []).find(function (item) { return item._key === mark; });
          if (def && def._type === "link") {
            var href = safeHref(def.href);
            if (href) piece = '<a href="' + esc(href) + '">' + piece + "</a>";
          }
        });
        return piece;
      }).join("");
      if (block.listItem) {
        var tag = block.listItem === "number" ? "ol" : "ul";
        if (list !== tag) {
          closeList();
          html += "<" + tag + ">";
          list = tag;
        }
        html += "<li>" + text + "</li>";
        return;
      }
      closeList();
      var style = block.style === "h2" || block.style === "h3" ? block.style : "p";
      html += "<" + style + ">" + text + "</" + style + ">";
    });
    closeList();
    return html;
  }

  function mapPost(doc) {
    if (!doc || !doc.slug) return null;
    return {
      slug: doc.slug,
      date: doc.date || "",
      image: doc.image || "",
      title_sr: doc.title_sr || "",
      title_en: doc.title_en || "",
      excerpt_sr: doc.excerpt_sr || "",
      excerpt_en: doc.excerpt_en || "",
      lead_sr: doc.lead_sr || "",
      lead_en: doc.lead_en || "",
      body_sr: blocksToHtml(doc.bodySr),
      body_en: blocksToHtml(doc.bodyEn)
    };
  }

  function query(groq, params) {
    var url = "https://" + projectId + ".api.sanity.io/v" + api + "/data/query/" + dataset +
      "?perspective=published&query=" + encodeURIComponent(groq);
    Object.keys(params || {}).forEach(function (key) {
      url += "&$" + key + "=" + encodeURIComponent(JSON.stringify(params[key]));
    });
    return fetch(url, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("sanity");
      return response.json();
    }).then(function (payload) {
      return payload.result;
    });
  }

  function filePosts(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("posts");
      return response.json();
    }).then(function (posts) {
      return Array.isArray(posts) ? posts : [];
    });
  }

  function findPost(posts, slug) {
    for (var i = 0; i < posts.length; i += 1) {
      if (posts[i] && posts[i].slug === slug) return posts[i];
    }
    return null;
  }

  window.tkaSanity = {
    configured: configured,
    studioUrl: function () { return cfg.studioUrl || ""; },
    loadPosts: function (fallbackUrl) {
      if (!configured()) {
        return filePosts(fallbackUrl).then(function (posts) { return { posts: posts, source: "file" }; });
      }
      return query(listQuery).then(function (result) {
        var posts = (Array.isArray(result) ? result : []).map(mapPost).filter(Boolean);
        return { posts: posts, source: "sanity" };
      }).catch(function () {
        return filePosts(fallbackUrl).then(function (posts) { return { posts: posts, source: "file" }; });
      });
    },
    loadPost: function (slug, fallbackUrl) {
      if (!configured()) {
        return filePosts(fallbackUrl).then(function (posts) { return findPost(posts, slug); });
      }
      return query(oneQuery, { slug: slug }).then(function (result) {
        return mapPost(result);
      }).catch(function () {
        return filePosts(fallbackUrl).then(function (posts) { return findPost(posts, slug); });
      });
    }
  };
})();
