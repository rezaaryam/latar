/*!
 * latar 1.0.0
 * Living WebGL backgrounds in one custom element: <latar-bg>.
 * Five looks (mesh, aurora, contour, fog, dots), a CSS fallback, and good manners:
 * it pauses when off screen, respects reduced motion, and caps its pixel count.
 * MIT License, Reza Arya Maulana.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Latar = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var hasDOM = typeof window !== "undefined" && typeof document !== "undefined";

  // ------------------------------------------------------------------ presets
  var PRESETS = {
    mesh: {
      label: "Mesh",
      note: "Soft color fields drifting into each other.",
      colors: ["#0f2f33", "#ff7a59", "#f6d39b", "#3b8f8a"],
      resolution: 0.75
    },
    aurora: {
      label: "Aurora",
      note: "Curtains of light over a night sky.",
      colors: ["#04070f", "#3cf0b0", "#4aa8ff", "#c8ff7a"],
      resolution: 0.6
    },
    contour: {
      label: "Contour",
      note: "A topographic map that slowly reshapes itself.",
      colors: ["#f2efe6", "#2a2620", "#e3dccb", "#c4572e"],
      resolution: 1
    },
    fog: {
      label: "Fog",
      note: "Warped smoke, folding over and over.",
      colors: ["#0c0a09", "#6b3f2a", "#e8964e", "#fbe9c8"],
      resolution: 0.6
    },
    dots: {
      label: "Dots",
      note: "A field of dots that swells like a tide.",
      colors: ["#0a0f1e", "#e8ecff", "#ff5a36", "#1b2550"],
      resolution: 1
    }
  };

  var DEFAULTS = { preset: "mesh", speed: 1, scale: 1, grain: 0.045, intensity: 1, interactive: false, resolution: null, paused: false, seed: 0 };
  var LIMITS = { speed: [0, 4], scale: [0.25, 4], grain: [0, 0.4], intensity: [0, 2], resolution: [0.25, 2], seed: [0, 1000] };

  // ------------------------------------------------------------------ pure helpers
  /** "#abc", "#aabbcc", "rgb(1, 2, 3)" to [r, g, b] in 0..1. Returns null if it cannot parse. */
  function parseColor(str) {
    if (Array.isArray(str)) return str.length >= 3 ? str.slice(0, 3).map(function (v) { return v > 1 ? v / 255 : v; }) : null;
    var s = String(str || "").trim().toLowerCase();
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
    if (m) {
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
    if (m) return [Math.min(255, +m[1]) / 255, Math.min(255, +m[2]) / 255, Math.min(255, +m[3]) / 255];
    return null;
  }

  function toHex(c) {
    return "#" + c.map(function (v) { return Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0"); }).join("");
  }

  /** Split "a, b c" (commas or spaces, but not inside rgb()) into four colors, filling gaps from the preset. */
  function parseColors(input, fallback) {
    var list = Array.isArray(input) ? input : String(input || "").match(/rgba?\([^)]*\)|#?[0-9a-f]{3,6}\b/gi) || [];
    var parsed = list.map(parseColor).filter(Boolean);
    var base = fallback.map(parseColor);
    var out = [];
    for (var i = 0; i < 4; i++) out.push(parsed[i] || base[i]);
    return out;
  }

  function clamp(v, range) { return Math.min(range[1], Math.max(range[0], v)); }

  /**
   * Turn attributes or a plain object into clean options.
   * Unknown presets fall back to mesh, numbers are clamped, bad colors use preset colors.
   */
  function parseOptions(raw) {
    raw = raw || {};
    var o = {};
    o.preset = PRESETS[raw.preset] ? raw.preset : DEFAULTS.preset;
    var p = PRESETS[o.preset];
    ["speed", "scale", "grain", "intensity", "seed"].forEach(function (k) {
      var v = raw[k] === undefined || raw[k] === null || raw[k] === "" ? DEFAULTS[k] : parseFloat(raw[k]);
      o[k] = isFinite(v) ? clamp(v, LIMITS[k]) : DEFAULTS[k];
    });
    var r = raw.resolution === undefined || raw.resolution === null || raw.resolution === "" ? p.resolution : parseFloat(raw.resolution);
    o.resolution = isFinite(r) ? clamp(r, LIMITS.resolution) : p.resolution;
    o.interactive = raw.interactive === true || raw.interactive === "" || raw.interactive === "true";
    o.paused = raw.paused === true || raw.paused === "" || raw.paused === "true";
    o.colors = parseColors(raw.colors, p.colors);
    return o;
  }

  /** A CSS gradient that looks close to each preset, used when WebGL is not available. */
  function fallbackCSS(preset, colors) {
    var c = colors.map(function (x) { return typeof x === "string" ? x : toHex(x); });
    switch (preset) {
      case "aurora":
        return "radial-gradient(120% 60% at 30% 40%, " + c[1] + "99, transparent 60%), radial-gradient(90% 50% at 75% 30%, " + c[2] + "88, transparent 60%), linear-gradient(" + c[0] + ", " + c[0] + ")";
      case "contour":
        return "repeating-radial-gradient(circle at 40% 45%, " + c[0] + " 0 18px, " + c[1] + "33 18px 19px), linear-gradient(" + c[0] + ", " + c[2] + ")";
      case "fog":
        return "radial-gradient(80% 70% at 35% 55%, " + c[2] + "aa, transparent 65%), radial-gradient(60% 60% at 70% 35%, " + c[1] + ", transparent 70%), linear-gradient(" + c[0] + ", " + c[0] + ")";
      case "dots":
        return "radial-gradient(" + c[1] + "55 1.5px, transparent 2px) 0 0 / 14px 14px, linear-gradient(" + c[0] + ", " + c[3] + ")";
      default:
        return "radial-gradient(at 18% 25%, " + c[1] + ", transparent 55%), radial-gradient(at 82% 20%, " + c[2] + ", transparent 50%), radial-gradient(at 65% 85%, " + c[3] + ", transparent 55%), linear-gradient(" + c[0] + ", " + c[0] + ")";
    }
  }

  // ------------------------------------------------------------------ shaders
  var VERT = "attribute vec2 a_pos;varying vec2 v_uv;void main(){v_uv=a_pos*.5+.5;gl_Position=vec4(a_pos,0.,1.);}";

  var COMMON = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform vec2 u_res;uniform float u_time;uniform vec2 u_mouse;uniform float u_mouseOn;",
    "uniform vec3 u_c0;uniform vec3 u_c1;uniform vec3 u_c2;uniform vec3 u_c3;",
    "uniform float u_scale;uniform float u_grain;uniform float u_intensity;uniform float u_seed;",
    "varying vec2 v_uv;",
    // gradient noise
    "vec2 h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return -1.+2.*fract(sin(p)*43758.5453);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);",
    "return mix(mix(dot(h2(i),f),dot(h2(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(h2(i+vec2(0,1)),f-vec2(0,1)),dot(h2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}",
    "float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}",
    "float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}",
    "vec2 aspect(){return vec2(u_res.x/u_res.y,1.);}",
    "vec3 finish(vec3 c){c+=(hash(gl_FragCoord.xy+fract(u_time*7.13)*91.7)-.5)*u_grain;return c;}"
  ].join("\n");

  var FRAG = {
    mesh: [
      "void main(){",
      "vec2 asp=aspect();vec2 uv=v_uv;vec2 p=(uv-.5)*asp/u_scale;float t=u_time*.07+u_seed;",
      // warp the plane so the blobs bend into each other like silk
      "vec2 w=p+.28*vec2(fbm(p*1.1+t),fbm(p*1.1-t+4.1))+.08*vec2(sin(p.y*3.+t*2.),cos(p.x*3.-t*1.7));",
      "vec2 q1=vec2(-.42+.22*sin(t*1.3),.22+.2*cos(t*1.1))*asp;",
      "vec2 q2=vec2(.45+.18*cos(t*.9),.25+.18*sin(t*1.4))*asp;",
      "vec2 q3=vec2(.05+.32*sin(t*.7+2.),-.32+.14*cos(t*1.2))*asp;",
      "vec2 m=(u_mouse-.5)*asp;q3=mix(q3,m,u_mouseOn*.6);",
      "float k=1.15/max(.35,u_intensity);",
      "vec3 c=u_c0;",
      "c=mix(c,u_c1,smoothstep(k,0.,length(w-q1)));",
      "c=mix(c,u_c2,smoothstep(k*.95,0.,length(w-q2)));",
      "c=mix(c,u_c3,smoothstep(k*.9,0.,length(w-q3)));",
      "c*=1.-.18*dot(uv-.5,uv-.5);",
      "gl_FragColor=vec4(finish(c),1.);}"
    ].join("\n"),

    aurora: [
      "void main(){",
      "vec2 asp=aspect();vec2 uv=v_uv;vec2 p=(uv-.5)*asp/u_scale;float t=u_time*.1+u_seed;",
      "vec3 c=mix(u_c0*.6,u_c0*1.5+.015,smoothstep(0.,1.,uv.y));",
      "vec2 sg=floor(gl_FragCoord.xy/2.);float st=step(.997,hash(sg));c+=st*(.5+.5*sin(t*25.+hash(sg+3.)*40.))*.55*smoothstep(.35,.95,uv.y);",
      "c+=u_c1*.08*exp(-pow((uv.y-.35)*3.,2.))*u_intensity;",
      "for(int i=0;i<3;i++){float k=float(i);",
      "float x=p.x*1.15+k*3.1;",
      "float base=.34+k*.11+.13*sin(x*1.4+t*1.3+k*2.)+.09*fbm(vec2(x*1.9+t*.9,k*4.+t*.2));",
      "base+=u_mouseOn*.1*exp(-pow((uv.x-u_mouse.x)*asp.x*2.5,2.))*(u_mouse.y-base);",
      "float d=uv.y-base;",
      "float rays=pow(.5+.5*noise(vec2(p.x*24.+k*9.+sin(t+k)*.5,t*1.8)),2.);",
      "float glow=smoothstep(-.025,.015,d)*exp(-max(d,0.)*(3.2+k*.8));",
      "float edge=exp(-abs(d)*55.);",
      "vec3 col=k<.5?u_c1:k<1.5?u_c2:u_c1;",
      "col=mix(col,u_c3,smoothstep(.02,.32,d)*.8);",
      "c+=col*(glow*(.25+1.1*rays)+edge*.35)*.62*u_intensity*(1.-k*.18);}",
      "c=1.-exp(-c*1.25);",
      "gl_FragColor=vec4(finish(c),1.);}"
    ].join("\n"),

    contour: [
      "#ifdef GL_OES_standard_derivatives",
      "#extension GL_OES_standard_derivatives : enable",
      "#endif",
      "@COMMON",
      "void main(){",
      "vec2 asp=aspect();vec2 uv=v_uv;vec2 p=(uv-.5)*asp*1.6/u_scale;float t=u_time*.05+u_seed;",
      "float f=fbm(p+vec2(t,-t*.7))+.22*fbm(p*2.1-vec2(t*.6,t));",
      "vec2 m=(u_mouse-.5)*asp*1.6/u_scale;f+=u_mouseOn*.35*exp(-dot(p-m,p-m)*6.);",
      "float n=12.*u_intensity+2.;float x=f*n;",
      "float dist=abs(fract(x+.5)-.5);",
      "#ifdef GL_OES_standard_derivatives",
      "float aa=fwidth(x);",
      "#else",
      "float aa=n*.004;",
      "#endif",
      "float major=step(.5,1.-abs(mod(floor(x+.5),5.)-0.));",
      "float lw=mix(.9,1.9,major);",
      "float line=1.-smoothstep(aa*(lw-.5),aa*(lw+.5),dist);",
      "vec3 bg=mix(u_c0,u_c2,smoothstep(-.5,.8,f));",
      "vec3 ink=mix(u_c1,u_c3,major);",
      "vec3 c=mix(bg,ink,line*mix(.55,.9,major));",
      "gl_FragColor=vec4(finish(c),1.);}"
    ].join("\n"),

    fog: [
      "float f01(vec2 p){return clamp(fbm(p)*.95+.5,0.,1.);}",
      "void main(){",
      "vec2 asp=aspect();vec2 uv=v_uv;vec2 p=(uv-.5)*asp*1.3/u_scale;float t=u_time*.05+u_seed;",
      "vec2 m=(u_mouse-.5)*asp*1.3/u_scale;p+=u_mouseOn*.3*(p-m)*exp(-dot(p-m,p-m)*3.);",
      "vec2 q=vec2(f01(p+vec2(0.,t)),f01(p+vec2(5.2,1.3)-t*.4));",
      "vec2 r=vec2(f01(p+3.2*q+vec2(1.7,9.2)+t*.5),f01(p+3.2*q+vec2(8.3,2.8)-t*.42));",
      "float f=f01(p+3.2*r);",
      "vec3 c=mix(u_c0,u_c1,clamp(f*f*2.6,0.,1.));",
      "c=mix(c,u_c2,clamp(q.x*q.y*1.6*u_intensity,0.,1.));",
      "c=mix(c,u_c3,clamp(pow(r.x,3.)*1.4*u_intensity,0.,1.));",
      "c*=.45+1.05*(f*f*f+.6*f*f+.5*f);",
      "c*=1.-.25*dot(uv-.5,uv-.5)*2.;",
      "gl_FragColor=vec4(finish(c),1.);}"
    ].join("\n"),

    dots: [
      "void main(){",
      "vec2 asp=aspect();float t=u_time*.15+u_seed;",
      "float cell=max(7.,u_res.y/(42./u_scale));",
      "vec2 gp=gl_FragCoord.xy/cell;vec2 id=floor(gp);vec2 f=fract(gp)-.5;",
      "vec2 cuv=(id+.5)*cell/u_res;",
      "float v=fbm(id*.045*u_scale+vec2(t,-t*.6))*1.5+.45;",
      "float md=length((cuv-u_mouse)*asp);float hot=u_mouseOn*exp(-md*md*28.);",
      "float wave=.5+.5*sin(md*30.-t*12.);v+=hot*(.35+.25*wave);",
      "float r=clamp(v,0.,1.)*.46*u_intensity;",
      "float d=length(f);float aa=1.5/cell;",
      "float dotm=1.-smoothstep(r-aa,r+aa,d);",
      "vec3 bg=mix(u_c0,u_c3,v_uv.y*.8);",
      "vec3 ink=mix(u_c1,u_c2,clamp(hot*1.6+smoothstep(.75,1.05,v)*.6,0.,1.));",
      "vec3 c=mix(bg,ink,dotm);",
      "gl_FragColor=vec4(finish(c),1.);}"
    ].join("\n")
  };

  function fragmentSource(preset) {
    var body = FRAG[preset];
    return body.indexOf("@COMMON") >= 0 ? body.replace("@COMMON", COMMON) : COMMON + "\n" + body;
  }

  // ------------------------------------------------------------------ renderer
  var MAX_PIXELS = 2400000;
  var instances = typeof Set !== "undefined" ? new Set() : null;

  function reduceMotion() {
    return hasDOM && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /**
   * Attach a background to an element. Returns a controller:
   * { set(options), play(), pause(), snapshot(width?, height?) -> Promise<Blob>, destroy(), options, isWebGL }
   */
  function mount(el, options) {
    var opts = parseOptions(options);
    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    el.appendChild(canvas);

    var gl = null, prog = null, loc = {}, buf = null;
    var raf = 0, last = 0, time = opts.seed * 3, frames = 0;
    var visible = true, alive = true;
    var mouse = [0.5, 0.5], target = [0.5, 0.5], mouseOn = 0, mouseWant = 0;

    var ctrl = {
      get options() { return opts; },
      get isWebGL() { return !!gl; },
      get frames() { return frames; },
      get running() { return !!raf; },
      set: set, play: play, pause: pause, snapshot: snapshot, destroy: destroy, render: drawOnce
    };

    function useFallback() {
      el.style.backgroundImage = fallbackCSS(opts.preset, opts.colors);
      el.style.backgroundColor = toHex(opts.colors[0]);
      el.setAttribute("data-fallback", "");
      canvas.style.display = "none";
    }

    function init() {
      try {
        gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "low-power" }) ||
          canvas.getContext("experimental-webgl");
      } catch (e) { gl = null; }
      if (!gl) { useFallback(); return false; }
      gl.getExtension("OES_standard_derivatives"); // enables fwidth() for crisp contour lines
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      return build();
    }

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        var log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error("latar: shader failed to compile: " + log);
      }
      return s;
    }

    function build() {
      if (prog) gl.deleteProgram(prog);
      try {
        var p = gl.createProgram();
        gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragmentSource(opts.preset)));
        gl.bindAttribLocation(p, 0, "a_pos");
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("latar: link failed: " + gl.getProgramInfoLog(p));
        prog = p;
      } catch (e) {
        if (typeof console !== "undefined") console.warn(e.message);
        gl = null; useFallback(); return false;
      }
      gl.useProgram(prog);
      ["u_res", "u_time", "u_mouse", "u_mouseOn", "u_c0", "u_c1", "u_c2", "u_c3", "u_scale", "u_grain", "u_intensity", "u_seed"].forEach(function (n) {
        loc[n] = gl.getUniformLocation(prog, n);
      });
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      el.removeAttribute("data-fallback");
      el.style.backgroundImage = "";
      el.style.backgroundColor = toHex(opts.colors[0]); // shown for a frame while the canvas warms up
      canvas.style.display = "block";
      return true;
    }

    function size(forceW, forceH) {
      var w, h;
      if (forceW) { w = forceW; h = forceH; }
      else {
        var dpr = Math.min(2, window.devicePixelRatio || 1) * opts.resolution;
        w = Math.max(1, Math.round(el.clientWidth * dpr));
        h = Math.max(1, Math.round(el.clientHeight * dpr));
        var px = w * h;
        if (px > MAX_PIXELS) { var k = Math.sqrt(MAX_PIXELS / px); w = Math.round(w * k); h = Math.round(h * k); }
      }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    }

    function draw() {
      if (!gl || !prog) return;
      var c = opts.colors;
      gl.uniform2f(loc.u_res, canvas.width, canvas.height);
      gl.uniform1f(loc.u_time, time);
      gl.uniform2f(loc.u_mouse, mouse[0], mouse[1]);
      gl.uniform1f(loc.u_mouseOn, mouseOn);
      gl.uniform3fv(loc.u_c0, c[0]); gl.uniform3fv(loc.u_c1, c[1]); gl.uniform3fv(loc.u_c2, c[2]); gl.uniform3fv(loc.u_c3, c[3]);
      gl.uniform1f(loc.u_scale, opts.scale);
      gl.uniform1f(loc.u_grain, opts.grain);
      gl.uniform1f(loc.u_intensity, opts.intensity);
      gl.uniform1f(loc.u_seed, opts.seed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frames++;
    }

    function drawOnce() { if (gl) { size(); draw(); } }

    function tick(now) {
      raf = 0;
      if (!alive) return;
      var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      time += dt * opts.speed;
      // ease the pointer so it feels like it has weight
      mouse[0] += (target[0] - mouse[0]) * Math.min(1, dt * 4);
      mouse[1] += (target[1] - mouse[1]) * Math.min(1, dt * 4);
      mouseOn += (mouseWant - mouseOn) * Math.min(1, dt * 3);
      size(); draw();
      schedule();
    }

    function shouldRun() {
      return alive && gl && visible && !opts.paused && !document.hidden && !reduceMotion();
    }
    function schedule() {
      if (!raf && shouldRun()) raf = requestAnimationFrame(tick);
    }
    function play() { opts.paused = false; last = 0; schedule(); if (!shouldRun()) drawOnce(); }
    function pause() { opts.paused = true; if (raf) cancelAnimationFrame(raf); raf = 0; drawOnce(); }

    function set(next) {
      var merged = {};
      Object.keys(opts).forEach(function (k) { merged[k] = opts[k]; });
      merged.colors = opts.colors.map(toHex);
      Object.keys(next || {}).forEach(function (k) { merged[k] = next[k]; });
      // if only the preset changed, take that preset's colors and resolution unless given
      if (next && next.preset && next.preset !== opts.preset) {
        if (!next.colors) merged.colors = undefined;
        if (next.resolution === undefined) merged.resolution = undefined;
      }
      var old = opts.preset;
      opts = parseOptions(merged);
      if (!gl) { if (el.hasAttribute("data-fallback")) useFallback(); return ctrl; }
      if (opts.preset !== old) build();
      if (opts.paused) pause(); else { schedule(); if (!raf) drawOnce(); }
      return ctrl;
    }

    /** Render one frame at any size and return it as a PNG Blob. */
    function snapshot(w, h) {
      return new Promise(function (resolve, reject) {
        if (!gl) { reject(new Error("latar: WebGL is not available")); return; }
        var pw = canvas.width, ph = canvas.height;
        w = Math.round(w || pw); h = Math.round(h || ph);
        size(w, h); draw();
        var px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        size(pw, ph); draw();
        var c2 = document.createElement("canvas"); c2.width = w; c2.height = h;
        var ctx = c2.getContext("2d"), img = ctx.createImageData(w, h);
        for (var y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); // WebGL rows are bottom-up
        ctx.putImageData(img, 0, 0);
        c2.toBlob(function (b) { if (b) resolve(b); else reject(new Error("latar: could not encode PNG")); }, "image/png");
      });
    }

    // pointer, visibility, size, context loss
    function onPointer(e) {
      if (!opts.interactive) { mouseWant = 0; return; }
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
      var inside = x >= -0.1 && x <= 1.1 && y >= -0.1 && y <= 1.1;
      mouseWant = inside ? 1 : 0;
      if (inside) { target[0] = x; target[1] = y; }
      if (inside && !raf && reduceMotion()) { mouse = target.slice(); mouseOn = 1; drawOnce(); }
    }
    function onLeave() { mouseWant = 0; }
    function onVisibility() { schedule(); }
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (en) {
      visible = en[en.length - 1].isIntersecting;
      if (visible) { last = 0; schedule(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }) : null;
    if (io) io.observe(el);
    var ro = "ResizeObserver" in window ? new ResizeObserver(function () { if (!raf) drawOnce(); }) : null;
    if (ro) ro.observe(el);
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); if (raf) cancelAnimationFrame(raf); raf = 0; });
    canvas.addEventListener("webglcontextrestored", function () { prog = null; init(); schedule(); drawOnce(); });

    function destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      if (gl) { var lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext(); }
      canvas.remove();
      el.removeAttribute("data-fallback");
      el.style.backgroundImage = "";
      if (instances) instances.delete(ctrl);
    }

    if (init()) {
      drawOnce();
      schedule();
    }
    if (instances) instances.add(ctrl);
    return ctrl;
  }

  // ------------------------------------------------------------------ custom element
  var ATTRS = ["preset", "colors", "speed", "scale", "grain", "intensity", "interactive", "resolution", "paused", "seed"];

  function readAttrs(el) {
    var o = {};
    ATTRS.forEach(function (a) { if (el.hasAttribute(a)) o[a] = el.getAttribute(a); });
    if (o.interactive === undefined) o.interactive = false;
    if (o.paused === undefined) o.paused = false;
    return o;
  }

  function defineElement() {
    if (!hasDOM || !window.customElements || customElements.get("latar-bg")) return;
    if (!document.getElementById("latar-style")) {
      var st = document.createElement("style");
      st.id = "latar-style";
      st.textContent = "latar-bg{display:block;position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;contain:strict}";
      (document.head || document.documentElement).appendChild(st);
    }
    var LatarBg = (function () {
      class LatarBg extends HTMLElement {
        static get observedAttributes() { return ATTRS; }
        connectedCallback() {
          if (this.latar) return;
          this.latar = mount(this, readAttrs(this));
          this.dispatchEvent(new CustomEvent("latar-ready", { bubbles: true, detail: { webgl: this.latar.isWebGL } }));
        }
        disconnectedCallback() { if (this.latar) { this.latar.destroy(); this.latar = null; } }
        attributeChangedCallback() {
          if (!this.latar) return;
          var o = readAttrs(this);
          if (!this.hasAttribute("colors")) o.colors = PRESETS[o.preset] ? PRESETS[o.preset].colors : undefined;
          if (!this.hasAttribute("resolution")) o.resolution = undefined;
          this.latar.set(o);
        }
      }
      return LatarBg;
    })();
    customElements.define("latar-bg", LatarBg);
  }
  if (hasDOM) defineElement();

  return {
    version: "1.0.0",
    PRESETS: PRESETS, DEFAULTS: DEFAULTS, LIMITS: LIMITS,
    parseColor: parseColor, parseColors: parseColors, toHex: toHex, parseOptions: parseOptions, fallbackCSS: fallbackCSS,
    fragmentSource: fragmentSource, VERT: VERT,
    mount: mount
  };
});
