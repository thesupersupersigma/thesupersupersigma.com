// Shared window behavior for every app page (runs inside the iframe).
// Import it from the app's own script:  import "../shared/window.js";
//
// The app page needs:  <body data-app="appName">  and one  <div class="window">.
// Mark empty areas you can drag the window by with  data-drag  (like a title bar).
//
// The window can't move or resize its own iframe, so it sends messages to the
// desktop (the parent page), and the desktop's script.js does the actual moving.

const windowEl = document.querySelector(".window");
const app = document.body.dataset.app;

const EDGE = 6; // px from the window's edge that counts as a resize border
const CURSORS = {
    n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
    ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize",
};
const INTERACTIVE = "button, input, select, textarea, a, [data-no-drag]";

// exported so apps can send their own messages too (like IE closing when its last tab closes)
export function sendToDesktop(action, extra = {}) {
    window.parent.postMessage({ app: app, action: action, ...extra }, location.origin);
}

// ---------- caption buttons ----------

windowEl.querySelector(".minBtn")?.addEventListener("click", () => sendToDesktop("minimize"));
windowEl.querySelector(".maxBtn")?.addEventListener("click", () => sendToDesktop("maximize"));
windowEl.querySelector(".closeBtn")?.addEventListener("click", () => sendToDesktop("close"));

// clicking anywhere in the window brings it to the front
document.addEventListener("pointerdown", () => sendToDesktop("focus"), true);

// the desktop tells us when we're maximized, so the glyph and corners can change
window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    if (event.data && event.data.type === "windowState") {
        windowEl.classList.toggle("maximized", Boolean(event.data.maximized));
    }
});

// ---------- move + resize ----------

function isMaximized() {
    return windowEl.classList.contains("maximized");
}

// which edge (n, s, e, w, ne, ...) the pointer is on, or "" if none
function edgeAt(event) {
    if (isMaximized()) return "";
    const box = windowEl.getBoundingClientRect();
    let edge = "";
    if (event.clientY < box.top + EDGE) edge += "n";
    else if (event.clientY > box.bottom - EDGE) edge += "s";
    if (event.clientX < box.left + EDGE) edge += "w";
    else if (event.clientX > box.right - EDGE) edge += "e";
    return edge;
}

function isDragArea(target) {
    if (target.closest(INTERACTIVE)) return false;
    return target === windowEl || Boolean(target.closest("[data-drag]"));
}

let drag = null;

windowEl.addEventListener("pointermove", (event) => {
    if (drag) {
        // screen coordinates, so the numbers stay right even while the iframe moves
        sendToDesktop("dragMove", { dx: event.screenX - drag.x, dy: event.screenY - drag.y });
        return;
    }
    const edge = edgeAt(event);
    windowEl.style.cursor = edge ? CURSORS[edge] : "";
});

windowEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const edge = edgeAt(event);
    let mode = null;
    if (edge) mode = "resize";
    else if (isDragArea(event.target) && !isMaximized()) mode = "move";
    if (!mode) return;

    event.preventDefault();
    windowEl.setPointerCapture(event.pointerId); // keep getting moves even outside the iframe
    drag = { x: event.screenX, y: event.screenY };
    sendToDesktop("dragStart", { mode: mode, edge: edge });
});

function endDrag(event) {
    if (!drag) return;
    drag = null;
    if (windowEl.hasPointerCapture(event.pointerId)) windowEl.releasePointerCapture(event.pointerId);
    sendToDesktop("dragEnd");
}

windowEl.addEventListener("pointerup", endDrag);
windowEl.addEventListener("pointercancel", endDrag);

// double-click the title area to maximize / restore, like Win7
windowEl.addEventListener("dblclick", (event) => {
    if (isDragArea(event.target) && !edgeAt(event)) sendToDesktop("maximize");
});
