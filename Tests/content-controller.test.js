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
  const { controller, dispatched } = environment();
  const cardEvents = [];
  const element = {
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 160 }),
    dispatchEvent: (event) => { cardEvents.push(event); }
  };
  controller.currentCard = () => ({ coordinate: "A1", element });
  assert.equal(controller.activateCurrentCard(), true);
  const click = cardEvents.at(-1);
  assert.deepEqual(cardEvents.map((event) => event.type), ["pointerdown", "click"]);
  assert.equal(dispatched.at(-1).type, "pointerup");
  assert.equal(click.type, "click");
  assert.equal(click.clientX, 60);
  assert.equal(click.clientY, 100);
  assert.equal(click.bubbles, true);
});

test("card activation clears click suppression left by a tag long-press", () => {
  const { controller } = environment();
  let suppressClick = true;
  let activated = false;
  const element = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 160 }),
    dispatchEvent(event) {
      if (event.type === "pointerdown") suppressClick = false;
      if (event.type === "click" && !suppressClick) activated = true;
    }
  };
  controller.currentCard = () => ({ coordinate: "A1", element });

  assert.equal(controller.activateCurrentCard(), true);
  assert.equal(activated, true);
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

test('spatial and yellow reference markers coexist and clear when selection changes', () => {
  const { controller } = environment();
  const makeElement = () => ({ dataset: {}, parentElement: { dataset: {} }, hasAttribute: () => true });
  const cards = [
    { coordinate: 'A1', name: 'Alice', clue: 'Row 1 has an innocent to the left of Bob.', element: makeElement() },
    { coordinate: 'B1', name: 'Bob', clue: '', element: makeElement() },
    { coordinate: 'C1', name: 'Carol', clue: '', element: makeElement() }
  ];
  controller.cards = () => cards;
  controller.setCurrent('A1', false);
  assert.equal(cards[1].element.dataset.cluesKeyboardReferenced, 'true');
  assert.equal(cards[1].element.dataset.cluesKeyboardSpatial, 'true');
  controller.setCurrent('B1', false);
  for (const card of cards) {
    assert.equal(card.element.dataset.cluesKeyboardReferenced, undefined);
    assert.equal(card.element.dataset.cluesKeyboardSpatial, undefined);
  }
  controller.currentCoordinate = 'A1';
  controller.initialized = true;
  controller.hasMovedInitialFocus = true;
  controller.refresh();
  assert.equal(cards[1].element.dataset.cluesKeyboardReferenced, 'true');
  assert.equal(cards[1].element.dataset.cluesKeyboardSpatial, 'true');
  cards[0].clue = '';
  controller.refresh();
  assert.equal(cards[1].element.dataset.cluesKeyboardSpatial, undefined);
});

test('ring preferences default on and each can be disabled without losing current focus', async () => {
  const { controller, windowObject } = environment();
  windowObject.browser = { storage: { local: { set: async () => {} } } };
  const element = { dataset: {}, parentElement: { dataset: {} }, hasAttribute: () => true };
  const card = { coordinate: 'A1', name: 'Alice', clue: 'Alice is in row 1.', element };
  controller.cards = () => [card];
  controller.currentCoordinate = 'A1';
  controller.initialized = true;
  controller.hasMovedInitialFocus = true;
  for (const referenceRings of [true, false]) {
    for (const spatialRings of [true, false]) {
      await controller.setSetting('referenceRings', referenceRings);
      await controller.setSetting('spatialRings', spatialRings);
      const verify = () => {
        assert.equal(element.dataset.cluesKeyboardReferenced, referenceRings ? 'true' : undefined);
        assert.equal(element.dataset.cluesKeyboardSpatial, spatialRings ? 'true' : undefined);
        assert.equal(element.dataset.cluesKeyboardCurrent, 'true');
      };
      verify(); // refresh after a preference change
      controller.setCurrent('A1', false);
      verify(); // navigation applies the same preferences
    }
  }
});

test('ring preferences persist in both browser APIs and default missing values to enabled', async () => {
  for (const api of ['browser', 'chrome']) {
    const { controller, windowObject } = environment();
    const saved = {};
    windowObject[api] = { storage: { local: {
      get: async () => ({ ...saved }),
      set: async (values) => Object.assign(saved, values)
    } } };
    await controller.loadSettings();
    assert.deepEqual(controller.settings, { referenceRings: true, spatialRings: true });
    await controller.setSetting('referenceRings', false);
    await controller.setSetting('spatialRings', false);
    const next = new KeyboardController(controller.document, windowObject);
    await next.loadSettings();
    assert.deepEqual(next.settings, { referenceRings: false, spatialRings: false });
    next.onSettingsChanged({ referenceRings: { newValue: true } }, 'local');
    assert.deepEqual(next.settings, { referenceRings: true, spatialRings: false });
    next.onSettingsChanged({ spatialRings: { newValue: true } }, 'sync');
    assert.equal(next.settings.spatialRings, false);
  }
});

test('a delayed settings read cannot overwrite a new user preference', async () => {
  const { controller, windowObject } = environment();
  let finishRead;
  windowObject.chrome = { storage: { local: {
    get: () => new Promise((resolve) => { finishRead = resolve; }),
    set: async () => {}
  } } };
  const reading = controller.loadSettings();
  await controller.setSetting('referenceRings', false);
  finishRead({ referenceRings: true, spatialRings: false });
  await reading;
  assert.deepEqual(controller.settings, { referenceRings: false, spatialRings: false });
});

test('Escape closes help while a settings checkbox is focused', () => {
  const { controller, documentObject } = environment();
  documentObject.activeElement = { tagName: 'INPUT' };
  controller.helpOverlay = () => ({});
  let closed = false;
  controller.closeHelp = () => { closed = true; };
  controller.onKeyDown({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
  assert.equal(closed, true);
});
