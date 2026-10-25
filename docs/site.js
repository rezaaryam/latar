/* latar documentation site: hero switcher, playground, gallery, live meter. */
(function () {
  "use strict";

  var L = window.Latar;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var keys = Object.keys(L.PRESETS);
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js-ready");

  function luminance(hex) { var c = L.parseColor(hex); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function tone(colors) { return luminance(colors[0]) > 0.55 ? "light" : "dark"; }
  function swatch(colors) {
    return "conic-gradient(" + colors[1] + " 0 25%, " + colors[2] + " 0 50%, " + colors[3] + " 0 75%, " + colors[0] + " 0)";
  }
  var toastT;
  function toast(t) {
    var el = $("#toast"); el.textContent = t; el.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove("on"); }, 2400);
  }
  function copy(text, btn) {
    var done = function () { if (btn) { btn.setAttribute("data-done", ""); setTimeout(function () { btn.removeAttribute("data-done"); }, 1400); } toast("Copied"); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { toast("Copy failed. Select the text instead."); });
    else toast("Copy is not available here.");
  }

  // ---------------------------------------------------------------- hero
  var hero = $("#hero"), heroBg = $("#heroBg"), heroSwitch = $("#heroSwitch");
  keys.forEach(function (k) {
    var p = L.PRESETS[k], b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "radio"); b.dataset.preset = k;
    b.innerHTML = '<i style="background:' + swatch(p.colors) + '"></i>' + p.label;
    b.addEventListener("click", function () { setHero(k); });
    heroSwitch.appendChild(b);
  });
  function setHero(k) {
    heroBg.setAttribute("preset", k);
    hero.dataset.tone = tone(L.PRESETS[k].colors);
    $$("#heroSwitch button").forEach(function (b) { b.setAttribute("aria-checked", String(b.dataset.preset === k)); });
  }
  setHero(heroBg.getAttribute("preset"));
  $$("[data-copy]").forEach(function (b) { b.addEventListener("click", function () { copy(b.getAttribute("data-copy"), b); }); });

  // ---------------------------------------------------------------- playground
  var PALETTES = [
    { name: "Ember", colors: ["#120a07", "#ff5b2e", "#ffb36b", "#5a1d14"] },
    { name: "Lagoon", colors: ["#04161c", "#1fd1b2", "#0a7ea4", "#d9fff4"] },
    { name: "Paper", colors: ["#f3efe4", "#2a2620", "#e0d8c3", "#3f6fd8"] },
    { name: "Dusk", colors: ["#151020", "#ff7a8a", "#ffc27a", "#2f3a7a"] },
    { name: "Moss", colors: ["#0d1410", "#9bd36b", "#2f6b4b", "#f1f5d8"] },
    { name: "Mono", colors: ["#0b0b0b", "#f2f2f2", "#7d7d7d", "#3a3a3a"] }
  ];
  var playBg = $("#playBg"), preview = $("#preview");
  var state = { preset: "mesh", colors: L.PRESETS.mesh.colors.slice(), speed: 1, scale: 1, intensity: 1, grain: L.DEFAULTS.grain, interactive: true };

  var presetPick = $("#presetPick");
  keys.forEach(function (k) {
    var p = L.PRESETS[k], b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "radio"); b.dataset.preset = k;
    b.innerHTML = '<i style="background:' + swatch(p.colors) + '"></i>' + p.label;
    b.addEventListener("click", function () { choosePreset(k); });
    presetPick.appendChild(b);
  });
  function choosePreset(k) {
    state.preset = k;
    state.colors = L.PRESETS[k].colors.slice();
    apply();
  }

  var colorsBox = $("#colors");
  var colorNames = ["base", "one", "two", "three"];
  colorNames.forEach(function (n, i) {
    var l = document.createElement("label");
    l.className = "color";
    l.innerHTML = '<i></i><input type="color" aria-label="Color ' + (i + 1) + ', ' + n + '"><span></span>';
    l.querySelector("input").addEventListener("input", function (e) { state.colors[i] = e.target.value; apply(true); });
    colorsBox.appendChild(l);
  });

  var palBox = $("#palettes");
  PALETTES.forEach(function (p) {
    var b = document.createElement("button");
    b.type = "button"; b.title = p.name; b.setAttribute("aria-label", "Use the " + p.name + " palette");
    b.innerHTML = p.colors.map(function (c) { return '<b style="background:' + c + '"></b>'; }).join("");
    b.addEventListener("click", function () { state.colors = p.colors.slice(); apply(); });
    palBox.appendChild(b);
  });

  ["speed", "scale", "intensity", "grain"].forEach(function (k) {
    var el = document.getElementById(k);
    el.addEventListener("input", function () { state[k] = +el.value; apply(true); });
  });
  $("#interactive").addEventListener("change", function (e) { state.interactive = e.target.checked; apply(true); });

  function fmt(k, v) { return k === "grain" ? (+v).toFixed(3) : (+v).toFixed(2).replace(/0$/, ""); }
  function setFill(el) { el.style.setProperty("--fill", ((el.value - el.min) / (el.max - el.min)) * 100 + "%"); }

  function apply(fromInput) {
    playBg.latar.set({ preset: state.preset, colors: state.colors, speed: state.speed, scale: state.scale, intensity: state.intensity, grain: state.grain, interactive: state.interactive });
    $$("#presetPick button").forEach(function (b) { b.setAttribute("aria-checked", String(b.dataset.preset === state.preset)); });
    $$("#colors .color").forEach(function (l, i) {
      l.querySelector("i").style.background = state.colors[i];
      var input = l.querySelector("input");
      if (input.value !== state.colors[i]) input.value = state.colors[i];
      l.querySelector("span").textContent = state.colors[i];
    });
    ["speed", "scale", "intensity", "grain"].forEach(function (k) {
      var el = document.getElementById(k);
      if (!fromInput) el.value = state[k];
      document.querySelector('output[data-for="' + k + '"]').textContent = fmt(k, state[k]);
      setFill(el);
    });
    $("#interactive").checked = state.interactive;
    $("#previewTag").textContent = L.PRESETS[state.preset].label.toLowerCase();
    preview.dataset.tone = tone(state.colors);
    $("#code").innerHTML = highlight(tag(), "html");
  }

  function tag() {
    var d = L.DEFAULTS, a = ['preset="' + state.preset + '"'];
    var dc = L.PRESETS[state.preset].colors.join(" "), c = state.colors.join(" ");
    if (c !== dc) a.push('colors="' + c + '"');
    if (state.speed !== d.speed) a.push('speed="' + fmt("speed", state.speed) + '"');
    if (state.scale !== d.scale) a.push('scale="' + fmt("scale", state.scale) + '"');
    if (state.intensity !== d.intensity) a.push('intensity="' + fmt("intensity", state.intensity) + '"');
    if (Math.abs(state.grain - d.grain) > 1e-6) a.push('grain="' + fmt("grain", state.grain) + '"');
    if (state.interactive) a.push("interactive");
    return "<latar-bg " + a.join(" ") + "></latar-bg>";
  }
  $("#copyCode").addEventListener("click", function () { copy(tag(), $("#copyCode")); });

  $("#saveWall").addEventListener("click", function () {
    var size = $("#wallSize").value.split("x").map(Number), btn = $("#saveWall");
    btn.disabled = true;
    toast("Rendering " + size[0] + " × " + size[1] + "…");
    playBg.latar.snapshot(size[0], size[1]).then(function (blob) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "latar-" + state.preset + "-" + size[0] + "x" + size[1] + ".png";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast("Wallpaper saved, " + Math.round(blob.size / 1024) + " KB");
    }).catch(function (e) { toast(e.message); }).then(function () { btn.disabled = false; });
  });

  // ---------------------------------------------------------------- gallery
  var bento = $("#bento");
  keys.forEach(function (k, i) {
    var p = L.PRESETS[k], card = document.createElement("article");
    card.className = "card";
    card.dataset.tone = tone(p.colors);
    card.innerHTML = '<latar-bg preset="' + k + '" seed="' + (i * 7 + 2) + '"></latar-bg>' +
      "<h3>" + p.label + "</h3><p>" + p.note + '</p><button class="try" type="button">Try it</button>';
    card.querySelector(".try").addEventListener("click", function () {
      choosePreset(k);
      $("#playground").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
    bento.appendChild(card);
  });

  // ---------------------------------------------------------------- code
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function highlight(code, lang) {
    var out = esc(code);
    if (lang === "html") {
      return out.replace(/(&lt;\/?)([\w-]+)([\s\S]*?)(&gt;)/g, function (m, o, t, attrs, c) {
        attrs = attrs.replace(/([\w-]+)(=)("[^"]*")/g, '<span class="a">$1</span><span class="p">$2</span><span class="s">$3</span>')
          .replace(/(\s)([\w-]+)(?=\s|$)/g, '$1<span class="a">$2</span>');
        return '<span class="p">' + o + '</span><span class="t">' + t + "</span>" + attrs + '<span class="p">' + c + "</span>";
      });
    }
    return out.replace(/("[^"]*")/g, '<span class="s">$1</span>')
      .replace(/\b(const|await|new|return)\b/g, '<span class="k">$1</span>')
      .replace(/\.(\w+)(?=\()/g, '.<span class="a">$1</span>')
      .replace(/(\/\/[^\n]*)/g, '<span class="p">$1</span>');
  }
  $$("pre.code[data-lang]").forEach(function (pre) { pre.innerHTML = highlight(pre.textContent, pre.dataset.lang); });

  // ---------------------------------------------------------------- live meter
  var nf = new Intl.NumberFormat("en-US");
  setInterval(function () {
    var all = $$("latar-bg").filter(function (e) { return e.latar; });
    $("#mHero").textContent = nf.format(heroBg.latar ? heroBg.latar.frames : 0);
    var running = heroBg.latar && heroBg.latar.running;
    var st = $("#mState");
    st.textContent = reduce ? "still frame" : running ? "drawing" : "paused";
    st.classList.toggle("paused", !running);
    $("#mCount").textContent = all.length;
    $("#mActive").textContent = all.filter(function (e) { return e.latar.running; }).length;
  }, 250);

  // ---------------------------------------------------------------- reveal
  if ("IntersectionObserver" in window && !reduce) {
    var items = [];
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        for (var i = 0; i < items.length; i++) { items[i].classList.add("in"); io.unobserve(items[i]); if (items[i] === e.target) break; }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
    $$(".sec-h, .play, .bento, .steps, .api, .manners").forEach(function (el) {
      if (el.getBoundingClientRect().top > innerHeight) { el.classList.add("rv"); items.push(el); io.observe(el); }
    });
  }

  apply();
  window.latarSite = { state: state, apply: apply, choosePreset: choosePreset };
})();
