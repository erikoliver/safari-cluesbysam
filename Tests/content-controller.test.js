// SPDX-License-Identifier: Apache-2.0

const test = require("node:test");
const assert = require("node:assert/strict");
const { KeyboardController } = require("../CluesKeyboard/Extension/content.js");

class FakeEvent {
  constructor(type, options) {
    this.type = type;
    Object.assign(this, options);
  }
}

function environment() {
  const dispatched = [];
  const documentObject = {
    activeElement: { tagName: "DIV" },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; }
  };
  const windowObject = {
    CustomEvent: FakeEvent,
    MouseEvent: FakeEvent,
    PointerEvent: FakeEvent,
    clearTimeout() {},
    dispatchEvent(event) { dispatched.push(event); },
    setTimeout(callback) { callback(); return 1; }
  };
  return { controller: new KeyboardController(documentObject, windowObject), dispatched, documentObject, windowObject };
}

test("card activation dispatches a centered click", () => {
  const { controller } = environment();
  let click;
  const element = {
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 160 }),
    dispatchEvent: (event) => { click = event; }
  };
  controller.currentCard = () => ({ coordinate: "A1", element });
  assert.equal(controller.activateCurrentCard(), true);
  assert.equal(click.type, "click");
  assert.equal(click.clientX, 60);
  assert.equal(click.clientY, 100);
  assert.equal(click.bubbles, true);
});

test("pointer selection synchronizes logical and DOM focus", () => {
  const { controller } = environment();
  const element = {};
  let selection;

  controller.cards = () => [{ coordinate: "D3", element }];
  controller.setCurrent = (coordinate, focus) => {
    selection = [coordinate, focus];
  };

  controller.onPointerDown({
    target: { closest: () => element }
  });

  assert.deepEqual(selection, ["D3", true]);
});

test("moving keyboard focus replaces old clue-reference markers", () => {
  const { controller } = environment();
  const makeElement = () => ({ dataset: {}, parentElement: { dataset: {} } });
  const cards = [
    { coordinate: "A1", name: "Joyce", profession: "guard", clue: "Rob is a cook.", element: makeElement() },
    { coordinate: "B1", name: "Rob", profession: "cook", clue: "", element: makeElement() },
    { coordinate: "C1", name: "Will", profession: "pilot", clue: "", element: makeElement() }
  ];
  controller.cards = () => cards;
  controller.currentCoordinate = "A1";
  cards[1].element.dataset.cluesKeyboardReferenced = "true";

  controller.setCurrent("C1", false);

  assert.equal(cards[1].element.dataset.cluesKeyboardReferenced, undefined);
});

test("card decoration adds keyboard semantics but preserves a site label", () => {
  const { controller } = environment();
  const attributes = new Map([["aria-label", "Site-provided description"]]);
  const container = { dataset: {} };
  const element = {
    dataset: {},
    parentElement: container,
    hasAttribute: (name) => attributes.has(name),
    setAttribute: (name, value) => attributes.set(name, value),
    querySelector: () => null
  };
  controller.currentCoordinate = "A1";
  controller.decorateCard({ coordinate: "A1", revealed: false, element });
  assert.equal(attributes.get("role"), "button");
  assert.equal(attributes.get("aria-label"), "Site-provided description");
  assert.equal(element.tabIndex, 0);
  assert.equal(element.dataset.cluesKeyboardCurrent, "true");
  assert.equal(container.dataset.cluesKeyboardCurrentContainer, "true");
});

test("card decoration adds and removes the clue-reference marker", () => {
  const { controller } = environment();
  const element = {
    dataset: {},
    parentElement: { dataset: {} },
    hasAttribute: () => true,
    setAttribute() {}
  };
  const card = { coordinate: "B2", revealed: false, name: "Rob", profession: "cook", element };

  controller.decorateCard(card, true);
  assert.equal(element.dataset.cluesKeyboardReferenced, "true");
  controller.decorateCard(card, false);
  assert.equal(element.dataset.cluesKeyboardReferenced, undefined);
});

