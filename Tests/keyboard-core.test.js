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

test("mechs references every card with the mech profession", () => {
  const cards = [
    { coordinate: "A1", name: "joyce", profession: "mech", clue: "2 mechs have an innocent directly above them." },
    { coordinate: "B1", name: "rob", profession: "mech", clue: "" },
    { coordinate: "C1", name: "will", profession: "mech", clue: "" },
    { coordinate: "D1", name: "ana", profession: "guard", clue: "" }
  ];

  assert.deepEqual(core.referencedCoordinates(cards, "A1"), ["A1", "B1", "C1"]);
});

test("editable controls are detected", () => {
  assert.equal(core.isEditable({ tagName: "INPUT" }), true);
  assert.equal(core.isEditable({ tagName: "div", isContentEditable: true }), true);
  assert.equal(core.isEditable({ tagName: "button" }), false);
});

function spatialBoard(clue) {
  return Array.from({ length: 20 }, (_, index) => ({
    coordinate: core.coordinateForIndex(index),
    name: ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Fred', 'Gina', 'Hank', 'Iris', 'Jack', 'Kate', 'Leo', 'Mary', 'Nora', 'Olive', 'Paul', 'Quinn', 'Rob', 'Sue', 'Tom'][index],
    clue: index === 19 ? clue : ''
  }));
}
const spatial = (clue) => core.spatialCoordinates(spatialBoard(clue), 'D5');

test('neighbor rings include diagonals without wrapping or including the anchor itself', () => {
  assert.deepEqual(spatial('The neighbors of Alice are innocent.'), ['B1', 'A2', 'B2']);
  assert.equal(spatial("Fred’s neighbors are innocent.").length, 8);
  assert.deepEqual(spatial('My neighbors are innocent.'), ['C4', 'D4', 'C5']);
});

test('multiple anchors use a union, while common and shared neighbors use the intersection', () => {
  assert.deepEqual(spatial('The neighbors of Alice and Carol are innocent.'), ['B1', 'D1', 'A2', 'B2', 'C2', 'D2']);
  for (const clue of ['The common neighbors of Alice and Carol are innocent.', 'Alice and Carol share two innocent neighbors.', 'Alice and Carol’s shared neighbours are innocent.']) {
    assert.deepEqual(spatial(clue), ['B1', 'B2'], clue);
  }
  assert.deepEqual(spatial('Alice has three innocent neighbors. Bob is a criminal.'), ['B1', 'A2', 'B2']);
  assert.deepEqual(spatial('Alice knows Carol. There are three innocent neighbors.'), []);
});

test('row and column references select the entire specified groups', () => {
  assert.deepEqual(spatial('Row 2 is the only row with three innocents.'), ['A2', 'B2', 'C2', 'D2']);
  assert.deepEqual(spatial('Col B is the only column with two criminals.'), ['B1', 'B2', 'B3', 'B4', 'B5']);
  assert.equal(spatial('Rows 1 and 3 have no criminals.').length, 8);
  assert.equal(spatial('Columns A and C have no criminals.').length, 10);
});

test('trailing in common selects only mutual neighbors, including when the count is zero', () => {
  const cards = spatialBoard('Berat and Olive have no innocent neighbors in common');
  cards[1].name = 'Berat'; // B1
  cards[10].name = 'Olive'; // C3
  cards[14].name = 'Other';
  assert.deepEqual(core.spatialCoordinates(cards, 'D5'), ['B2', 'C2']);
  cards[19].clue = 'Berat and Olive have two criminal neighbours in common.';
  assert.deepEqual(core.spatialCoordinates(cards, 'D5'), ['B2', 'C2']);
  cards[19].clue = 'Berat and Olive have no innocent neighbors. They have something else in common.';
  assert.deepEqual(core.spatialCoordinates(cards, 'D5'), ['A1', 'C1', 'A2', 'B2', 'C2', 'D2', 'B3', 'D3', 'B4', 'C4', 'D4']);
});

test('directional ranges intersect constraints and exclude both endpoints', () => {
  assert.deepEqual(spatial('There are 2 innocents below Alice and above Quinn.'), ['A2', 'A3', 'A4']);
  assert.deepEqual(spatial('There are 2 innocents right of Alice and left of Dave.'), ['B1', 'C1']);
  assert.deepEqual(spatial('There are 2 innocents to the left of Dave and to the right of Alice.'), ['B1', 'C1']);
  assert.deepEqual(spatial('There are 2 innocents between Alice and Quinn.'), ['A2', 'A3', 'A4']);
  assert.deepEqual(spatial('There are 2 innocents between Alice and Dave.'), ['B1', 'C1']);
  assert.deepEqual(spatial('There are innocents below Quinn and above Alice.'), []);
  assert.deepEqual(spatial('There are innocents below Alice and above Tom.'), []);
});

