#!/usr/bin/env node
// Copies src/latar.js into docs/ so GitHub Pages serves what the tests check.
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
fs.copyFileSync(path.join(root, "src", "latar.js"), path.join(root, "docs", "latar.js"));
console.log("docs/latar.js updated");
