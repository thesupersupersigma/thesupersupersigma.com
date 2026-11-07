const startMenuButton = document.getElementById("startMenuButton");
const startMenu = document.getElementById("startMenu");
const internetExplorerButton = document.getElementById("internetExplorerButton");
const mediaPlayerButton = document.getElementById("mediaPlayerButton");
const shutdownButton = document.querySelector(".shutdownButton");

// Start menu
startMenuButton.addEventListener("click", function () {
    startMenu.classList.toggle("visible");
});

// Apps

// ----- App windows -----
// Every app is its own page loaded into an iframe. The window frame (glass, caption
// buttons) is drawn inside the app page; this code opens/closes/moves the iframes.
// To add an app: add an entry here, a taskbar button, and its page in vite.config.mjs.

const desktop = document.querySelector(".windows7");
const TASKBAR_HEIGHT = 50;

const apps = {
    internetExplorer: {
        title: "Internet Explorer",
        url: "/apps/internetExplorer/internetExplorer.html",
        button: internetExplorerButton,
        startItem: document.getElementById("startInternetExplorer"),
        rect: { x: 150, y: 60, w: 900, h: 600 },   // starting position + size
        minW: 420,
        minH: 260,
    },
    mediaPlayer: {
        title: "Windows Media Player",
        url: "/apps/mediaPlayer/mediaPlayer.html",
        button: mediaPlayerButton,
        startItem: document.getElementById("startMediaPlayer"),
        rect: { x: 190, y: 40, w: 1040, h: 640 },
        minW: 640,
        minH: 420,
    },
};

let topZ = 500;          // windows live between 500 and 999 (taskbar/start menu are 1000)
let activeApp = null;    // the window that's currently in front
let dragging = null;     // the move/resize in progress, if any

// make one iframe per app
for (const [name, app] of Object.entries(apps)) {
    const frame = document.createElement("iframe");
    frame.className = "appFrame";
    frame.title = app.title;
    desktop.appendChild(frame);

    app.frame = frame;
    app.open = false;
    app.maximized = false;
    fitOnScreen(app);
    applyRect(app);

    // tell the page whether it's maximized once it loads
    frame.addEventListener("load", () => sendState(name));

    app.button.addEventListener("click", () => taskbarClick(name));
    app.startItem?.addEventListener("click", () => {
        openApp(name);
        startMenu.classList.remove("visible");
    });
}

function fitOnScreen(app) {
    const r = app.rect;
    const maxH = window.innerHeight - TASKBAR_HEIGHT;
    r.w = Math.max(app.minW, Math.min(r.w, window.innerWidth));
    r.h = Math.max(app.minH, Math.min(r.h, maxH));
    r.x = Math.min(Math.max(r.x, 0), Math.max(0, window.innerWidth - r.w));
    r.y = Math.min(Math.max(r.y, 0), Math.max(0, maxH - r.h));
}

function applyRect(app) {
    const r = app.maximized
        ? { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight - TASKBAR_HEIGHT }
        : app.rect;
    app.frame.style.left = r.x + "px";
    app.frame.style.top = r.y + "px";
    app.frame.style.width = r.w + "px";
    app.frame.style.height = r.h + "px";
    app.frame.classList.toggle("maximized", app.maximized);
}

function sendState(name) {
    const app = apps[name];
    app.frame.contentWindow?.postMessage({ type: "windowState", maximized: app.maximized }, location.origin);
}

function focusApp(name) {
    topZ++;
    if (topZ > 990) {
        // renumber every window in its current order so we never reach the taskbar's 1000
        const order = Object.values(apps).sort((a, b) => (Number(a.frame.style.zIndex) || 0) - (Number(b.frame.style.zIndex) || 0));
        order.forEach((app, i) => { app.frame.style.zIndex = 500 + i; });
        topZ = 500 + order.length;
    }
    apps[name].frame.style.zIndex = topZ;
    activeApp = name;
}

function openApp(name) {
    const app = apps[name];
    if (!app.open) {
        app.frame.src = app.url;
        app.open = true;
        app.button.classList.add("open");
    }
    app.frame.classList.add("visible");
    focusApp(name);
}

function minimizeApp(name) {
    apps[name].frame.classList.remove("visible");   // hidden, but still running
    if (activeApp === name) activeApp = null;
}

function closeApp(name) {
    const app = apps[name];
    app.frame.classList.remove("visible");
    app.frame.src = "about:blank";                   // unloads the app
    app.open = false;
    app.maximized = false;
    applyRect(app);
    app.button.classList.remove("open");
    if (activeApp === name) activeApp = null;
}

function toggleMaximize(name) {
    const app = apps[name];
    app.maximized = !app.maximized;
    applyRect(app);
    sendState(name);
}

