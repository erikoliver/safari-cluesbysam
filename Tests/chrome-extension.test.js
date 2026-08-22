// SPDX-License-Identifier: Apache-2.0

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const safariRoot = path.join(repositoryRoot, "CluesKeyboard", "Extension");
const chromeRoot = path.join(repositoryRoot, "ChromeExtension");

test("Chrome manifest uses the expected Manifest V3 permissions and resources", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(chromeRoot, "manifest.json"), "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, []);
  assert.deepEqual(manifest.host_permissions, ["https://cluesbysam.com/*"]);
  assert.deepEqual(manifest.content_scripts[0].js, ["keyboard-core.js", "content.js"]);
  assert.deepEqual(manifest.content_scripts[0].css, ["content.css"]);
  assert.deepEqual(manifest.web_accessible_resources[0].resources, ["page-adapter.js"]);
});

test("Chrome links shared browser assets to the canonical Safari files", () => {
  const sharedFiles = [
    "keyboard-core.js",
    "content.js",
    "page-adapter.js",
    "content.css",
    "icons/person-keyboard-16.png",
    "icons/person-keyboard-32.png",
    "icons/person-keyboard-48.png",
    "icons/person-keyboard-128.png"
  ];

  for (const relativePath of sharedFiles) {
    const chromePath = path.join(chromeRoot, relativePath);
    assert.equal(fs.lstatSync(chromePath).isSymbolicLink(), true, `${relativePath} is not a symbolic link`);
    assert.equal(
      fs.realpathSync(chromePath),
      path.join(safariRoot, relativePath),
      `${relativePath} does not link to the Safari source`
    );
  }
});

test("Chrome and Safari manifests use the same release version", () => {
  const chromeManifest = JSON.parse(fs.readFileSync(path.join(chromeRoot, "manifest.json"), "utf8"));
  const safariManifest = JSON.parse(fs.readFileSync(path.join(safariRoot, "manifest.json"), "utf8"));

  assert.equal(chromeManifest.version, safariManifest.version);
});
