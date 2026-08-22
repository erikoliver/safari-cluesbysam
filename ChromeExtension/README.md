# Clues by Sam Keyboard for Chrome

This directory contains the Chrome Manifest V3 extension. The manifest and the installation instructions apply only to Chrome.

Symbolic links connect the JavaScript, CSS, and icons to the Safari extension files. Thus, both extensions use identical shared files.

## Install in Chrome

1. To install a release, download `CluesKeyboard-Chrome-<version>.zip`.
2. After downloading, extract the ZIP file.
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer mode**.
5. Select **Load unpacked**.
6. Select the extracted extension directory or the `ChromeExtension` source directory.
7. Open [Clues by Sam](https://cluesbysam.com/) in a new tab.

## Update the extension

Chrome does not update this extension automatically.

1. Replace the installed extension directory with the directory from the new release.
2. Open `chrome://extensions` in Chrome.
3. Select **Reload** on the extension.
4. Reload [Clues by Sam](https://cluesbysam.com/).

## Package

1. Open a terminal in the repository root directory.
2. Run this command:

```sh
npm run package:chrome
```

## Package output

The command writes an unpacked extension directory and a ZIP file to `dist/`.
