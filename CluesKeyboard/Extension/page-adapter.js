// SPDX-License-Identifier: Apache-2.0

(function () {
  "use strict";

  if (window.__cluesKeyboardPageAdapter) return;
  window.__cluesKeyboardPageAdapter = true;

  const REQUEST_EVENT = "clues-keyboard:set-tag";
  const RESULT_EVENT = "clues-keyboard:tag-result";
  const HOLD_MS = 285;
  const STEP_PX = 35;

  const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  function pointerEvent(type, pointerId, clientX, clientY, buttons) {
    return new PointerEvent(type, {
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

  function cardForCoordinate(coordinate) {
    return Array.from(document.querySelectorAll("#grid.card-grid .card-container > .card"))
      .find((card) => card.querySelector(".coord")?.textContent?.trim() === coordinate);
  }

  function shimPointerCapture(card) {
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

  async function waitForPicker(card) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await delay(attempt === 0 ? HOLD_MS : 25);
      const picker = card.parentElement?.querySelector(".color-picker input[type='range']") ||
        document.querySelector(".color-picker input[type='range']");
      if (picker) return picker;
    }
    return null;
  }

  async function setTag({ coordinate, corner, color }) {
    const card = cardForCoordinate(coordinate);
    if (!card || !Number.isInteger(corner) || !Number.isInteger(color) || color < 0 || color > 6) return false;

    const pointerId = 9841;
    const rect = card.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height * (corner === 0 ? 0.25 : 0.75);
    const restoreCapture = shimPointerCapture(card);
    let ended = false;

    try {
      card.dispatchEvent(pointerEvent("pointerdown", pointerId, x, y, 1));
      const picker = await waitForPicker(card);
      if (!picker) return false;
      const startColor = Number(picker.value || 0);
      const targetY = y + (color - startColor) * STEP_PX;
      card.dispatchEvent(pointerEvent("pointermove", pointerId, x, targetY, 1));
      await delay(20);
      window.dispatchEvent(pointerEvent("pointerup", pointerId, x, targetY, 0));
      ended = true;
      return true;
    } finally {
      if (!ended) window.dispatchEvent(pointerEvent("pointercancel", pointerId, x, y, 0));
      restoreCapture();
    }
  }

  document.addEventListener(REQUEST_EVENT, async (event) => {
    const detail = event.detail || {};
    let success = false;
    try {
      success = await setTag(detail);
    } catch (error) {
      console.warn("Clues keyboard tag adapter failed", error);
    }
    document.dispatchEvent(new CustomEvent(RESULT_EVENT, {
      detail: { requestId: detail.requestId, success }
    }));
  });
})();

