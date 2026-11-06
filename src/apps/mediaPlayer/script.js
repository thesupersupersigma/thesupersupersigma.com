// window frame behavior (caption buttons, dragging, resizing) shared by every app
import "../shared/window.js";
import { CONFIG } from "./config.js";

// =====================================================================
// File types
// =====================================================================

const AUDIO_EXT = ["mp3", "m4a", "aac", "flac", "wav", "ogg", "oga", "opus", "wma"];
const VIDEO_EXT = ["mp4", "m4v", "webm", "mov", "mkv", "ogv"];
const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
const PLAYLIST_EXT = ["m3u", "m3u8"];

const extOf = (name) => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");
const isAudio = (name) => AUDIO_EXT.includes(extOf(name));
const isVideo = (name) => VIDEO_EXT.includes(extOf(name));
const isImage = (name) => IMAGE_EXT.includes(extOf(name));
const isPlaylist = (name) => PLAYLIST_EXT.includes(extOf(name));

function kindOf(name) {
    if (isAudio(name)) return "audio";
    if (isVideo(name)) return "video";
    if (isImage(name)) return "image";
    if (isPlaylist(name)) return "playlist";
    return "other";
}

// =====================================================================
// Talking to the media server (nginx autoindex JSON listings)
// =====================================================================

const folderSegs = (key) => CONFIG.folders[key].split("/").filter(Boolean);

function urlFor(segs, isFolder = false) {
    return CONFIG.baseUrl + segs.map(encodeURIComponent).join("/") + (isFolder ? "/" : "");
}

async function listFolder(segs) {
    const url = urlFor(segs, true);
    let res;
    try {
        res = await fetch(url);
    } catch {
        throw new Error(`Couldn't connect to ${url} (server down, or CORS isn't allowed).`);
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);

    let entries;
    try {
        entries = await res.json();
    } catch {
        throw new Error(`${url} didn't return a JSON folder listing (turn on autoindex_format json).`);
    }
    return entries.filter((entry) => !entry.name.startsWith("."));
}

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

// "03 - Sleep Away.mp3" -> { number: 3, title: "Sleep Away" }
function parseName(fileName) {
    const base = fileName.replace(/\.[^.]+$/, "");
    const match = base.match(/^(\d{1,3})(?:\s*[-._)]\s*|\s+)(.+)$/);
    return match ? { number: parseInt(match[1], 10), title: match[2].trim() } : { number: null, title: base };
}

function makeItem(name, url, size, extra = {}) {
    const { number, title } = parseName(name);
    return {
        title, number, fileName: name, url,
        size: size ?? null,
        kind: kindOf(name),
        duration: null,
        album: "", artist: "", cover: null,
        ...extra,
    };
}

// each folder is only fetched once, then reused when you switch views
const cache = {};
function cached(key, load) {
    if (!cache[key]) {
        cache[key] = load().catch((err) => {
            delete cache[key];   // let it retry next time
            throw err;
        });
    }
    return cache[key];
}

