// SPDX-License-Identifier: Apache-2.0

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CluesKeyboardCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COLUMNS = 4;
  const ROWS = 5;

  function coordinateForIndex(index) {
    return String.fromCharCode(65 + (index % COLUMNS)) + (Math.floor(index / COLUMNS) + 1);
  }

  function indexForCoordinate(coordinate) {
    const match = /^([A-D])([1-5])$/.exec(coordinate || "");
    return match ? (Number(match[2]) - 1) * COLUMNS + match[1].charCodeAt(0) - 65 : -1;
  }

  function moveCoordinate(coordinate, key, occupied) {
    const start = indexForCoordinate(coordinate);
    if (start < 0) return null;
    const delta = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1]
    }[key];
    if (!delta) return null;

    let column = start % COLUMNS;
    let row = Math.floor(start / COLUMNS);
    for (let attempt = 0; attempt < COLUMNS * ROWS; attempt += 1) {
      column = (column + delta[0] + COLUMNS) % COLUMNS;
      row = (row + delta[1] + ROWS) % ROWS;
      const candidate = coordinateForIndex(row * COLUMNS + column);
      if (occupied.has(candidate)) return candidate;
    }
    return coordinate;
  }

  function chooseInitialCoordinate(cards) {
    const revealed = cards.filter((card) => card.revealed);
    if (revealed.length === 1) return revealed[0].coordinate;
    return cards.find((card) => card.coordinate === "A1")?.coordinate || cards[0]?.coordinate || null;
  }

  function tagShortcut(code, shiftKey) {
    const match = /^Digit([0-6])$/.exec(code || "");
    return match ? { color: Number(match[1]), corner: shiftKey ? 1 : 0 } : null;
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function pluralForms(term) {
    const value = String(term || "").trim();
    if (!value) return [];
    const forms = [value];
    if (/mech$/i.test(value)) forms.push(`${value}s`);
    else if (/[^aeiou]y$/i.test(value)) forms.push(`${value.slice(0, -1)}ies`);
    else if (/(s|sh|ch|x|z)$/i.test(value)) forms.push(`${value}es`);
    else forms.push(`${value}s`);
    return forms;
  }

  function textReferencesTerm(text, term, allowPlural = false, caseSensitive = false) {
    const forms = allowPlural ? pluralForms(term) : [String(term || "").trim()];
    if (!forms[0]) return false;
    const alternatives = forms.sort((left, right) => right.length - left.length).map(escapeRegExp).join("|");
    const flags = caseSensitive ? "u" : "iu";
    return new RegExp(`(^|[^\\p{L}\\p{N}])(?:${alternatives})(?=$|[^\\p{L}\\p{N}])`, flags).test(String(text || ""));
  }

  function textReferencesName(text, name) {
    const value = String(name || "").trim();
    if (!value) return false;
    const displayedName = value.charAt(0).toUpperCase() + value.slice(1);
    return textReferencesTerm(text, displayedName, false, true);
  }

  function referencedCoordinates(cards, currentCoordinate) {
    const clue = cards.find((card) => card.coordinate === currentCoordinate)?.clue;
    if (!clue) return [];
    return cards
      .filter((card) => textReferencesName(clue, card.name) || textReferencesTerm(clue, card.profession, true))
      .map((card) => card.coordinate);
  }

  function isEditable(element) {
    if (!element) return false;
    const tag = String(element.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || Boolean(element.isContentEditable);
  }

  return {
    COLUMNS,
    ROWS,
    chooseInitialCoordinate,
    coordinateForIndex,
    indexForCoordinate,
    isEditable,
    moveCoordinate,
    referencedCoordinates,
    tagShortcut
  };
});
