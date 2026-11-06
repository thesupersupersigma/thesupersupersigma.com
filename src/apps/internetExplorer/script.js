// window frame behavior (caption buttons, dragging, resizing) shared by every app
import { sendToDesktop } from "../shared/window.js";

// =====================================================================
// Settings
// =====================================================================

// the page IE opens on launch, and what the Home button goes to
const HOME = "https://github.com/thesupersupersigma";

// Some sites refuse to be shown inside a frame (GitHub, Google, YouTube...).
// For addresses listed here, IE loads a built-in page instead, while the
// address bar still shows the real address. Keys are lowercase, no trailing "/".
const BUILT_IN_PAGES = {
    "https://github.com/thesupersupersigma": "/apps/internetExplorer/pages/github.html",
};

// typing something that isn't an address searches here (Wikipedia allows frames)
const SEARCH_URL = "https://en.wikipedia.org/w/index.php?search=";

// =====================================================================
// Page elements
// =====================================================================

const $ = (id) => document.getElementById(id);
const tabsEl = $("tabs");
const newTabBtn = $("newTabBtn");
const viewport = $("viewport");
const tabTemplate = $("tabTemplate");
const addrInput = $("addrInput");
const backBtn = $("backBtn");
const forwardBtn = $("forwardBtn");

// =====================================================================
// Addresses
// =====================================================================

function builtInFor(url) {
    return BUILT_IN_PAGES[url.toLowerCase().replace(/\/+$/, "")];
}

// what the user typed -> a real URL
function toUrl(text) {
    text = text.trim();
    if (!text) return null;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;            // already has https:// etc.
    if (!/\s/.test(text) && /\.[a-z]{2,}(\/|:|$)/i.test(text)) return "https://" + text;  // looks like example.com
    return SEARCH_URL + encodeURIComponent(text);
}

function hostOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}

// =====================================================================
// Tabs
// =====================================================================

const tabs = [];
let activeTab = null;

// each tab: { el, titleEl, frame, history: [urls], index }
function createTab(url, makeActive = true) {
    const el = tabTemplate.content.firstElementChild.cloneNode(true);
    const frame = document.createElement("iframe");
    frame.className = "tabFrame";
    frame.title = "Page";
    viewport.appendChild(frame);

    const tab = { el, titleEl: el.querySelector(".tabTitle"), frame, history: [], index: -1 };
    tabs.push(tab);
    tabsEl.insertBefore(el, newTabBtn);

    // switch tabs by clicking, close with the X or a middle-click
    el.addEventListener("click", () => activate(tab));
    el.querySelector(".tabClose").addEventListener("click", (event) => {
        event.stopPropagation();
        closeTab(tab);
    });
    el.addEventListener("auxclick", (event) => {
        if (event.button === 1) closeTab(tab);
    });

    frame.addEventListener("load", () => {
        el.classList.remove("loading");
        // built-in pages are on our own site, so we can read their title
        try {
            const title = frame.contentDocument?.title;
            if (title) setTitle(tab, title);
        } catch {
            // other sites: can't read their title, the address is used instead
        }
    });

    observeWidth(tab);

    if (url) navigate(tab, url);
    if (makeActive) activate(tab);
    return tab;
}

function setTitle(tab, title) {
    tab.titleEl.textContent = title;
    tab.el.title = title;
}

function currentUrl(tab) {
    return tab.history[tab.index] || "";
}

function load(tab) {
    const url = currentUrl(tab);
    tab.frame.src = builtInFor(url) || url;
    tab.el.classList.add("loading");
    setTitle(tab, hostOf(url));
    if (tab === activeTab) updateToolbar();
}

function navigate(tab, url) {
    // going somewhere new drops anything you could have gone "forward" to
    tab.history = tab.history.slice(0, tab.index + 1);
    tab.history.push(url);
    tab.index = tab.history.length - 1;
    load(tab);
}

function activate(tab) {
    activeTab = tab;
    for (const t of tabs) {
        t.el.classList.toggle("active", t === tab);
        t.frame.classList.toggle("active", t === tab);
    }
    updateToolbar();
}

function closeTab(tab) {
    const i = tabs.indexOf(tab);
    tabs.splice(i, 1);
    tab.el.remove();
    tab.frame.remove();

    // closing the last tab closes IE, like the real thing
    if (!tabs.length) {
        sendToDesktop("close");
        return;
    }
    if (tab === activeTab) activate(tabs[Math.min(i, tabs.length - 1)]);
}

function updateToolbar() {
    if (!activeTab) return;
    if (document.activeElement !== addrInput) addrInput.value = currentUrl(activeTab);
    backBtn.disabled = activeTab.index <= 0;
    forwardBtn.disabled = activeTab.index >= activeTab.history.length - 1;
}

// very narrow tabs hide their title and X so the icon still fits
const widthWatcher = new ResizeObserver((entries) => {
    for (const entry of entries) {
        entry.target.classList.toggle("narrow", entry.contentRect.width < 60);
    }
});

function observeWidth(tab) {
    widthWatcher.observe(tab.el);
}

// =====================================================================
// Toolbar
// =====================================================================

function go() {
    const url = toUrl(addrInput.value);
    if (!url || !activeTab) return;
    navigate(activeTab, url);
    addrInput.blur();
    updateToolbar();
}

addrInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") go();
    if (event.key === "Escape") {
        addrInput.value = currentUrl(activeTab);
        addrInput.blur();
    }
});

// select the whole address when you click into it, like IE
addrInput.addEventListener("focus", () => addrInput.select());

$("goBtn").addEventListener("click", go);

$("refreshBtn").addEventListener("click", () => {
    if (activeTab && currentUrl(activeTab)) load(activeTab);
});

$("homeBtn").addEventListener("click", () => {
    if (activeTab) navigate(activeTab, HOME);
});

backBtn.addEventListener("click", () => {
    if (!activeTab || activeTab.index <= 0) return;
    activeTab.index--;
    load(activeTab);
});

forwardBtn.addEventListener("click", () => {
    if (!activeTab || activeTab.index >= activeTab.history.length - 1) return;
    activeTab.index++;
    load(activeTab);
});

// new tab: blank page, address bar ready to type in
newTabBtn.addEventListener("click", () => {
    createTab(null);
    addrInput.value = "";
    addrInput.focus();
});

// =====================================================================
// Start
// =====================================================================

createTab(HOME);