test('single directions, direct adjacency, and disjoint clauses keep their scope', () => {
  assert.deepEqual(spatial('The person directly below Alice is innocent.'), ['A2']);
  assert.deepEqual(spatial('The person directly above me is innocent.'), ['D4']);
  assert.deepEqual(spatial('There are innocents above Iris.'), ['A1', 'A2']);
  assert.deepEqual(spatial('An innocent is below Mary or above Eve.'), ['A1', 'A5']);
  assert.deepEqual(spatial('An innocent is below Mary and a criminal is above Eve.'), ['A1', 'A5']);
  assert.deepEqual(spatial('Alice and Quinn are innocent.'), []);
  assert.deepEqual(core.spatialCoordinates(spatialBoard('Neighbors of Alice'), 'A1'), []);
});

test('neighboring and directional constraints intersect within the same group', () => {
  const cards = spatialBoard('Exactly 2 of the 4 innocents neighboring Ike are below Amy');
  cards[0].name = 'Amy';
  cards[5].name = 'Ike';
  assert.deepEqual(core.spatialCoordinates(cards, 'D5'), ['A2', 'A3']);
  cards[19].clue = 'Exactly 2 innocents below Amy are neighboring Ike.';
  assert.deepEqual(core.spatialCoordinates(cards, 'D5'), ['A2', 'A3']);
  cards[19].clue = 'The innocents neighbouring Ike and below Amy are connected.';
  assert.deepEqual(core.spatialCoordinates(cards, 'D5'), ['A2', 'A3']);
  cards[19].clue = 'The innocents neighboring Ike are directly below Amy.';
  assert.deepEqual(core.spatialCoordinates(cards, 'D5'), ['A2']);
  cards[19].clue = 'There are innocents neighboring Ike. Two criminals are below Amy.';
  assert.deepEqual(core.spatialCoordinates(cards, 'D5'), ['A1', 'B1', 'C1', 'A2', 'C2', 'A3', 'B3', 'C3', 'A4', 'A5']);
});

test('all spatial types compose as intersections within one described group', () => {
  const cases = [
    ['The innocents in row 2 neighbor Alice.', ['B2', 'A2']],
    ['The innocents neighboring Alice are in row 2.', ['A2', 'B2']],
    ['The innocents in column A are neighboring Fred.', ['A1', 'A2', 'A3']],
    ['The innocents neighboring Fred are in column A and below Alice.', ['A2', 'A3']],
    ['The neighbors of Fred below Alice are innocent.', ['A2', 'A3']],
    ["Fred’s neighbors below Alice are innocent.", ['A2', 'A3']],
    ['The common neighbors of Alice and Carol are in row 2.', ['B2']],
    ['Alice and Carol have two neighbors in common in row 2.', ['B2']],
    ['The innocents neighboring Alice and Carol are in row 2.', ['B2']],
    ['The innocents in row 2 neighbor Alice and Carol.', ['B2']],
    ['The innocents in row 5 neighbor Olive.', ['B5', 'C5', 'D5']],
    ['The innocents between Alice and Quinn are neighboring Fred.', ['A2', 'A3']],
    ['My neighbors in column C are innocent.', ['C4', 'C5']],
    ['The common neighbors of Alice and Carol in column D are innocent.', []],
    ['The innocents in row 2 and in column C are neighboring Fred.', ['C2']]
  ];
  for (const [clue, expected] of cases) {
    assert.deepEqual(spatial(clue), expected.sort((a,b) => core.indexForCoordinate(a) - core.indexForCoordinate(b)), clue);
  }
});

test('separate groups, alternatives, and comparisons do not accidentally intersect', () => {
  assert.deepEqual(spatial('There are more criminals in row 1 than row 4.'), ['A1', 'B1', 'C1', 'D1', 'A4', 'B4', 'C4', 'D4']);
  assert.deepEqual(spatial('The innocents neighboring Alice or neighboring Carol are connected.'), ['B1', 'D1', 'A2', 'B2', 'C2', 'D2']);
  assert.deepEqual(spatial('The neighbors of Alice are innocent. Row 5 has two criminals.'), ['B1', 'A2', 'B2', 'A5', 'B5', 'C5', 'D5']);
});

test('corners select the four corner cells and intersect with other spatial constraints', () => {
  const cases = [
    ['Two innocents are in the corners.', ['A1', 'D1', 'A5', 'D5']],
    ['One corner is innocent.', ['A1', 'D1', 'A5', 'D5']],
    ['The corners neighboring Fred are innocent.', ['A1']],
    ['The neighbors of Fred at the corners are innocent.', ['A1']],
    ['The neighbors of Fred on the corners are innocent.', ['A1']],
    ['The corners in row 1 are innocent.', ['A1', 'D1']],
    ['The innocents in column D are in the corners.', ['D1', 'D5']],
    ['The corners below Alice are innocent.', ['A5']],
    ['The common neighbors of Bob and Eve in the corners are innocent.', ['A1']],
    ['The corners in row 3 are innocent.', []],
    ['The corners neighboring Fred and below Alice are innocent.', []]
  ];
  for (const [clue, expected] of cases) assert.deepEqual(spatial(clue), expected, clue);
  const cards = spatialBoard('The corners are innocent.').filter((card) => card.coordinate !== 'A1');
  assert.deepEqual(core.spatialCoordinates(cards, 'D5'), ['D1', 'A5', 'D5']);
});
