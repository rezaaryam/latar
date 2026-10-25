"use strict";
/*
 * Real WebGL in headless Chromium (software rendering). Each test builds a tiny
 * page around src/latar.js, so the library is checked on its own, not through the docs.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const LIB = fs.readFileSync(path.join(__dirname, "..", "src", "latar.js"), "utf8");
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url.startsWith("/latar.js")) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(LIB); }
    const body = decodeURIComponent(req.url.split("?b=")[1] || "");
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}.box{position:relative;width:320px;height:200px}.far{margin-top:3000px}</style></head><body>${body}<script src="/latar.js"></script></body></html>`);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
});
after(async () => { await browser.close(); server.close(); });

async function page(body, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, ...opts });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  if (opts.init) await p.addInitScript(opts.init);
  await p.goto(base + "?b=" + encodeURIComponent(body));
  return p;
}
/** Average color and spread of the rendered pixels, read back through snapshot(). */
function stats(p, sel = "latar-bg") {
  return p.$eval(sel, async (el) => {
    const blob = await el.latar.snapshot(64, 40);
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(64, 40), x = c.getContext("2d");
    x.drawImage(bmp, 0, 0);
    const d = x.getImageData(0, 0, 64, 40).data;
    let sum = [0, 0, 0], lum = [];
    for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; lum.push(d[i] + d[i + 1] + d[i + 2]); }
    const n = d.length / 4, mean = lum.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(lum.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    return { avg: sum.map((v) => v / n), sd };
  });
}

for (const preset of ["mesh", "aurora", "contour", "fog", "dots"]) {
  test(`${preset}: compiles, draws, and is not a flat color`, async () => {
    const p = await page(`<div class="box"><latar-bg preset="${preset}"></latar-bg></div>`);
    await p.waitForFunction(() => document.querySelector("latar-bg").latar.frames > 2);
    assert.equal(await p.$eval("latar-bg", (e) => e.latar.isWebGL), true);
    assert.equal(await p.$eval("latar-bg", (e) => e.hasAttribute("data-fallback")), false);
    const s = await stats(p);
    assert.ok(s.sd > 2, `${preset} spread ${s.sd}`);
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });
}

test("animates over time, and speed 0 freezes it", async () => {
  const p = await page(`<div class="box"><latar-bg preset="fog" grain="0"></latar-bg></div>`);
  await p.waitForFunction(() => document.querySelector("latar-bg").latar.frames > 2);
  const a = await stats(p);
  await p.waitForTimeout(700);
  const b = await stats(p);
  assert.notDeepEqual(a.avg, b.avg);
  await p.$eval("latar-bg", (e) => e.setAttribute("speed", "0"));
  await p.waitForTimeout(150);
  const c = await stats(p);
  await p.waitForTimeout(400);
  const d = await stats(p);
  assert.deepEqual(c.avg, d.avg);
  await p.context().close();
});

test("changing colors through the attribute changes the picture", async () => {
  const p = await page(`<div class="box"><latar-bg preset="mesh" speed="0" grain="0" colors="#000000 #000000 #000000 #000000"></latar-bg></div>`);
  await p.waitForFunction(() => document.querySelector("latar-bg").latar.frames > 0);
  const dark = await stats(p);
  assert.ok(dark.avg.every((v) => v < 3));
  await p.$eval("latar-bg", (e) => e.setAttribute("colors", "#ff0000 #ff0000 #ff0000 #ff0000"));
  const red = await stats(p);
  assert.ok(red.avg[0] > 200 && red.avg[1] < 30, JSON.stringify(red.avg));
  await p.context().close();
});

test("pauses when scrolled out of view and resumes when back", async () => {
  const p = await page(`<div class="box"><latar-bg preset="dots"></latar-bg></div><div class="far"></div>`);
  await p.waitForFunction(() => document.querySelector("latar-bg").latar.frames > 3);
  await p.evaluate(() => scrollTo(0, 2500));
  await p.waitForTimeout(300);
  const f1 = await p.$eval("latar-bg", (e) => e.latar.frames);
  await p.waitForTimeout(500);
  const f2 = await p.$eval("latar-bg", (e) => e.latar.frames);
  assert.ok(f2 - f1 <= 1, `kept drawing: ${f1} -> ${f2}`);
  assert.equal(await p.$eval("latar-bg", (e) => e.latar.running), false);
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForFunction((n) => document.querySelector("latar-bg").latar.frames > n + 3, f2);
  await p.context().close();
});

test("reduced motion: one frame, then it waits", async () => {
  const p = await page(`<div class="box"><latar-bg preset="aurora"></latar-bg></div>`, { reducedMotion: "reduce" });
  await p.waitForTimeout(600);
  const f = await p.$eval("latar-bg", (e) => e.latar.frames);
  assert.ok(f >= 1 && f <= 3, `frames ${f}`);
  assert.equal(await p.$eval("latar-bg", (e) => e.latar.running), false);
  await p.context().close();
});

test("no WebGL: a CSS gradient in the preset's colors instead of a blank box", async () => {
  const init = "HTMLCanvasElement.prototype.getContext = function () { return null; };";
  const p = await page(`<div class="box"><latar-bg preset="fog" colors="#112233 #445566 #778899 #aabbcc"></latar-bg></div>`, { init });
  await p.waitForFunction(() => document.querySelector("latar-bg").latar);
  assert.equal(await p.$eval("latar-bg", (e) => e.latar.isWebGL), false);
  assert.equal(await p.$eval("latar-bg", (e) => e.hasAttribute("data-fallback")), true);
  const bg = await p.$eval("latar-bg", (e) => e.style.backgroundImage);
  assert.match(bg, /gradient/);
  assert.match(bg, /112233|rgb\(17, 34, 51\)/);
  await p.context().close();
});

test("snapshot renders at any size, and the element cleans up when removed", async () => {
  const p = await page(`<div class="box"><latar-bg preset="contour"></latar-bg></div>`);
  await p.waitForFunction(() => document.querySelector("latar-bg").latar.frames > 0);
  const size = await p.$eval("latar-bg", async (e) => {
    const b = await e.latar.snapshot(1280, 720);
    const bmp = await createImageBitmap(b);
    return [bmp.width, bmp.height, b.type];
  });
  assert.deepEqual(size, [1280, 720, "image/png"]);
  // the live canvas went back to its own size
  assert.ok(await p.$eval("latar-bg canvas", (c) => c.width < 1280));
  await p.$eval("latar-bg", (e) => e.remove());
  assert.equal(await p.$$eval("canvas", (c) => c.length), 0);
  await p.context().close();
});

test("Latar.mount works without the custom element", async () => {
  const p = await page(`<div class="box" id="hero"></div>`);
  await p.evaluate(() => { window.bg = Latar.mount(document.getElementById("hero"), { preset: "aurora", interactive: true }); });
  await p.waitForFunction(() => window.bg.frames > 2);
  await p.evaluate(() => window.bg.set({ preset: "dots" }));
  assert.equal(await p.evaluate(() => window.bg.options.preset), "dots");
  assert.equal(await p.evaluate(() => window.bg.options.interactive), true);
  await p.evaluate(() => window.bg.pause());
  assert.equal(await p.evaluate(() => window.bg.running), false);
  await p.evaluate(() => window.bg.destroy());
  assert.equal(await p.$$eval("#hero canvas", (c) => c.length), 0);
  await p.context().close();
});

test("docs copy matches src", () => {
  assert.equal(fs.readFileSync(path.join(__dirname, "..", "docs", "latar.js"), "utf8"), LIB);
});