// taskbar button works like Win7: open -> minimize if in front -> bring to front / restore
function taskbarClick(name) {
    const app = apps[name];
    const visible = app.frame.classList.contains("visible");
    if (!app.open || !visible) openApp(name);
    else if (activeApp === name) minimizeApp(name);
    else focusApp(name);
}

// move / resize, driven by the window's own drag messages
function dragMove(dx, dy) {
    const app = apps[dragging.name];
    const s = dragging.startRect;
    const r = { ...s };

    if (dragging.mode === "move") {
        r.x = s.x + dx;
        r.y = s.y + dy;
    } else {
        const edge = dragging.edge;
        if (edge.includes("e")) r.w = Math.max(app.minW, s.w + dx);
        if (edge.includes("s")) r.h = Math.max(app.minH, s.h + dy);
        if (edge.includes("w")) { r.w = Math.max(app.minW, s.w - dx); r.x = s.x + (s.w - r.w); }
        if (edge.includes("n")) { r.h = Math.max(app.minH, s.h - dy); r.y = s.y + (s.h - r.h); }
    }

    // keep the top of the window on screen so you can always grab it again
    r.y = Math.max(0, Math.min(r.y, window.innerHeight - TASKBAR_HEIGHT - 30));
    app.rect = r;
    applyRect(app);
}

// messages from the app windows (their buttons and drag areas live inside the iframe)
window.addEventListener("message", function (event) {
    if (event.origin !== location.origin) return;   // ignore messages from other sites
    const data = event.data;
    if (!data || !apps[data.app]) return;

    switch (data.action) {
        case "close": closeApp(data.app); break;
        case "minimize": minimizeApp(data.app); break;
        case "maximize": toggleMaximize(data.app); break;
        case "focus":
            focusApp(data.app);
            startMenu.classList.remove("visible");
            break;
        case "dragStart":
            dragging = { name: data.app, mode: data.mode, edge: data.edge || "", startRect: { ...apps[data.app].rect } };
            break;
        case "dragMove":
            if (dragging) dragMove(data.dx, data.dy);
            break;
        case "dragEnd":
            dragging = null;
            break;
    }
});

// keep maximized windows filling the screen when the browser is resized
window.addEventListener("resize", function () {
    for (const app of Object.values(apps)) {
        if (app.maximized) applyRect(app);
    }
});

shutdownButton.addEventListener("click", function () {
    let shutdown
    while (shutdown !== "yes" && shutdown !== "no") {
        ask();
        if (shutdown === "yes") {
            console.log("Shutting Down");
            window.location.replace("/shutdown");
        } else if (shutdown === "no") {
            console.log("Shutdown Aborted");
        } else {
            ask();
        }
    };

    function ask () {
        shutdown = prompt("Are you sure you want to shutdown?\n \n Type Yes or No");
        shutdown = shutdown.toLowerCase();
    }
});
// ----- Desktop icons -----
// Win7-style: icons sit on a grid (filled top-to-bottom, then the next column),
// drag one and it snaps to the nearest free spot when dropped, double-click opens it.
// Where you put them is remembered in this browser (localStorage).

const desktopIconsEl = document.getElementById("desktopIcons");
const desktopIcons = [...desktopIconsEl.querySelectorAll(".desktopIcon")];
const ICON_POSITIONS_KEY = "desktopIconPositions";

const iconCell = new Map();      // icon element -> { col, row }
let iconDrag = null;             // the drag in progress, if any
let justDragged = false;         // so a drag doesn't also count as a click

// grid sizes come from the CSS variables on .desktopIcons
function gridMetrics() {
    const css = getComputedStyle(desktopIconsEl);
    const px = (name) => parseFloat(css.getPropertyValue(name)) || 0;
    const m = { cellW: px("--cellW"), cellH: px("--cellH"), gridX: px("--gridX"), gridY: px("--gridY") };
    m.cols = Math.max(1, Math.floor((desktopIconsEl.clientWidth - m.gridX) / m.cellW));
    m.rows = Math.max(1, Math.floor((desktopIconsEl.clientHeight - m.gridY) / m.cellH));
    return m;
}

function cellToPixels(col, row, m) {
    return { x: m.gridX + col * m.cellW + 2, y: m.gridY + row * m.cellH };
}

function moveIconTo(icon, x, y) {
    icon.style.transform = `translate(${x}px, ${y}px)`;
}

function isCellFree(col, row, ignore) {
    for (const [icon, cell] of iconCell) {
        if (icon !== ignore && cell.col === col && cell.row === row) return false;
    }
    return true;
}

