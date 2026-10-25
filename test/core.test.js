"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../src/latar.js");

const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

test("exports and presets", () => {
  assert.equal(L.version, "1.0.0");
  assert.deepEqual(Object.keys(L.PRESETS), ["mesh", "aurora", "contour", "fog", "dots"]);
  for (const [k, p] of Object.entries(L.PRESETS)) {
    assert.equal(p.colors.length, 4, k);
    p.colors.forEach((c) => assert.ok(L.parseColor(c), `${k} ${c}`));
    assert.ok(p.resolution > 0 && p.resolution <= 1);
    assert.ok(p.label && p.note);
  }
});

test("parseColor understands hex, short hex, and rgb()", () => {
  assert.ok(close(L.parseColor("#ff8000"), [1, 128 / 255, 0]));
  assert.ok(close(L.parseColor("0f0"), [0, 1, 0]));
  assert.ok(close(L.parseColor("rgb(255, 0, 51)"), [1, 0, 0.2]));
  assert.ok(close(L.parseColor("rgba(10 20 30 / .5)"), [10 / 255, 20 / 255, 30 / 255]));
  assert.ok(close(L.parseColor([255, 0, 0]), [1, 0, 0]));
  assert.equal(L.parseColor("tomato"), null);
  assert.equal(L.parseColor("#12345"), null);
  assert.equal(L.toHex([1, 0.5, 0]), "#ff8000");
});

test("parseColors splits on spaces or commas and fills gaps from the preset", () => {
  const base = L.PRESETS.mesh.colors;
  const a = L.parseColors("#000 #fff", base);
  assert.equal(a.length, 4);
  assert.ok(close(a[0], [0, 0, 0]));
  assert.ok(close(a[1], [1, 1, 1]));
  assert.ok(close(a[2], L.parseColor(base[2])));
  const b = L.parseColors("rgb(255, 0, 0), #00ff00,#0000ff , #ffffff", base);
  assert.ok(close(b[0], [1, 0, 0]) && close(b[3], [1, 1, 1]));
  const c = L.parseColors("nonsense", base);
  assert.ok(close(c[0], L.parseColor(base[0])));
});

test("parseOptions clamps numbers, ignores bad values, and reads booleans", () => {
  const o = L.parseOptions({ preset: "aurora", speed: "9", scale: "-2", grain: "abc", interactive: "", paused: "false" });
  assert.equal(o.preset, "aurora");
  assert.equal(o.speed, L.LIMITS.speed[1]);
  assert.equal(o.scale, L.LIMITS.scale[0]);
  assert.equal(o.grain, L.DEFAULTS.grain);
  assert.equal(o.interactive, true);
  assert.equal(o.paused, false);
  assert.equal(o.resolution, L.PRESETS.aurora.resolution);
  assert.equal(L.parseOptions({ preset: "nope" }).preset, "mesh");
  assert.equal(L.parseOptions({ resolution: "1.5" }).resolution, 1.5);
  assert.equal(L.parseOptions({}).interactive, false);
});

test("fallback gradients use the given colors for every preset", () => {
  const colors = ["#101010", "#ff0000", "#00ff00", "#0000ff"];
  for (const k of Object.keys(L.PRESETS)) {
    const css = L.fallbackCSS(k, colors);
    assert.match(css, /gradient\(/, k);
    assert.ok(css.includes("#101010"), k);
  }
  assert.ok(L.fallbackCSS("mesh", L.parseColors("#123456", L.PRESETS.mesh.colors)).includes("#123456"));
});

test("every fragment shader has its uniforms and a main()", () => {
  for (const k of Object.keys(L.PRESETS)) {
    const src = L.fragmentSource(k);
    assert.match(src, /void main\(\)/, k);
    ["u_res", "u_time", "u_c0", "u_c3", "u_grain"].forEach((u) => assert.ok(src.includes(u), `${k} ${u}`));
    assert.ok(!src.includes("@COMMON"), k);
    // a #extension must come before any code, so precision must follow it
    if (src.includes("#extension")) assert.ok(src.indexOf("#extension") < src.indexOf("precision"), k);
  }
  assert.match(L.VERT, /gl_Position/);
});