test("active indicator is persistent, unique, and opens help", () => {
  const { controller, documentObject } = environment();
  let indicator = null;
  let clickHandler = null;
  documentObject.body = { appendChild: (element) => { indicator = element; } };
  documentObject.querySelector = () => indicator;
  documentObject.createElement = () => ({
    setAttribute() {},
    addEventListener: (type, handler) => { if (type === "click") clickHandler = handler; }
  });
  let helpShown = false;
  controller.showHelp = () => { helpShown = true; };

  controller.ensureActiveIndicator();
  const firstIndicator = indicator;
  controller.ensureActiveIndicator();
  clickHandler();

  assert.equal(indicator, firstIndicator);
  assert.equal(indicator.textContent, "⌨ Clues keyboard active · ? Help");
  assert.equal(helpShown, true);
});

test("I and shifted C invoke the site's decision buttons", () => {
  const { controller } = environment();
  const clicked = [];
  const buttons = {
    ".btn-innocent": { disabled: false, click: () => clicked.push("innocent") },
    ".btn-criminal": { disabled: false, click: () => clicked.push("criminal") }
  };
  const modal = { querySelector: (selector) => buttons[selector] || null };
  controller.currentCard = () => ({ element: { classList: { contains: (name) => name === "unflipped" } } });
  controller.focusAfterSiteModalCloses = () => {};
  for (const event of [
    { key: "i", repeat: false, preventDefault() {} },
    { key: "C", shiftKey: true, repeat: false, preventDefault() {} }
  ]) controller.handleModalKey(event, modal);
  assert.deepEqual(clicked, ["innocent", "criminal"]);
});

test("exact tags drive the site's long-press gesture to the requested value", async () => {
  const { controller, dispatched } = environment();
  const cardEvents = [];
  const picker = { value: "1" };
  const card = {
    parentElement: { querySelector: () => picker },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 200 }),
    dispatchEvent: (event) => cardEvents.push(event)
  };
  controller.currentCard = () => ({ coordinate: "A1", element: card });
  controller.delay = async () => {};

  assert.equal(await controller.setExactTag(1, 6), true);
  assert.deepEqual(cardEvents.map((event) => event.type), ["pointerdown", "pointermove"]);
  assert.equal(cardEvents[0].clientY, 150);
  assert.equal(cardEvents[1].clientY, 325);
  assert.equal(dispatched.at(-1).type, "pointerup");
});

test("exact tags can be delegated to the page-context adapter", async () => {
  const { controller, documentObject, windowObject } = environment();
  const listeners = new Map();
  documentObject.addEventListener = (type, handler) => listeners.set(type, handler);
  documentObject.removeEventListener = (type) => listeners.delete(type);
  documentObject.dispatchEvent = (event) => {
    if (event.type === "clues-keyboard:set-tag") {
      listeners.get("clues-keyboard:tag-result")?.({
        detail: { requestId: event.detail.requestId, success: true }
      });
    }
  };
  windowObject.setTimeout = () => 1;
  controller.currentCoordinate = "C3";

  assert.equal(await controller.requestPageTag(1, 6), true);
  assert.equal(listeners.has("clues-keyboard:tag-result"), false);
});

test("question-mark shortcut opens extension help anywhere on the puzzle page", () => {
  const { controller } = environment();
  controller.siteModal = () => null;
  controller.helpOverlay = () => null;
  controller.isCardFocused = () => false;
  let shown = false;
  controller.showHelp = () => { shown = true; };
  let prevented = false;
  controller.onKeyDown({
    code: "Slash",
    key: "?",
    shiftKey: true,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    preventDefault: () => { prevented = true; },
    stopPropagation() {}
  });
  assert.equal(shown, true);
  assert.equal(prevented, true);
});
