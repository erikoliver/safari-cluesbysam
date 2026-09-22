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

  // Parse spatial sets first, then intersect conditions describing the same group.
  // These are geometric highlights, not deductions about innocence or guilt.
  function spatialCoordinates(cards, currentCoordinate) {
    const clue = cards.find((card) => card.coordinate === currentCoordinate)?.clue || "";
    const constraints = [];
    const record = (match, predicate) => constraints.push({
      start: match.index,
      end: match.index + match[0].length,
      coordinates: new Set(cards.filter(predicate).map((card) => card.coordinate))
    });
    const adjacent = (card, anchor) => {
      const index = indexForCoordinate(card.coordinate);
      const origin = indexForCoordinate(anchor.coordinate);
      return index >= 0 && origin >= 0 && index !== origin &&
        Math.abs(index % COLUMNS - origin % COLUMNS) <= 1 &&
        Math.abs(Math.floor(index / COLUMNS) - Math.floor(origin / COLUMNS)) <= 1;
    };
    const recordNeighbors = (match, anchors, common) => {
      if (!anchors.length) return;
      record(match, (card) => common
        ? anchors.every((anchor) => adjacent(card, anchor))
        : anchors.some((anchor) => adjacent(card, anchor)));
    };
    for (const match of clue.matchAll(/\bcorners?\b/gi)) {
      record(match, (card) => /^(?:A|D)(?:1|5)$/.test(card.coordinate));
    }
    for (const match of clue.matchAll(/\brows?\s+([1-5](?:\s*(?:,\s*(?:and\s+)?|and\s+|&\s*)[1-5])*)\b/gi)) {
      const rows = match[1].match(/[1-5]/g);
      record(match, (card) => rows.includes(card.coordinate[1]));
    }
    for (const match of clue.matchAll(/\b(?:columns?|cols?\.?)\s+([A-D](?:\s*(?:,\s*(?:and\s+)?|and\s+|&\s*)[A-D])*)\b/gi)) {
      const columns = match[1].toUpperCase().split(/\s*(?:,\s*(?:AND\s+)?|AND\s+|&\s*)/);
      record(match, (card) => columns.includes(card.coordinate[0]));
    }

    const names = cards.map((card) => String(card.name || "").trim()).filter(Boolean)
      .map((name) => name.charAt(0).toUpperCase() + name.slice(1));
    const namePattern = names.sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
    const namedCard = (name) => cards.find((card) => textReferencesName(name, card.name));
    if (namePattern) {
      const directionPattern = new RegExp(`\\b(directly\\s+)?(above|below|(?:to\\s+the\\s+)?left\\s+of|(?:to\\s+the\\s+)?right\\s+of)\\s+(${namePattern}|me)(?![\\p{L}\\p{N}])`, "giu");
      for (const match of clue.matchAll(directionPattern)) {
        const anchor = match[3].toLowerCase() === "me"
          ? cards.find((card) => card.coordinate === currentCoordinate) : namedCard(match[3]);
        if (!anchor) continue;
        const origin = indexForCoordinate(anchor.coordinate);
        record(match, (card) => {
          const index = indexForCoordinate(card.coordinate);
          if (index < 0 || origin < 0) return false;
          const dx = index % COLUMNS - origin % COLUMNS;
          const dy = Math.floor(index / COLUMNS) - Math.floor(origin / COLUMNS);
          const direction = match[2].toLowerCase();
          const inDirection = direction === "above" ? dx === 0 && dy < 0
            : direction === "below" ? dx === 0 && dy > 0
            : direction.includes("left") ? dy === 0 && dx < 0 : dy === 0 && dx > 0;
          return inDirection && (!match[1] || Math.abs(dx) + Math.abs(dy) === 1);
        });
      }
      const betweenPattern = new RegExp(`\\bbetween\\s+(${namePattern})\\s+and\\s+(${namePattern})(?![\\p{L}\\p{N}])`, "giu");
      for (const match of clue.matchAll(betweenPattern)) {
        const anchors = [match[1], match[2]].map(namedCard);
        if (anchors.some((card) => !card)) continue;
        const [a, b] = anchors.map((card) => indexForCoordinate(card.coordinate));
        if (a < 0 || b < 0) continue;
        record(match, (card) => {
          const index = indexForCoordinate(card.coordinate);
          const sameColumn = a % COLUMNS === b % COLUMNS && index % COLUMNS === a % COLUMNS;
          const sameRow = Math.floor(a / COLUMNS) === Math.floor(b / COLUMNS) && Math.floor(index / COLUMNS) === Math.floor(a / COLUMNS);
          return (sameColumn || sameRow) && index > Math.min(a, b) && index < Math.max(a, b);
        });
      }

      const person = `(?:${namePattern})(?:['’]s|['’])?`;
      const people = `${person}(?:\\s*(?:,\\s*(?:and\\s+)?|and\\s+|&\\s*)${person})*`;
      const neighbor = "neighbou?rs?";
      const patterns = [
        { pattern: `\\b(?:(?:common|shared)\\s+)?${neighbor}\\s+of\\s+(${people})`, common: false },
        { pattern: `(?<![\\p{L}\\p{N}])(${people})\\s+(?:(?:common|shared)\\s+)?${neighbor}`, common: false },
        { pattern: `(?<![\\p{L}\\p{N}])(${people})\\s+(?:share|shares|have|has)\\s+(?:(?:\\d+|one|two|three|four|five|six|seven|eight|no|some|an?|exactly|only|innocent|criminal|common|shared)\\s+)*${neighbor}`, common: false },
        // A person neighboring X and Y must neighbor both, unlike a list of their neighbors.
        { pattern: `\\bneighbou?r(?:ing|s)?\\s+(${people})`, common: true }
      ];
      for (const { pattern, common } of patterns) {
        const expression = new RegExp(`${pattern}(?![\\p{L}\\p{N}])(?:\\s+in\\s+common\\b)?`, "giu");
        for (const match of clue.matchAll(expression)) {
          const anchors = cards.filter((card) => textReferencesName(match[1], card.name));
          recordNeighbors(match, anchors, common || /\b(?:common|shared|share|shares)\b/i.test(match[0]));
        }
      }
    }
    for (const match of clue.matchAll(/\bmy\s+(?:(?:innocent|criminal)\s+)?neighbou?rs?\b/gi)) {
      recordNeighbors(match, cards.filter((card) => card.coordinate === currentCoordinate), false);
    }

    // All spatial types use this same intersection step. "Or", comparisons,
    // sentence boundaries, and new subjects/counts start separate groups.
    constraints.sort((a, b) => a.start - b.start || b.end - a.end);
    const selected = new Set();
    let group = null;
    let previousEnd = -1;
    const flush = () => { if (group) for (const coordinate of group) selected.add(coordinate); };
    const sameGroup = /^\s*(?:,\s*)?(?:(?:and|also|both|are|is|that|who|which|in|on|at|of|the)\s+)*$/i;
    for (const constraint of constraints) {
      if (constraint.start < previousEnd) continue; // Prefer the full phrase over nested matches.
      const connector = clue.slice(previousEnd, constraint.start);
      if (group && sameGroup.test(connector)) {
        group = new Set([...group].filter((coordinate) => constraint.coordinates.has(coordinate)));
      } else {
        flush();
        group = constraint.coordinates;
      }
      previousEnd = constraint.end;
    }
    flush();
    return cards.filter((card) => selected.has(card.coordinate)).map((card) => card.coordinate);
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
    spatialCoordinates,
    tagShortcut
  };
});
