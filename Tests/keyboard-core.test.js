// SPDX-License-Identifier: Apache-2.0

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../CluesKeyboard/Extension/keyboard-core.js");

test("coordinates map to the fixed four-by-five grid", () => {
  assert.equal(core.coordinateForIndex(0), "A1");
  assert.equal(core.coordinateForIndex(3), "D1");
  assert.equal(core.coordinateForIndex(19), "D5");
  assert.equal(core.indexForCoordinate("C4"), 14);
  assert.equal(core.indexForCoordinate("E1"), -1);
});

test("movement wraps on every edge", () => {
  const occupied = new Set(Array.from({ length: 20 }, (_, index) => core.coordinateForIndex(index)));
  assert.equal(core.moveCoordinate("D3", "ArrowRight", occupied), "A3");
  assert.equal(core.moveCoordinate("A3", "ArrowLeft", occupied), "D3");
  assert.equal(core.moveCoordinate("B5", "ArrowDown", occupied), "B1");
  assert.equal(core.moveCoordinate("B1", "ArrowUp", occupied), "B5");
});

test("movement skips empty positions in the same direction", () => {
  const occupied = new Set(["A1", "D1", "A2"]);
  assert.equal(core.moveCoordinate("A1", "ArrowRight", occupied), "D1");
  assert.equal(core.moveCoordinate("A1", "ArrowDown", occupied), "A2");
});

test("initial focus selects the sole revealed card", () => {
  const cards = [
    { coordinate: "A1", revealed: false },
    { coordinate: "B1", revealed: true },
    { coordinate: "C1", revealed: false }
  ];
  assert.equal(core.chooseInitialCoordinate(cards), "B1");
});

test("initial focus otherwise selects A1 or the first nonempty card", () => {
  assert.equal(core.chooseInitialCoordinate([
    { coordinate: "A1", revealed: true },
    { coordinate: "B1", revealed: true }
  ]), "A1");
  assert.equal(core.chooseInitialCoordinate([
    { coordinate: "B1", revealed: false },
    { coordinate: "C1", revealed: false }
  ]), "B1");
});

test("tag shortcuts use KeyboardEvent.code and Shift chooses the bottom corner", () => {
  assert.deepEqual(core.tagShortcut("Digit0", false), { color: 0, corner: 0 });
  assert.deepEqual(core.tagShortcut("Digit6", true), { color: 6, corner: 1 });
  assert.equal(core.tagShortcut("Numpad1", false), null);
  assert.equal(core.tagShortcut("Digit7", false), null);
});

test("current clue references match names and singular or plural professions", () => {
  const cards = [
    { coordinate: "A1", name: "joyce", profession: "guard", clue: "Joyce and Rob are guards or cooks." },
    { coordinate: "B1", name: "rob", profession: "cook", clue: "" },
    { coordinate: "C1", name: "will", profession: "clerk", clue: "" },
    { coordinate: "D1", name: "roberta", profession: "pilot", clue: "" },
    { coordinate: "A2", name: "ana", profession: "doctor", clue: "" }
  ];

  assert.deepEqual(core.referencedCoordinates(cards, "A1"), ["A1", "B1"]);
  cards[0].clue = "There will be more pilots than doctors.";
  assert.deepEqual(core.referencedCoordinates(cards, "A1"), ["D1", "A2"]);
  assert.deepEqual(core.referencedCoordinates(cards, "B1"), []);
});

test("editable controls are detected", () => {
  assert.equal(core.isEditable({ tagName: "INPUT" }), true);
  assert.equal(core.isEditable({ tagName: "div", isContentEditable: true }), true);
  assert.equal(core.isEditable({ tagName: "button" }), false);
});
