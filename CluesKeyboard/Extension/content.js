// SPDX-License-Identifier: Apache-2.0

(function (root, factory) {
  const core = root.CluesKeyboardCore || (typeof require === "function" ? require("./keyboard-core.js") : null);
  const api = factory(core);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root.document && core) api.bootstrap(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function (core) {
  "use strict";

  const GRID_SELECTOR = "#grid.card-grid";
  const CARD_SELECTOR = ".card-container > .card";
  const HELP_OVERLAY_CLASS = "clues-keyboard-help-overlay";
  const ACTIVE_INDICATOR_CLASS = "clues-keyboard-active-indicator";
  const TAG_REQUEST_EVENT = "clues-keyboard:set-tag";
  const TAG_RESULT_EVENT = "clues-keyboard:tag-result";
  const POINTER_HOLD_MS = 285;
  const TAG_STEP_PX = 35;

  class KeyboardController {
    constructor(documentObject, windowObject) {
      this.document = documentObject;
      this.window = windowObject;
      this.currentCoordinate = null;
      this.initialized = false;
      this.hasMovedInitialFocus = false;
      this.refreshQueued = false;
      this.tagGestureActive = false;
      this.pageAdapterReady = false;
      this.observer = null;
      this.settings = { referenceRings: true, spatialRings: true };
      this.changedSettings = new Set();
      this.settingsWrite = Promise.resolve();

      this.onKeyDown = this.onKeyDown.bind(this);
      this.onPointerDown = this.onPointerDown.bind(this);
      this.onMutations = this.onMutations.bind(this);
      this.onSettingsChanged = this.onSettingsChanged.bind(this);
    }

    start() {
      this.extensionStorage()?.onChanged.addListener(this.onSettingsChanged);
      this.loadSettings();
      this.injectPageAdapter();
      this.document.addEventListener("keydown", this.onKeyDown, true);
      this.document.addEventListener("pointerdown", this.onPointerDown, true);
      if (this.window.MutationObserver && this.document.documentElement) {
        this.observer = new this.window.MutationObserver(this.onMutations);
        this.observer.observe(this.document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class"]
        });
      }
      this.refresh();
      return this;
    }

    injectPageAdapter() {
      const runtime = this.window.browser?.runtime || this.window.chrome?.runtime;
      if (!runtime?.getURL || !this.document.documentElement) return;
      const script = this.document.createElement("script");
      script.src = runtime.getURL("page-adapter.js");
      script.onload = () => {
        this.pageAdapterReady = true;
        script.remove();
      };
      script.onerror = () => script.remove();
      this.document.documentElement.appendChild(script);
    }

    stop() {
      this.extensionStorage()?.onChanged.removeListener(this.onSettingsChanged);
      this.document.removeEventListener("keydown", this.onKeyDown, true);
      this.document.removeEventListener("pointerdown", this.onPointerDown, true);
      this.observer?.disconnect();
      this.document.querySelector(`.${ACTIVE_INDICATOR_CLASS}`)?.remove();
    }

    extensionStorage() {
      return this.window.browser?.storage || this.window.chrome?.storage;
    }

    async loadSettings() {
      try {
        const saved = await this.extensionStorage()?.local.get(Object.keys(this.settings));
        for (const key of Object.keys(this.settings)) {
          if (!this.changedSettings.has(key)) this.settings[key] = saved?.[key] !== false;
        }
        this.syncSettingsControls();
        this.refresh();
      } catch {
        // Keep the enabled defaults if storage is temporarily unavailable.
      }
    }

    onSettingsChanged(changes, area) {
      if (area !== "local") return;
      for (const key of Object.keys(this.settings)) {
        if (!Object.prototype.hasOwnProperty.call(changes, key)) continue;
        this.changedSettings.add(key);
        this.settings[key] = changes[key].newValue !== false;
      }
      this.syncSettingsControls();
      this.refresh();
    }

    syncSettingsControls() {
      const overlay = this.helpOverlay();
      if (!overlay) return;
      for (const [key, enabled] of Object.entries(this.settings)) {
        const control = overlay.querySelector(`[data-clues-setting="${key}"]`);
        if (control) control.checked = enabled;
      }
    }

    setSetting(key, enabled) {
      if (!Object.prototype.hasOwnProperty.call(this.settings, key)) return Promise.resolve();
      this.changedSettings.add(key);
      this.settings[key] = enabled;
      this.syncSettingsControls();
      this.refresh();
      this.settingsWrite = this.settingsWrite.then(async () => {
        const storage = this.extensionStorage();
        if (!storage) throw new Error("Extension storage unavailable");
        await storage.local.set({ [key]: enabled });
      }).catch(() => {
        const status = this.helpOverlay()?.querySelector(".clues-keyboard-settings-status");
        if (status) status.textContent = "Could not save settings. Please try again.";
      });
      return this.settingsWrite;
    }

    onMutations() {
      if (this.refreshQueued) return;
      this.refreshQueued = true;
      const schedule = this.window.requestAnimationFrame || ((callback) => this.window.setTimeout(callback, 0));
      schedule(() => {
        this.refreshQueued = false;
        this.refresh();
      });
    }

    grid() {
      return this.document.querySelector(GRID_SELECTOR);
    }

    cards() {
      const grid = this.grid();
      if (!grid) return [];
      return Array.from(grid.querySelectorAll(CARD_SELECTOR)).map((element) => {
        const container = element.parentElement;
        const containers = Array.from(grid.children || []);
        const position = Math.max(0, containers.indexOf(container));
        const displayedCoordinate = element.querySelector(".coord")?.textContent?.trim();
        const revealed = element.classList.contains("flipped");
        return {
          element,
          coordinate: /^[A-D][1-5]$/.test(displayedCoordinate || "")
            ? displayedCoordinate
            : core.coordinateForIndex(position),
          revealed,
          name: element.querySelector("h3.name, .name h3, .name")?.textContent?.trim() || "",
          profession: element.querySelector("p.profession, .profession")?.textContent?.trim() || "",
          clue: revealed
            ? element.querySelector(".card-back p.hint:not(.flavour), p.hint:not(.flavour)")?.textContent?.trim() || ""
            : ""
        };
      });
    }

    currentCard() {
      return this.cards().find((card) => card.coordinate === this.currentCoordinate) || null;
    }

    isCardFocused() {
      return this.currentCard()?.element === this.document.activeElement;
    }

    siteModal() {
      return this.document.querySelector(`.modal-overlay:not(.${HELP_OVERLAY_CLASS})`);
    }

    helpOverlay() {
      return this.document.querySelector(`.${HELP_OVERLAY_CLASS}`);
    }

    ensureActiveIndicator() {
      if (this.document.querySelector(`.${ACTIVE_INDICATOR_CLASS}`) || !this.document.body) return;
      const indicator = this.document.createElement("button");
      indicator.type = "button";
      indicator.className = ACTIVE_INDICATOR_CLASS;
      indicator.setAttribute("aria-label", "Clues keyboard controls are active. Open the keyboard shortcut list.");
      indicator.textContent = "⌨ Clues keyboard active · ? Help";
      indicator.addEventListener("click", () => this.showHelp());
      this.document.body.appendChild(indicator);
    }

    refresh() {
      const cards = this.cards();
      if (!cards.length) return;

      this.ensureActiveIndicator();

      if (!this.initialized) {
        this.currentCoordinate = core.chooseInitialCoordinate(cards);
        this.initialized = true;
      } else if (!cards.some((card) => card.coordinate === this.currentCoordinate)) {
        this.currentCoordinate = cards[0].coordinate;
      }

      const references = new Set(core.referencedCoordinates(cards, this.currentCoordinate));
      const spatial = new Set(core.spatialCoordinates(cards, this.currentCoordinate));
      for (const card of cards) this.decorateCard(card, references.has(card.coordinate), spatial.has(card.coordinate));

      if (!this.hasMovedInitialFocus && !this.siteModal() && !this.helpOverlay()) {
        this.focusCurrent();
        this.hasMovedInitialFocus = true;
      } else if (
        this.hasMovedInitialFocus &&
        !this.siteModal() &&
        !this.helpOverlay() &&
        (this.document.activeElement === this.document.body || this.document.activeElement?.isConnected === false)
      ) {
        this.focusCurrent();
      }
    }

    decorateCard(card, referenced = false, spatial = false) {
      const { element, coordinate, revealed, name, profession } = card;
      if (!element.hasAttribute("role")) element.setAttribute("role", "button");
      if (!element.hasAttribute("aria-label") || element.dataset.cluesKeyboardLabel === "true") {
        const parts = [coordinate, name, profession, revealed ? "clue revealed" : "clue unrevealed"].filter(Boolean);
        element.setAttribute("aria-label", parts.join(", "));
        element.dataset.cluesKeyboardLabel = "true";
      }
      const current = coordinate === this.currentCoordinate;
      element.tabIndex = current ? 0 : -1;
      if (current) {
        element.dataset.cluesKeyboardCurrent = "true";
        if (element.parentElement) element.parentElement.dataset.cluesKeyboardCurrentContainer = "true";
      } else {
        delete element.dataset.cluesKeyboardCurrent;
        if (element.parentElement) delete element.parentElement.dataset.cluesKeyboardCurrentContainer;
      }
      if (referenced && this.settings.referenceRings) element.dataset.cluesKeyboardReferenced = "true";
      else delete element.dataset.cluesKeyboardReferenced;
      if (spatial && this.settings.spatialRings) element.dataset.cluesKeyboardSpatial = "true";
      else delete element.dataset.cluesKeyboardSpatial;
    }

    setCurrent(coordinate, focus = true) {
      if (!coordinate) return false;
      this.currentCoordinate = coordinate;
      const cards = this.cards();
      const references = new Set(core.referencedCoordinates(cards, coordinate));
      const spatial = new Set(core.spatialCoordinates(cards, coordinate));
      for (const card of cards) {
        const current = card.coordinate === coordinate;
        card.element.tabIndex = current ? 0 : -1;
        if (current) {
          card.element.dataset.cluesKeyboardCurrent = "true";
          if (card.element.parentElement) card.element.parentElement.dataset.cluesKeyboardCurrentContainer = "true";
        } else {
          delete card.element.dataset.cluesKeyboardCurrent;
          if (card.element.parentElement) delete card.element.parentElement.dataset.cluesKeyboardCurrentContainer;
        }
        if (this.settings.referenceRings && references.has(card.coordinate)) card.element.dataset.cluesKeyboardReferenced = "true";
        else delete card.element.dataset.cluesKeyboardReferenced;
        if (this.settings.spatialRings && spatial.has(card.coordinate)) card.element.dataset.cluesKeyboardSpatial = "true";
        else delete card.element.dataset.cluesKeyboardSpatial;
      }
      if (focus) this.focusCurrent();
      return true;
    }

    focusCurrent() {
      const card = this.currentCard();
      if (!card || this.siteModal() || this.helpOverlay()) return false;
      card.element.focus({ preventScroll: true });
      return true;
    }

    onPointerDown(event) {
      const cardElement = event.target?.closest?.(`${GRID_SELECTOR} ${CARD_SELECTOR}`);
      if (!cardElement) return;
      const card = this.cards().find((candidate) => candidate.element === cardElement);
      if (card) this.setCurrent(card.coordinate, true);
    }

    onKeyDown(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (this.helpOverlay()) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          this.closeHelp();
        }
        return;
      }

      if (core.isEditable(this.document.activeElement)) return;

      if (event.key === "?" || (event.code === "Slash" && event.shiftKey)) {
        event.preventDefault();
        event.stopPropagation();
        this.showHelp();
        return;
      }

      const modal = this.siteModal();
      if (modal) {
        this.handleModalKey(event, modal);
        return;
      }

      if (!this.isCardFocused()) return;

      if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) {
        const occupied = new Set(this.cards().map((card) => card.coordinate));
        const destination = core.moveCoordinate(this.currentCoordinate, event.key, occupied);
        if (destination) {
          event.preventDefault();
          this.setCurrent(destination);
        }
        return;
      }

      if (event.code === "Space" || event.code === "Enter" || event.key === "Enter") {
        if (event.code === "Space") event.preventDefault();
        if (!event.repeat) {
          event.preventDefault();
          this.activateCurrentCard();
        }
        return;
      }

      const tag = core.tagShortcut(event.code, event.shiftKey);
      if (tag && !event.repeat && !this.tagGestureActive) {
        event.preventDefault();
        this.setExactTag(tag.corner, tag.color);
      }
    }

    handleModalKey(event, modal) {
      if (event.key === "Escape") {
        this.focusAfterSiteModalCloses();
        return;
      }
      if (event.repeat || !this.currentCard()?.element.classList.contains("unflipped")) return;
      const key = String(event.key || "").toLowerCase();
      const selector = key === "i" ? ".btn-innocent" : key === "c" ? ".btn-criminal" : null;
      const button = selector ? modal.querySelector(selector) : null;
      if (!button || button.disabled) return;
      event.preventDefault();
      button.click();
      this.focusAfterSiteModalCloses();
    }

    focusAfterSiteModalCloses() {
      let attempts = 0;
      const check = () => {
        if (!this.siteModal()) {
          this.refresh();
          this.focusCurrent();
          return;
        }
        attempts += 1;
        if (attempts < 80) this.window.setTimeout(check, 25);
      };
      this.window.setTimeout(check, 0);
    }

    activateCurrentCard() {
      const card = this.currentCard()?.element;
      if (!card) return false;
      const rect = card.getBoundingClientRect();
      const pointerId = 9842;
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;
      const restoreCapture = this.shimPointerCapture(card);
      try {
        card.dispatchEvent(this.pointerEvent("pointerdown", pointerId, clientX, clientY, 1));
        this.window.dispatchEvent(this.pointerEvent("pointerup", pointerId, clientX, clientY, 0));
      } finally {
        restoreCapture();
      }
      const event = new this.window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX,
        clientY,
        view: this.window
      });
      card.dispatchEvent(event);
      return true;
    }

    async setExactTag(corner, color) {
      const card = this.currentCard()?.element;
      if (!card) return false;
      this.tagGestureActive = true;

      if (this.pageAdapterReady) {
        const success = await this.requestPageTag(corner, color);
        if (success) {
          this.window.setTimeout(() => this.refresh(), 0);
          this.tagGestureActive = false;
          return true;
        }
      }

      const pointerId = 9841;
      const rect = card.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height * (corner === 0 ? 0.25 : 0.75);
      const restoreCapture = this.shimPointerCapture(card);

      let ended = false;
      try {
        card.dispatchEvent(this.pointerEvent("pointerdown", pointerId, x, y, 1));
        const picker = await this.waitForPicker(card);
        if (!picker) return false;
        const startColor = Number(picker.value || 0);
        const targetY = y + (color - startColor) * TAG_STEP_PX;
        card.dispatchEvent(this.pointerEvent("pointermove", pointerId, x, targetY, 1));
        await this.delay(20);
        this.window.dispatchEvent(this.pointerEvent("pointerup", pointerId, x, targetY, 0));
        ended = true;
        this.window.setTimeout(() => this.refresh(), 0);
        return true;
      } finally {
        if (!ended) this.window.dispatchEvent(this.pointerEvent("pointercancel", pointerId, x, y, 0));
        restoreCapture();
        this.tagGestureActive = false;
      }
    }

    requestPageTag(corner, color) {
      const requestId = `tag-${Date.now()}-${Math.random()}`;
      return new Promise((resolve) => {
        let timeout;
        const finish = (success) => {
          this.document.removeEventListener(TAG_RESULT_EVENT, onResult);
          if (timeout) this.window.clearTimeout(timeout);
          resolve(success);
        };
        const onResult = (event) => {
          if (event.detail?.requestId === requestId) finish(Boolean(event.detail.success));
        };
        this.document.addEventListener(TAG_RESULT_EVENT, onResult);
        timeout = this.window.setTimeout(() => finish(false), 1200);
        this.document.dispatchEvent(new this.window.CustomEvent(TAG_REQUEST_EVENT, {
          detail: { requestId, coordinate: this.currentCoordinate, corner, color }
        }));
      });
    }

    shimPointerCapture(card) {
      const ownSet = Object.getOwnPropertyDescriptor(card, "setPointerCapture");
      const ownRelease = Object.getOwnPropertyDescriptor(card, "releasePointerCapture");
      Object.defineProperty(card, "setPointerCapture", { configurable: true, value: () => {} });
      Object.defineProperty(card, "releasePointerCapture", { configurable: true, value: () => {} });
      return () => {
        if (ownSet) Object.defineProperty(card, "setPointerCapture", ownSet);
        else delete card.setPointerCapture;
        if (ownRelease) Object.defineProperty(card, "releasePointerCapture", ownRelease);
        else delete card.releasePointerCapture;
      };
    }

    pointerEvent(type, pointerId, clientX, clientY, buttons) {
      return new this.window.PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        buttons,
        clientX,
        clientY
      });
    }

    async waitForPicker(card) {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await this.delay(attempt === 0 ? POINTER_HOLD_MS : 25);
        const picker = card.parentElement?.querySelector?.(".color-picker input[type='range']") ||
          this.document.querySelector(".color-picker input[type='range']");
        if (picker) return picker;
      }
      return null;
    }

    delay(milliseconds) {
      return new Promise((resolve) => this.window.setTimeout(resolve, milliseconds));
    }

    showHelp() {
      if (this.helpOverlay()) return;
      const overlay = this.document.createElement("div");
      overlay.className = HELP_OVERLAY_CLASS;
      overlay.setAttribute("role", "presentation");
      overlay.innerHTML = `
        <section class="clues-keyboard-help" role="dialog" aria-modal="true" aria-labelledby="clues-keyboard-help-title">
          <h2 id="clues-keyboard-help-title">Clues keyboard shortcuts</h2>
          <dl>
            <dt>Arrow keys</dt><dd>Move through the grid. Movement wraps at each edge.</dd>
            <dt>Space / Return</dt><dd>Open or activate the current card</dd>
            <dt>I / C</dt><dd>Choose Innocent or Criminal</dd>
            <dt>0–6</dt><dd>Set or clear the top corner tag</dd>
            <dt>Shift + 0–6</dt><dd>Set or clear the bottom corner tag</dd>
            <dt>?</dt><dd>Open this keyboard shortcut list</dd>
            <dt>Escape</dt><dd>Close a dialog or this keyboard shortcut list</dd>
          </dl>
          <fieldset class="clues-keyboard-settings">
            <legend>Settings</legend>
            <label>Reference rings (yellow) <input type="checkbox" data-clues-setting="referenceRings"></label>
            <label>Spatial rings (grey) <input type="checkbox" data-clues-setting="spatialRings"></label>
          </fieldset>
          <p class="clues-keyboard-settings-status" role="status"></p>
          <button type="button">Close</button>
          <p class="clues-keyboard-version"></p>
        </section>`;
      const runtime = this.window.browser?.runtime || this.window.chrome?.runtime;
      const version = runtime?.getManifest?.().version;
      overlay.querySelector(".clues-keyboard-version").textContent = version ? `Version ${version}` : "Version unavailable";
      overlay.addEventListener("change", (event) => {
        const key = event.target?.dataset?.cluesSetting;
        if (key) {
          overlay.querySelector(".clues-keyboard-settings-status").textContent = "";
          this.setSetting(key, event.target.checked);
        }
      });
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay || event.target.closest("button")) this.closeHelp();
      });
      this.document.body.appendChild(overlay);
      this.syncSettingsControls();
      overlay.querySelector("button").focus();
    }

    closeHelp() {
      this.helpOverlay()?.remove();
      this.focusCurrent();
    }
  }

  function bootstrap(documentObject, windowObject) {
    if (windowObject.top !== windowObject || windowObject.__cluesKeyboardController) return null;
    const controller = new KeyboardController(documentObject, windowObject).start();
    windowObject.__cluesKeyboardController = controller;
    return controller;
  }

  return { KeyboardController, bootstrap };
});