// music/Artist/Album/tracks  (also handles music/Album/tracks and loose files)
function loadMusic() {
    return cached("music", async () => {
        const root = folderSegs("music");
        const albums = [];

        async function walk(segs, depth) {
            const entries = (await listFolder(segs)).sort(byName);
            const files = entries.filter((e) => e.type === "file");
            const songs = files.filter((e) => isAudio(e.name));

            if (songs.length) {
                const coverFile =
                    files.find((e) => CONFIG.coverNames.includes(e.name.toLowerCase())) ||
                    files.find((e) => isImage(e.name));
                const inside = segs.slice(root.length);
                const album = inside.length ? inside[inside.length - 1] : "Unknown album";
                const artist = inside.length >= 2 ? inside[inside.length - 2] : "Unknown artist";
                const cover = coverFile ? urlFor([...segs, coverFile.name]) : null;

                albums.push({
                    name: album,
                    artist: artist,
                    cover: cover,
                    tracks: songs.map((e) => makeItem(e.name, urlFor([...segs, e.name]), e.size, { album, artist, cover })),
                });
            }

            if (depth < 3) {
                const folders = entries.filter((e) => e.type === "directory");
                await Promise.all(folders.map((f) => walk([...segs, f.name], depth + 1)));
            }
        }

        await walk(root, 0);
        albums.sort((a, b) =>
            a.artist.localeCompare(b.artist, undefined, { sensitivity: "base" }) ||
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
        return albums;
    });
}

// library/, video/, pictures/, playlists/ are flat folders
function loadFlat(key) {
    return cached(key, async () => {
        const segs = folderSegs(key);
        const entries = (await listFolder(segs)).sort(byName);
        return entries
            .filter((e) => e.type === "file")
            .map((e) => makeItem(e.name, urlFor([...segs, e.name]), e.size));
    });
}

// .m3u / .m3u8: one path per line, relative to the playlist file
async function loadPlaylist(playlist) {
    const res = await fetch(playlist.url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${playlist.url}`);
    const text = await res.text();

    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
            const url = new URL(line.replace(/\\/g, "/"), playlist.url).href;
            const fileName = decodeURIComponent(url.split("/").pop());
            return makeItem(fileName, url, null);
        })
        .filter((item) => item.kind === "audio" || item.kind === "video");
}

// =====================================================================
// Formatting
// =====================================================================

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "";
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

// the clock next to the controls is always two-digit minutes, like "00:06"
function formatClock(seconds) {
    const s = Math.floor(seconds || 0);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function formatSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

const STAR = '<svg viewBox="0 0 12 12"><path d="M6 1l1.5 3.1 3.4.5-2.5 2.4.6 3.4L6 8.8 2.9 10.4l.6-3.4L1 4.6l3.4-.5z"/></svg>';
const STARS_HTML = STAR.repeat(5);
const NO_ART = '<svg viewBox="0 0 16 16"><path d="M6 12.5V3.2l7.5-1.4v9.4"/><circle cx="4.3" cy="12.5" r="2"/><circle cx="11.8" cy="11.2" r="2"/></svg>';
const CRUMB_SEP = '<svg class="crumbSep" viewBox="0 0 8 8"><path d="M2 0l5 4-5 4z"/></svg>';

// =====================================================================
// Page elements
// =====================================================================

const $ = (id) => document.getElementById(id);

const contentPane = $("contentPane");
const listArea = $("listArea");
const placeholder = $("placeholder");
const breadcrumb = $("breadcrumb");
const backBtn = $("backBtn");
const forwardBtn = $("forwardBtn");
const searchInput = $("search");

const player = $("player");
const videoStage = $("videoStage");
const pictureViewer = $("pictureViewer");
const pictureImg = $("pictureImg");

const playBtn = $("playBtn");
const shuffleBtn = $("shuffleBtn");
const repeatBtn = $("repeatBtn");
const muteBtn = $("muteBtn");
const volume = $("volume");
const timeText = $("time");
const nowText = $("nowText");
const nowThumb = $("nowThumb");
const seekBar = $("seekBar");
const seekFill = $("seekFill");
const seekThumb = $("seekThumb");

videoStage.prepend(player);   // the player shows here when a video is playing

// =====================================================================
// Rendering the list
// =====================================================================

const rowOf = new Map();       // item -> its row element
let visibleItems = [];         // everything playable in the current view, in order
let selectedRow = null;

function showMessage(text, detail = "") {
    listArea.replaceChildren();
    rowOf.clear();
    visibleItems = [];
    $("placeholderText").textContent = text;
    $("placeholderDetail").textContent = detail;
    placeholder.hidden = false;
}

function hideMessage() {
    placeholder.hidden = true;
}

function selectRow(row) {
    selectedRow?.classList.remove("selected");
    selectedRow = row;
    row?.classList.add("selected");
}

function makeRow(item, list, index) {
    const row = el("div", "trackRow");

    const num = el("div", "cell cNum");
    num.append(el("span", "playingMark"));
    num.append(item.number != null ? String(item.number) : "");

    const rating = el("div", "cell cRating");
    rating.innerHTML = `<span class="stars">${STARS_HTML}</span>`;

    row.append(
        num,
        el("div", "cell cTitle", item.title),
        el("div", "cell cLen", formatTime(item.duration)),
        rating,
        el("div", "cell cArtist", item.artist),
        el("div", "cell cComposer", ""),
        el("div", "cell cSize", formatSize(item.size)),
        el("div", "cell cParental", ""),
    );

    row.addEventListener("click", () => selectRow(row));
    row.addEventListener("dblclick", () => {
        if (item.kind === "playlist") openPlaylist(item);
        else if (item.kind === "image") openPicture(item);
        else playList(list, index);
    });

    rowOf.set(item, row);
    return row;
}

// groups = [{ header, blocks: [{ cover, lines, showAlbum, items }] }]
function renderGroups(groups) {
    listArea.replaceChildren();
    rowOf.clear();
    selectedRow = null;
    visibleItems = [];

    for (const group of groups) {
        const groupEl = el("div", "group");
        const header = el("div", "groupHeader");
        header.append(el("span", "", group.header));
        groupEl.append(header);

        for (const block of group.blocks) {
            const n = block.items.length;
            const blockEl = el("div", "albumBlock");
            // one 22px row per track, then a filler row that soaks up the album art's height
            blockEl.style.gridTemplateRows = `repeat(${n}, 22px) 1fr`;

            const albumCell = el("div", "albumCell");
            albumCell.style.gridRow = `1 / span ${n + 1}`;
            if (block.showAlbum) {
                if (block.cover) {
                    const img = el("img", "cover");
                    img.src = block.cover;
                    img.alt = "";
                    img.loading = "lazy";
                    albumCell.append(img);
                } else {
                    const noArt = el("div", "cover noArt");
                    noArt.innerHTML = NO_ART;
                    albumCell.append(noArt);
                }
                const info = el("div", "albumInfo");
                for (const line of block.lines) info.append(el("div", "", line));
                albumCell.append(info);
            }
            blockEl.append(albumCell);

            block.items.forEach((item, i) => blockEl.append(makeRow(item, block.items, i)));
            visibleItems.push(...block.items.filter((it) => it.kind === "audio" || it.kind === "video"));
            groupEl.append(blockEl);
        }
        listArea.append(groupEl);
    }

    hideMessage();
    markPlayingRow();
    readLengths([...rowOf.keys()]);
}

function renderPictures(items) {
    listArea.replaceChildren();
    rowOf.clear();
    visibleItems = [];

    const grid = el("div", "thumbGrid");
    for (const item of items) {
        const tile = el("div", "thumb");
        const img = el("img");
        img.src = item.url;
        img.alt = "";
        img.loading = "lazy";
        tile.append(img, el("span", "", item.title));
        tile.addEventListener("click", () => selectRow(tile));
        tile.addEventListener("dblclick", () => openPicture(item));
        grid.append(tile);
    }
    listArea.append(grid);
    hideMessage();
}

// ----- turning data into groups -----

function albumBlock(album) {
    return { showAlbum: true, cover: album.cover, lines: [album.name, album.artist], items: album.tracks };
}

function groupByArtist(albums) {
    const groups = [];
    for (const album of albums) {
        const last = groups[groups.length - 1];
        if (last && last.header === album.artist) last.blocks.push(albumBlock(album));
        else groups.push({ header: album.artist, blocks: [albumBlock(album)] });
    }
    return groups;
}

function groupByAlbum(albums) {
    return albums.map((album) => ({ header: album.name, blocks: [albumBlock(album)] }));
}

function flatGroup(header, items) {
    return [{ header, blocks: [{ showAlbum: false, items }] }];
}

// search box: keep only matching tracks, drop empty albums/groups
function applySearch(groups) {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) return groups;
    const hit = (item) => [item.title, item.artist, item.album, item.fileName].some((t) => t && t.toLowerCase().includes(q));
    return groups
        .map((g) => ({
            ...g,
            blocks: g.blocks.map((b) => ({ ...b, items: b.items.filter(hit) })).filter((b) => b.items.length),
        }))
        .filter((g) => g.blocks.length);
}

// =====================================================================
// Views + navigation
// =====================================================================

const VIEWS = {
    library:   { crumbs: ["Library"],                         load: async () => flatGroup("Library", (await loadFlat("library")).filter((i) => i.kind === "audio" || i.kind === "video")) },
    playlists: { crumbs: ["Library", "Playlists"],            load: async () => flatGroup("Playlists", (await loadFlat("playlists")).filter((i) => i.kind === "playlist")) },
    music:     { crumbs: ["Library", "Music", "All music"],   load: async () => groupByArtist(await loadMusic()) },
    artist:    { crumbs: ["Library", "Music", "Artist"],      load: async () => groupByArtist(await loadMusic()) },
    album:     { crumbs: ["Library", "Music", "Album"],       load: async () => groupByAlbum(await loadMusic()) },
    genre:     { crumbs: ["Library", "Music", "Genre"],       load: async () => [{ header: "Unknown Genre", blocks: (await loadMusic()).map(albumBlock) }] },
    videos:    { crumbs: ["Library", "Videos", "All videos"], load: async () => flatGroup("Videos", (await loadFlat("videos")).filter((i) => i.kind === "video")) },
    pictures:  { crumbs: ["Library", "Pictures", "All pictures"], pictures: true },
};

let current = null;
const history = [];
const future = [];
let loadToken = 0;

function setBreadcrumb(crumbs) {
    breadcrumb.replaceChildren();
    for (const name of crumbs) {
        breadcrumb.insertAdjacentHTML("beforeend", CRUMB_SEP);
        breadcrumb.append(el("span", "crumb", name));
    }
}

function setSelectedNav(viewName) {
    document.querySelectorAll(".treeItem[data-view]").forEach((btn) => {
        btn.classList.toggle("selected", btn.dataset.view === viewName);
    });
}

async function show(state) {
    const token = ++loadToken;
    closeOverlays();

    if (state.playlist) {
        setBreadcrumb(["Library", "Playlists", state.playlist.title]);
        setSelectedNav("playlists");
    } else {
        setBreadcrumb(VIEWS[state.view].crumbs);
        setSelectedNav(state.view === "music" ? "music" : state.view);
    }

    backBtn.disabled = history.length === 0;
    forwardBtn.disabled = future.length === 0;

    showMessage("Loading…");
    try {
        if (state.playlist) {
            const items = await loadPlaylist(state.playlist);
            if (token !== loadToken) return;
            const groups = applySearch(flatGroup(state.playlist.title, items));
            groups.length ? renderGroups(groups) : showMessage("This playlist is empty.");
        } else if (VIEWS[state.view].pictures) {
            const items = (await loadFlat("pictures")).filter((i) => i.kind === "image");
            if (token !== loadToken) return;
            const q = searchInput.value.trim().toLowerCase();
            const shown = q ? items.filter((i) => i.title.toLowerCase().includes(q)) : items;
            shown.length ? renderPictures(shown) : showMessage("There are no items in Pictures.");
        } else {
            const groups = applySearch(await VIEWS[state.view].load());
            if (token !== loadToken) return;
            if (groups.length) renderGroups(groups);
            else showMessage(searchInput.value.trim() ? "No items match your search." : "There are no items in this library.");
        }
    } catch (err) {
        if (token !== loadToken) return;
        showMessage("Windows Media Player couldn't load your media library.", err.message);
    }
}

function navigate(state) {
    if (current) history.push(current);
    future.length = 0;
    current = state;
    show(current);
}

function openPlaylist(playlistItem) {
    navigate({ playlist: playlistItem });
}

backBtn.addEventListener("click", () => {
    if (!history.length) return;
    future.push(current);
    current = history.pop();
    show(current);
});

forwardBtn.addEventListener("click", () => {
    if (!future.length) return;
    history.push(current);
    current = future.pop();
    show(current);
});

document.querySelectorAll(".treeItem[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => navigate({ view: btn.dataset.view }));
});

searchInput.addEventListener("input", () => show(current));

// =====================================================================
// Reading track lengths (a few at a time, only for what's on screen)
// =====================================================================

const lengthQueue = [];
let lengthsRunning = 0;

function readLengths(items) {
    for (const item of items) {
        if (item.duration == null && !item.lengthQueued && (item.kind === "audio" || item.kind === "video")) {
            item.lengthQueued = true;
            lengthQueue.push(item);
        }
    }
    pumpLengths();
}

function pumpLengths() {
    while (lengthsRunning < CONFIG.lengthRequestsAtOnce && lengthQueue.length) {
        const item = lengthQueue.shift();
        lengthsRunning++;

        const probe = document.createElement(item.kind === "video" ? "video" : "audio");
        probe.preload = "metadata";
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            probe.removeAttribute("src");
            probe.load();          // stops the download
            lengthsRunning--;
            pumpLengths();
        };
        probe.addEventListener("loadedmetadata", () => {
            item.duration = probe.duration;
            const cell = rowOf.get(item)?.querySelector(".cLen");
            if (cell) cell.textContent = formatTime(item.duration);
            finish();
        });
        probe.addEventListener("error", finish);
        probe.src = item.url;
    }
}

// =====================================================================
// Playback
// =====================================================================

let queue = [];
let queueIndex = -1;
let shuffleOn = false;
let repeatOn = false;

function playList(list, index) {
    const target = list[index];
    queue = list.filter((it) => it.kind === "audio" || it.kind === "video");
    queueIndex = queue.indexOf(target);
    if (queueIndex >= 0) startCurrent();
}

function startCurrent() {
    const item = queue[queueIndex];
    if (!item) return;

    player.src = item.url;
    player.play().catch(() => {});

    nowText.textContent = item.artist ? `${item.title} - ${item.artist}` : item.title;
    nowThumb.src = item.cover || "/icons/mediaPlayer.png";

    const isVid = item.kind === "video";
    videoStage.hidden = !isVid;
    contentPane.classList.toggle("covered", isVid);
    if (isVid) contentPane.scrollTop = 0;

    markPlayingRow();
}

function markPlayingRow() {
    document.querySelectorAll(".trackRow.playing").forEach((r) => r.classList.remove("playing"));
    const item = queue[queueIndex];
    if (item) rowOf.get(item)?.classList.add("playing");
}

function stop() {
    player.pause();
    player.currentTime = 0;
    videoStage.hidden = true;
    contentPane.classList.remove("covered");
}

function next(fromEnded = false) {
    if (!queue.length) return;
    if (shuffleOn && queue.length > 1) {
        let n;
        do { n = Math.floor(Math.random() * queue.length); } while (n === queueIndex);
        queueIndex = n;
    } else if (queueIndex + 1 < queue.length) {
        queueIndex++;
    } else if (repeatOn) {
        queueIndex = 0;
    } else {
        if (fromEnded) stop();
        return;
    }
    startCurrent();
}

function prev() {
    if (!queue.length) return;
    if (player.currentTime > 3) {
        player.currentTime = 0;     // like WMP: first press restarts the song
        return;
    }
    queueIndex = Math.max(0, queueIndex - 1);
    startCurrent();
}

playBtn.addEventListener("click", () => {
    if (!player.getAttribute("src")) {
        // nothing loaded yet: play the selected row, or everything on screen
        if (visibleItems.length) playList(visibleItems, 0);
        return;
    }
    if (player.paused) player.play().catch(() => {});
    else player.pause();
});

$("stopBtn").addEventListener("click", stop);
$("nextBtn").addEventListener("click", () => next());
$("prevBtn").addEventListener("click", prev);
player.addEventListener("ended", () => next(true));

shuffleBtn.addEventListener("click", () => {
    shuffleOn = !shuffleOn;
    shuffleBtn.classList.toggle("on", shuffleOn);
    shuffleBtn.setAttribute("aria-label", shuffleOn ? "Turn shuffle off" : "Turn shuffle on");
});

repeatBtn.addEventListener("click", () => {
    repeatOn = !repeatOn;
    repeatBtn.classList.toggle("on", repeatOn);
    repeatBtn.setAttribute("aria-label", repeatOn ? "Turn repeat off" : "Turn repeat on");
});

muteBtn.addEventListener("click", () => {
    player.muted = !player.muted;
});

volume.addEventListener("input", () => {
    player.volume = Number(volume.value);
    if (player.muted && player.volume > 0) player.muted = false;
});
player.volume = Number(volume.value);

player.addEventListener("volumechange", () => {
    muteBtn.classList.toggle("muted", player.muted || player.volume === 0);
    muteBtn.setAttribute("aria-label", player.muted ? "Sound" : "Mute");
});

player.addEventListener("play", () => {
    playBtn.classList.add("isPlaying");
    playBtn.setAttribute("aria-label", "Pause");
});

player.addEventListener("pause", () => {
    playBtn.classList.remove("isPlaying");
    playBtn.setAttribute("aria-label", "Play");
});

player.addEventListener("timeupdate", () => {
    timeText.textContent = formatClock(player.currentTime);
    const pct = player.duration ? (player.currentTime / player.duration) * 100 : 0;
    seekFill.style.width = pct + "%";
    seekThumb.style.left = pct + "%";
});

// seek bar: click or drag
function seekTo(event) {
    if (!player.duration) return;
    const box = seekBar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    player.currentTime = ratio * player.duration;
}

seekBar.addEventListener("pointerdown", (event) => {
    seekBar.setPointerCapture(event.pointerId);
    seekTo(event);
});

seekBar.addEventListener("pointermove", (event) => {
    if (seekBar.hasPointerCapture(event.pointerId)) seekTo(event);
});

// =====================================================================
// Video stage + picture viewer
// =====================================================================

function openPicture(item) {
    pictureImg.src = item.url;
    pictureViewer.hidden = false;
    contentPane.classList.add("covered");
    contentPane.scrollTop = 0;
}

function closeOverlays() {
    pictureViewer.hidden = true;
    videoStage.hidden = true;
    contentPane.classList.remove("covered");
}

pictureViewer.addEventListener("click", closeOverlays);
$("stageClose").addEventListener("click", closeOverlays);   // video keeps playing, like WMP

// =====================================================================
// Start
// =====================================================================

navigate({ view: "music" });
