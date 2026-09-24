# Clues by Sam Keyboard for Safari

This Safari Web Extension adds keyboard controls to the puzzle grid at [Clues by Sam](https://cluesbysam.com/). This Safari extension is not created by, affiliated with, nor endorsed by Clues by Sam. It is a fan creation for keyboard interaction.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Arrow keys | Move one card. Movement wraps and skips empty positions. |
| Space or Return | Activate the center of the current card |
| `I` or `C` | Choose Innocent or Criminal in the open decision dialog |
| `0`–`6` | Clear or set the top corner tag |
| Shift + `0`–`6` | Clear or set the bottom corner tag |
| `?` | Open the keyboard shortcut list |
| Escape | Close the current dialog or the keyboard shortcut list |

When the extension detects a puzzle grid, it shows a persistent **Clues keyboard active** badge. A pointer click selects a card for keyboard control.

The extension puts a yellow inner ring on each card that the current clue references. The reference can be a name or profession. The current card keeps its white-and-blue focus ring. If the clue references its own card, both rings appear.

Version 1.0.8, build 9 adds thinner gray-blue rings for spatial references. These rings mark neighbors, corners, named rows and columns, and directional ranges. If a card has both highlights, the gray-blue ring sits inside the yellow ring.

Supported examples include “neighbors of Alice and Bob,” “Alice’s neighbors,” “my neighbors,” “Row 2,” and “Column B.” Common or shared neighbors highlight only the overlap. “Below Alice and above Bob” highlights cards that satisfy both directions. Left and right references work the same way. “Directly” limits a direction to the adjacent card. “Between Alice and Bob” excludes both endpoints in the same row or column.

The extension recognizes these wording patterns. It does not interpret every possible clue or filter highlighted groups by innocence or guilt.

The `?` panel includes **Reference rings (yellow)** and **Spatial rings (grey)** checkboxes. Both settings start enabled and take effect immediately. Each browser saves its settings locally. The current card keeps its focus ring with either setting disabled.

## Permissions and privacy

The extension requests access only to pages on `https://cluesbysam.com/`. It does not request access to browser history, tabs, the clipboard, networks, or accounts. The extension does not collect analytics or other data.

## Tests

The test suite uses the test runner in Node. It has no third-party dependencies.

```sh
npm test
npm run check
```

To build from the command line without a signing identity:

```sh
xcodebuild \
  -project CluesKeyboard.xcodeproj \
  -scheme CluesKeyboard \
  -configuration Debug \
  -destination 'platform=macOS' \
  -derivedDataPath /tmp/clueskeyboard-derived \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## License

Apache License 2.0. See [LICENSE](LICENSE).
