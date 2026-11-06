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