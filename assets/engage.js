/* drandy9168.com：觀看數＋留言板（後端在 worker/，部署於 api.drandy9168.com） */
(function () {
  "use strict";
  var API = window.DRANDY_API || (/drandy9168\.com$/.test(location.hostname) ? "https://api.drandy9168.com/api" : "/api");
  var VIEW_GAP_MS = 30 * 60 * 1000;   // 同一個人 30 分鐘內重整不重複算

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
  function fmt(n) { return Number(n || 0).toLocaleString("zh-TW"); }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if (opts.body) opts.headers["Content-Type"] = "application/json";
    return fetch(API + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || ("HTTP " + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  // ---- 觀看數 ----
  // today：本日觀看數，只在有 data-today 的元素顯示（老闆 2026-09-27 指定的文章）
  function showViews(map, today) {
    $$("[data-views]").forEach(function (el) {
      var s = el.getAttribute("data-views"), n = map[s];
      if (n === undefined) return;
      var txt = (el.closest(".byline") ? "｜" : "") + fmt(n) + " 次觀看";
      if (el.hasAttribute("data-today") && today && today[s] !== undefined) txt += "｜本日 " + fmt(today[s]) + " 次";
      el.textContent = txt;
      el.hidden = false;
    });
  }

  var slug = document.body.getAttribute("data-slug");
  if (slug) {
    var key = "dv:" + slug, last = Number(store(key) || 0);
    // 後台「參照網址」：只送來源網域，不送完整網址
    var ref = "";
    try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) {}
    var req = (Date.now() - last > VIEW_GAP_MS)
      ? api("/views/" + encodeURIComponent(slug) + "?r=" + encodeURIComponent(ref), { method: "POST" }).then(function (j) {
          store(key, String(Date.now()));
          var m = {}, t = {}; m[slug] = j.views; t[slug] = j.today;
          return { views: m, today: t };
        })
      : api("/views?slugs=" + encodeURIComponent(slug));
    req.then(function (j) { showViews(j.views || {}, j.today); }, function () {});
  } else {
    var slugs = $$("[data-views]").map(function (el) { return el.getAttribute("data-views"); });
    if (slugs.length) {
      api("/views?slugs=" + slugs.map(encodeURIComponent).join(",")).then(function (j) {
        showViews(j.views || {}, j.today);
      }, function () {});
    }
  }

  // ---- 留言板 ----
  var box = $("#comments");
  if (!box) return;
  var list = $(".comment-list", box), empty = $(".comment-empty", box);
  var form = $(".comment-form", box), msg = $(".form-msg", box);
  var shownAt = Date.now();
  function field(n) { return form.elements.namedItem(n); }

  function when(sec) {
    var d = new Date(sec * 1000);
    return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
  }

  function item(c) {
    var li = document.createElement("li");
    li.className = "comment";
    li.id = "c" + c.id;
    var who = document.createElement("div");
    who.className = "who";
    who.textContent = c.name;
    if (c.is_owner) {
      var tag = document.createElement("span");
      tag.className = "owner";
      tag.textContent = "作者";
      who.appendChild(tag);
    }
    var t = document.createElement("span");
    t.className = "when";
    t.textContent = when(c.created_at);
    who.appendChild(t);
    var body = document.createElement("div");
    body.className = "text";
    body.textContent = c.body;      // 一律純文字，不吃 HTML
    li.appendChild(who);
    li.appendChild(body);
    return li;
  }

  function render(comments) {
    list.textContent = "";
    var byId = {};
    comments.forEach(function (c) {
      var li = item(c);
      byId[c.id] = li;
      var parent = c.parent_id && byId[c.parent_id];
      if (parent) {
        var ol = $(".replies", parent);
        if (!ol) { ol = document.createElement("ol"); ol.className = "replies"; parent.appendChild(ol); }
        ol.appendChild(li);
      } else {
        list.appendChild(li);
      }
    });
    empty.textContent = "目前還沒有留言。";
    empty.hidden = comments.length > 0;
  }

  function load() {
    return api("/comments?slug=" + encodeURIComponent(slug)).then(function (j) {
      render(j.comments || []);
      box.hidden = false;           // 後端連得上才顯示留言板
    }, function () {
      if (!box.hidden) empty.textContent = "留言暫時無法載入，請稍後再試。";
    });
  }
  load();

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var name = field("name").value.trim(), text = field("body").value.trim();
    if (!name || !text) { msg.textContent = "請填寫暱稱和留言內容。"; return; }
    var btn = $("button", form);
    btn.disabled = true;
    msg.textContent = "送出中…";
    api("/comments", {
      method: "POST",
      body: JSON.stringify({ slug: slug, name: name, body: text,
                             website: field("website").value, elapsed: Date.now() - shownAt })
    }).then(function (j) {
      field("body").value = "";
      if (j.status === "published") { msg.textContent = "已張貼，謝謝您的留言！"; load(); }
      else { msg.textContent = "已收到，留言將在醫師審核後顯示。"; }
    }, function (e) {
      msg.textContent = e.status === 429 ? "留言太頻繁了，請稍後再試。" : "送出失敗：" + e.message;
    }).then(function () { btn.disabled = false; });
  });
})();