// closest empty cell to (col, row), searching outward
function nearestFreeCell(col, row, ignore, m) {
    col = Math.min(Math.max(col, 0), m.cols - 1);
    row = Math.min(Math.max(row, 0), m.rows - 1);
    let best = null;
    let bestDist = Infinity;
    const maxRing = Math.max(m.cols, m.rows);
    for (let ring = 0; ring <= maxRing; ring++) {
        for (let c = col - ring; c <= col + ring; c++) {
            for (let r = row - ring; r <= row + ring; r++) {
                if (Math.max(Math.abs(c - col), Math.abs(r - row)) !== ring) continue;   // only this ring
                if (c < 0 || r < 0 || c >= m.cols || r >= m.rows) continue;
                if (!isCellFree(c, r, ignore)) continue;
                const dist = (c - col) ** 2 + (r - row) ** 2;
                if (dist < bestDist) { best = { col: c, row: r }; bestDist = dist; }
            }
        }
        if (best) return best;
    }
    return { col, row };   // desktop completely full: stack it
}

// first empty cell in Win7 order: down the first column, then the next column
function firstFreeCell(ignore, m) {
    for (let c = 0; c < m.cols; c++) {
        for (let r = 0; r < m.rows; r++) {
            if (isCellFree(c, r, ignore)) return { col: c, row: r };
        }
    }
    return { col: 0, row: 0 };
}

function loadIconPositions() {
    try {
        return JSON.parse(localStorage.getItem(ICON_POSITIONS_KEY)) || {};
    } catch {
        return {};
    }
}

function saveIconPositions() {
    const data = {};
    for (const [icon, cell] of iconCell) data[icon.dataset.app] = cell;
    try {
        localStorage.setItem(ICON_POSITIONS_KEY, JSON.stringify(data));
    } catch {
        // storage blocked (private window etc.): positions just won't be remembered
    }
}

// place every icon: remembered spot if it still fits, otherwise the next free one
function layoutDesktopIcons() {
    const m = gridMetrics();
    const saved = loadIconPositions();
    const previous = new Map(iconCell);
    iconCell.clear();

    for (const icon of desktopIcons) {
        const wanted = previous.get(icon) || saved[icon.dataset.app];
        const cell = wanted ? nearestFreeCell(wanted.col, wanted.row, icon, m) : firstFreeCell(icon, m);
        iconCell.set(icon, cell);
        const { x, y } = cellToPixels(cell.col, cell.row, m);
        moveIconTo(icon, x, y);
    }
}

function selectDesktopIcon(icon) {
    for (const i of desktopIcons) i.classList.toggle("selected", i === icon);
}

for (const icon of desktopIcons) {
    icon.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        startMenu.classList.remove("visible");
        selectDesktopIcon(icon);
        const cell = iconCell.get(icon);
        const start = cellToPixels(cell.col, cell.row, gridMetrics());
        iconDrag = { icon, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: start, moved: false };
        icon.setPointerCapture(event.pointerId);
    });

    icon.addEventListener("pointermove", (event) => {
        if (!iconDrag || iconDrag.icon !== icon) return;
        const dx = event.clientX - iconDrag.startX;
        const dy = event.clientY - iconDrag.startY;
        if (!iconDrag.moved && Math.hypot(dx, dy) < 5) return;   // small wiggles are still a click
        iconDrag.moved = true;
        icon.classList.add("dragging");
        moveIconTo(icon, iconDrag.origin.x + dx, iconDrag.origin.y + dy);
    });

    const endDrag = (event) => {
        if (!iconDrag || iconDrag.icon !== icon) return;
        if (icon.hasPointerCapture(event.pointerId)) icon.releasePointerCapture(event.pointerId);

        if (iconDrag.moved) {
            // snap to the closest grid cell (or the nearest free one if it's taken)
            const m = gridMetrics();
            const x = iconDrag.origin.x + (event.clientX - iconDrag.startX);
            const y = iconDrag.origin.y + (event.clientY - iconDrag.startY);
            const cell = nearestFreeCell(Math.round((x - m.gridX - 2) / m.cellW), Math.round((y - m.gridY) / m.cellH), icon, m);
            iconCell.set(icon, cell);
            const snapped = cellToPixels(cell.col, cell.row, m);
            moveIconTo(icon, snapped.x, snapped.y);
            icon.classList.remove("dragging");
            saveIconPositions();
            justDragged = true;
            setTimeout(() => { justDragged = false; }, 0);
        }
        iconDrag = null;
    };
    icon.addEventListener("pointerup", endDrag);
    icon.addEventListener("pointercancel", endDrag);

    // double-click (or Enter) opens the app
    icon.addEventListener("dblclick", () => {
        if (!justDragged && apps[icon.dataset.app]) openApp(icon.dataset.app);
    });
    icon.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && apps[icon.dataset.app]) openApp(icon.dataset.app);
    });
}

// clicking empty desktop clears the selection and closes the start menu
desktopIconsEl.addEventListener("pointerdown", (event) => {
    if (event.target === desktopIconsEl) {
        selectDesktopIcon(null);
        startMenu.classList.remove("visible");
    }
});

// re-fit the grid when the browser window changes size
window.addEventListener("resize", layoutDesktopIcons);
layoutDesktopIcons();
