/* colour names come from style.css, so they change with the theme */
const PALETTE = ["var(--red)", "var(--blue)", "var(--yellow)", "var(--mint)", "var(--pink)"];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;      // phones / tablets: no mouse trail or cursor parallax
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || connection?.saveData
    || /(^|-)2g$/.test(connection?.effectiveType || "");
const SMOOTH = reduce ? "auto" : "smooth";
/* readable text colour on each sticker colour (blue needs white in the light theme) */
const fgFor = c => (c === PALETTE[1] ? "var(--fg-blue)" : "var(--deep)");
const gallery = document.getElementById("gallery");
const root = document.documentElement;
if (lowPower) root.classList.add("low-power");
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* ---------- hidden sketchbook glitch ---------- */
(() => {
    const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    let position = 0;

    addEventListener("keydown", event => {
        const target = event.target;
        if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) {
            position = 0;
            return;
        }

        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        position = key === code[position] ? position + 1 : key === code[0] ? 1 : 0;
        if (position !== code.length) return;
        if (root.classList.contains("easter-egg")) { position = 0; return; }

        root.classList.add("easter-egg");
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#050506");
        const staticLayer = document.createElement("div");
        staticLayer.className = "easter-static";
        staticLayer.setAttribute("aria-hidden", "true");
        document.body.append(staticLayer);
        const warning = document.createElement("p");
        warning.className = "easter-warning";
        warning.setAttribute("role", "status");
        warning.textContent = "SIGNAL LOST";
        document.body.append(warning);

        const debris = document.createElement("div");
        debris.className = "easter-debris";
        debris.setAttribute("aria-hidden", "true");

        const popup = document.createElement("div");
        popup.className = "easter-popup";
        const popupBar = document.createElement("div");
        popupBar.className = "easter-popup-bar";
        popupBar.textContent = "IMPORTANT SYSTEM MESSAGE";
        const popupCopy = document.createElement("p");
        popupCopy.textContent = "Your spoon has been moved to another room.";
        const popupActions = document.createElement("div");
        popupActions.className = "easter-popup-actions";
        ["OK?", "WHERE"].forEach(label => {
            const action = document.createElement("span");
            action.textContent = label;
            popupActions.append(action);
        });
        popup.append(popupBar, popupCopy, popupActions);
        debris.append(popup);

        [
            ["easter-object easter-spoon", "🥄", "NOT FROM THIS KITCHEN"],
            ["easter-object easter-room", "ROOM 0", "you are already here"],
            ["easter-object easter-loading", "PLEASE WAIT", "████░░░░░░ 4%"],
            ["easter-object easter-tab", "untitled (final) (2)", "×"],
            ["easter-object easter-viewers", "LIVE VIEWERS: 0", "1"]
        ].forEach(([className, heading, detail]) => {
            const object = document.createElement("div");
            object.className = className;
            const title = document.createElement("span");
            title.textContent = heading;
            const note = document.createElement("small");
            note.textContent = detail;
            object.append(title, note);
            debris.append(object);
        });
        document.body.append(debris);
        position = 0;
    });
})();

/* ---------- wobbly title: every letter jumps when you hover it ---------- */
const h1 = document.querySelector(".hero h1");
h1.setAttribute("aria-label", h1.textContent.trim());
(function split(node) {
    [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
            const f = document.createDocumentFragment();
            [...n.textContent].forEach(ch => {
                if (ch === " ") { f.append(" "); return; }
                const b = document.createElement("b");
                b.className = "ch"; b.textContent = ch; b.setAttribute("aria-hidden", "true");
                f.append(b);
            });
            n.replaceWith(f);
        } else if (n.nodeType === 1) split(n);
    });
})(h1);
h1.addEventListener("pointerover", e => {
    const c = e.target.closest(".ch");
    if (!c || c.classList.contains("jig")) return;
    c.style.setProperty("--jr", rand(-18, 18).toFixed(0) + "deg");
    c.classList.add("jig");
    c.addEventListener("animationend", () => c.classList.remove("jig"), { once: true });
});

/* ---------- the wall ---------- */
const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.remove("pre"); io.unobserve(e.target); }
    });
}, { threshold: .12 });

function gradient(c = ["#ccc", "#999"]) {
    return `linear-gradient(135deg, ${c[0]}, ${c[1] || c[0]})`;
}

const norm = d => {
    if (!d) return null;
    const [y, m = "01", dd = "01"] = String(d).split("-");
    return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${dd.padStart(2, "0")}`;
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = d => {
    if (!d) return "";
    const [y, m, dd] = String(d).split("-");
    return [dd && +dd, m && MONTHS[m - 1], y].filter(Boolean).join(" ");
};

/* ---------- piece type: OC / Fanart (set "kind" and "subject" in descriptions.json) ---------- */
const KIND_ALIASES = { oc: "OC", original: "OC", "original character": "OC", fanart: "Fanart", "fan art": "Fanart", fa: "Fanart" };
const normKind = k => { const t = String(k || "").trim(); return t ? (KIND_ALIASES[t.toLowerCase()] || t) : ""; };
const kindClass = k => (k === "OC" ? "kind-oc" : k === "Fanart" ? "kind-fanart" : "kind-other");

/* ---------- favourites (hearts) + "new" ribbon ---------- */
const NEW_DAYS = 30;                    // pieces dated within this many days get the NEW ribbon
const isNew = key => {
    if (!key) return false;
    const days = (Date.now() - new Date(key + "T00:00:00").getTime()) / 864e5;
    return days >= -1 && days <= NEW_DAYS;
};
const FAV = "\u2665";
// The same Set is updated by likes.js after authentication and database changes.
const favs = window.ArtworkLikes?.likedSlugs || new Set();
const HEART = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 85 C10 55 12 20 33 20 C43 20 50 28 50 34 C50 28 57 20 67 20 C88 20 90 55 50 85 Z"/></svg>';
const favLabel = () => `${FAV} My likes${favs.size ? " (" + favs.size + ")" : ""}`;

function toggleFav(art) {
    if (window.ArtworkLikes?.enabled) window.ArtworkLikes.toggle(art);
    else window.ArtworkLikes?.showSetupMessage();
}

artworks.forEach((art, i) => {
    art.i = i;
    art.slug = (art.title || "piece").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "piece";
    if (artworks.slice(0, i).some(a => a.slug === art.slug)) art.slug += "-" + (i + 1);   // keep every link unique
    art.mediums = (Array.isArray(art.medium) ? art.medium : String(art.medium || "Art").split(","))
        .map(m => m.trim()).filter(Boolean);
    if (!art.mediums.length) art.mediums = ["Art"];
    art.kind = normKind(art.kind);
    art.subject = String(art.subject || "").trim();
    art.date = art.date || (art.year ? String(art.year) : "");
    art.key = norm(art.date);
    art.isNew = isNew(art.key);
    art.hay = [art.title, art.description, art.mediums.join(" "), art.kind, art.subject, fmt(art.date), art.date].join(" ").toLowerCase() + (art.isNew ? " new" : "");
    const card = document.createElement("div");
    card.className = "card pre";
    card.style.setProperty("--r", rand(-4, 4).toFixed(1) + "deg");
    card.style.setProperty("--tape", rand(-8, 8).toFixed(1) + "deg");
    card.style.setProperty("--tapec", pick(PALETTE));
    const stk = pick(PALETTE);
    card.style.setProperty("--stk", stk);
    card.style.setProperty("--stk-fg", fgFor(stk));
    card.style.setProperty("--ratio", art.ratio || "4/5");
    card.style.setProperty("--fx", pick(["-80px", "0px", "80px"]));
    card.style.setProperty("--fy", pick(["60px", "90px"]));
    card.style.setProperty("--fallback", gradient(art.colors));

    const artFrame = document.createElement("div");
    artFrame.className = "art-frame is-loading";
    const img = new Image();
    img.className = "art";
    img.alt = art.title;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("load", () => {
        artFrame.classList.remove("is-loading");
        artFrame.classList.add("is-loaded");
    }, { once: true });
    img.addEventListener("error", () => {
        artFrame.classList.remove("is-loading");
        artFrame.classList.remove("is-loaded");
        artFrame.classList.add("is-missing");
        img.remove();
    }, { once: true });
    img.src = art.thumb || art.image;
    if (img.complete) {
        if (img.naturalWidth) {
            artFrame.classList.remove("is-loading");
            artFrame.classList.add("is-loaded");
        } else {
            artFrame.classList.remove("is-loading");
            artFrame.classList.add("is-missing");
            img.remove();
        }
    }
    artFrame.append(img);

    const open = document.createElement("button");
    open.type = "button"; open.className = "card-open";
    open.setAttribute("aria-label", `Open ${art.title}`);
    open.append(artFrame);
    card.append(open);
    open.insertAdjacentHTML("beforeend",
        `<span class="sticker">${art.mediums.slice(0, 2).join(" + ")}${art.mediums.length > 2 ? " +" + (art.mediums.length - 2) : ""}</span>
        <h3>${art.title}</h3>
        <p class="note">${fmt(art.date)}${art.kind ? ` <span class="kind ${kindClass(art.kind)}">${art.kind}</span>` : ""}</p>`);
    card.insertAdjacentHTML("beforeend",
        `<button type="button" class="heart" aria-label="Like ${art.title}">${HEART}<span class="like-count" data-like-count>0</span></button>
        ${art.isNew ? '<span class="corner" aria-hidden="true"><span class="ribbon">NEW!</span></span>' : ""}`);

    const heart = card.querySelector(".heart");
    art.heart = heart;
    heart.setAttribute("aria-label", "Like " + art.title);
    heart.setAttribute("aria-pressed", favs.has(art.slug));
    heart.classList.toggle("on", favs.has(art.slug));
    window.ArtworkLikes?.register(art, heart);
    heart.addEventListener("click", () => toggleFav(art));

    art.card = card; art.img = img;
    open.addEventListener("click", () => openLightbox(art));
    io.observe(card);
});

/* ---------- sorting + layout (cards read left to right in sorted order) ---------- */
const byDate = dir => (a, b) => {
    if (!a.key && !b.key) return a.i - b.i;
    if (!a.key) return 1;            // undated pieces always go last
    if (!b.key) return -1;
    return a.key === b.key ? a.i - b.i : (a.key < b.key ? -1 : 1) * dir;
};
const SORTS = {
    new: byDate(-1),
    old: byDate(1),
    az: (a, b) => a.title.localeCompare(b.title),
    listed: (a, b) => a.i - b.i
};
const sortSel = document.getElementById("sort");
let order = [...artworks].sort(SORTS[sortSel.value]);

// Masonry is the default; grid mode and the mobile column preference persist locally.
let compact = true;
try {
    const savedGrid = localStorage.getItem("art-compact-v2");
    if (savedGrid !== null) compact = savedGrid === "1";
} catch { }
let layoutMode = "masonry";
try {
    const savedMode = localStorage.getItem("art-layout-v1");
    if (savedMode === "grid" || savedMode === "masonry") layoutMode = savedMode;
} catch { }
const colCount = () => (innerWidth < 600 ? (compact ? 2 : 1) : Math.max(1, Math.min(5, Math.floor(innerWidth * .9 / 340))));
const aspect = r => { const [w, h] = String(r || "4/5").split("/").map(Number); return w / (h || 1) || .8; };
let cn = colCount();
const PAGE = 36;                       // cards added each time you scroll near the bottom
let list = [], placed = 0, cols = [], hts = [];

/* extra controls are built here, so index.html stays pleasantly simple */
const toolbar = document.querySelector(".toolbar");
const settingsPanel = document.createElement("section");
settingsPanel.id = "settings-panel";
settingsPanel.className = "settings-panel";
settingsPanel.hidden = true;
settingsPanel.setAttribute("aria-label", "Settings and tools");
const settingsToggle = document.createElement("button");
settingsToggle.type = "button";
settingsToggle.className = "settings-toggle";
settingsToggle.textContent = "settings";
settingsToggle.setAttribute("aria-controls", settingsPanel.id);
settingsToggle.setAttribute("aria-expanded", "false");

const makeSettingsSection = (label, className = "") => {
    const section = document.createElement("section");
    section.className = `settings-section${className ? ` ${className}` : ""}`;
    section.setAttribute("aria-label", label);
    const heading = document.createElement("h2");
    heading.textContent = label;
    section.append(heading);
    return section;
};
const layoutSection = makeSettingsSection("Gallery layout");
const appearanceSection = makeSettingsSection("Appearance");
const toolsSection = makeSettingsSection("Gallery tools");
const accountSection = makeSettingsSection("Account");
accountSection.hidden = true;
settingsPanel.append(layoutSection, appearanceSection, toolsSection, accountSection);
document.body.append(settingsPanel, settingsToggle);

function closeSettings(returnFocus = false) {
    settingsPanel.hidden = true;
    settingsToggle.setAttribute("aria-expanded", "false");
    if (returnFocus) settingsToggle.focus();
}
settingsToggle.addEventListener("click", () => {
    const opening = settingsPanel.hidden;
    settingsPanel.hidden = !opening;
    settingsToggle.setAttribute("aria-expanded", String(opening));
    if (opening) settingsPanel.querySelector("button")?.focus();
});
document.addEventListener("pointerdown", event => {
    if (!settingsPanel.hidden && !settingsPanel.contains(event.target) && event.target !== settingsToggle) closeSettings();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !settingsPanel.hidden) closeSettings(true);
});

const authTrigger = document.getElementById("likes-auth-trigger");
const authHome = authTrigger?.parentElement;
window.addEventListener("artwork-auth-changed", event => {
    if (!authTrigger || !authHome) return;
    const signedIn = event.detail?.signedIn === true;
    (signedIn ? accountSection : authHome).append(authTrigger);
    accountSection.hidden = !signedIn;
});

const search = document.createElement("input");
search.type = "search"; search.className = "search"; search.placeholder = "search...";
search.setAttribute("aria-label", "Search artworks");
toolbar.prepend(search);

const viewControls = document.createElement("div");
viewControls.className = "view-controls";
viewControls.setAttribute("role", "group");
viewControls.setAttribute("aria-label", "Gallery layout");
const masonryBtn = document.createElement("button");
masonryBtn.type = "button"; masonryBtn.className = "mode-btn"; masonryBtn.textContent = "masonry";
const gridBtn = document.createElement("button");
gridBtn.type = "button"; gridBtn.className = "mode-btn"; gridBtn.textContent = "grid";
viewControls.append(masonryBtn, gridBtn);
layoutSection.append(viewControls);
function syncView() {
    masonryBtn.classList.toggle("on", layoutMode === "masonry");
    gridBtn.classList.toggle("on", layoutMode === "grid");
    masonryBtn.setAttribute("aria-pressed", String(layoutMode === "masonry"));
    gridBtn.setAttribute("aria-pressed", String(layoutMode === "grid"));
}
syncView();
masonryBtn.addEventListener("click", () => setLayoutMode("masonry"));
gridBtn.addEventListener("click", () => setLayoutMode("grid"));

// Keep the existing one/two-column preference for narrow screens.
const viewBtn = document.createElement("button");
viewBtn.type = "button"; viewBtn.className = "view-btn";
const syncMobileColumns = () => {
    viewBtn.textContent = `columns: ${compact ? 2 : 1}`;
    viewBtn.setAttribute("aria-label", `Use ${compact ? 1 : 2} column${compact ? "" : "s"} on small screens`);
    viewBtn.setAttribute("aria-pressed", String(compact));
};
syncMobileColumns();
viewBtn.addEventListener("click", () => {
    compact = !compact;
    try { localStorage.setItem("art-compact-v2", compact ? "1" : "0"); } catch { }
    syncMobileColumns(); cn = colCount(); layout();
});
layoutSection.append(viewBtn);

const surpriseBtn = document.createElement("button");
surpriseBtn.type = "button"; surpriseBtn.className = "surprise-btn";
surpriseBtn.textContent = "🎲 surprise me";
surpriseBtn.setAttribute("aria-label", "Open a random artwork from the current results");
let lastSurprise = null;
surpriseBtn.addEventListener("click", () => {
    if (!list.length) return;
    let choices = list;
    if (choices.length > 1 && lastSurprise) choices = choices.filter(a => a !== lastSurprise);
    const art = pick(choices);
    lastSurprise = art;
    // Open directly without forcing the lazy-loaded gallery to render every card before it.
    openLightbox(art);
});
toolsSection.append(surpriseBtn);

const filterSummary = document.createElement("section");
filterSummary.className = "filter-summary";
filterSummary.setAttribute("aria-label", "Current gallery results and filters");
filterSummary.innerHTML = `
    <p class="filter-result-count" aria-live="polite"></p>
    <div class="active-filter-tags" aria-label="Active filters"></div>
    <button class="clear-filters" type="button" hidden>clear filters ×</button>`;
const filterResultCount = filterSummary.querySelector(".filter-result-count");
const activeFilterTags = filterSummary.querySelector(".active-filter-tags");
const clearFiltersBtn = filterSummary.querySelector(".clear-filters");

const years = document.createElement("nav");
years.className = "years"; years.setAttribute("aria-label", "Jump to year");
toolbar.after(filterSummary, years);
const empty = document.createElement("p");
empty.className = "empty"; empty.hidden = true;
empty.textContent = "nothing in here... :( like a few artworks and they will show up here.";
gallery.after(empty);
const status = document.createElement("p");          // read out by screen readers when filters change
status.className = "sr-only"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
gallery.after(status);
const more = document.createElement("div");
more.className = "more";
empty.after(more);
const foot = document.createElement("footer");
foot.className = "foot"; foot.hidden = true;
foot.innerHTML = `<svg class="squiggle" viewBox="0 0 300 20" aria-hidden="true"><path d="M3 12 Q 20 0 38 12 T 75 12 T 112 12 T 150 12 T 187 12 T 225 12 T 262 12 T 297 12" /></svg>
    <p>that's the whole wall. thanks for poking around!</p><button class="top">back to top</button>`;
foot.querySelector(".top").addEventListener("click", () => scrollTo({ top: 0, behavior: SMOOTH }));
more.after(foot);

const moreIO = new IntersectionObserver(es => {
    if (es[0].isIntersecting && placed < list.length) { place(PAGE); kick(); }
}, { rootMargin: "900px" });
const kick = () => { moreIO.unobserve(more); moreIO.observe(more); };

function place(n) {
    list.slice(placed, placed + n).forEach(a => {
        if (layoutMode === "grid") {
            cols[0].append(a.card);               // CSS grid flattens this single track into uniform rows
        } else {
            const k = hts.indexOf(Math.min(...hts)); // drop each card into the shortest masonry column
            cols[k].append(a.card);
            hts[k] += 1 / aspect(a.ratio) + .45;
        }
    });
    placed = Math.min(list.length, placed + n);
    foot.hidden = !list.length || placed < list.length;
}

function layout() {
    gallery.classList.toggle("compact", innerWidth < 600 && compact);
    gallery.classList.toggle("grid-view", layoutMode === "grid");
    list = order.filter(a => !a.card.hidden);
    gallery.replaceChildren();
    const columnTotal = layoutMode === "grid" ? 1 : cn;
    cols = Array.from({ length: columnTotal }, () => {
        const c = document.createElement("div");
        c.className = "col";
        gallery.append(c);
        return c;
    });
    hts = Array(columnTotal).fill(0);
    placed = 0;
    place(PAGE);
    empty.hidden = list.length > 0;
    empty.textContent = list.length ? "" : "Nothing matches those filters... try clearing a filter or changing your search. ♡";
    if (status.dataset.ready) status.textContent = list.length ? `${list.length} pieces shown` : "No pieces found";
    buildYears();
    updateFilterUI();
    kick();
}

function setLayoutMode(mode) {
    if (mode !== "masonry" && mode !== "grid") return;
    if (layoutMode === mode) return;
    layoutMode = mode;
    try { localStorage.setItem("art-layout-v1", mode); } catch { }
    syncView();
    layout();
}


/* ---------- year jump buttons (only when sorted by date) ---------- */
function buildYears() {
    years.replaceChildren();
    const dated = sortSel.value === "new" || sortSel.value === "old";
    const ys = dated ? [...new Set(list.filter(a => a.key).map(a => a.key.slice(0, 4)))] : [];
    years.hidden = ys.length < 2;
    ys.forEach((y, i) => {
        const b = document.createElement("button");
        b.className = "yr"; b.textContent = y;
        b.style.setProperty("--c", PALETTE[i % PALETTE.length]);
        b.style.setProperty("--fg", fgFor(PALETTE[i % PALETTE.length]));
        b.addEventListener("click", () => jump(y));
        years.append(b);
    });
}
function jump(y) {
    const idx = list.findIndex(a => a.key && a.key.startsWith(y));
    if (idx < 0) return;
    if (idx >= placed) { place(idx - placed + 1); kick(); }
    list[idx].card.classList.remove("pre");
    list[idx].card.scrollIntoView({ behavior: SMOOTH, block: "start" });
}

sortSel.addEventListener("change", () => {
    order = [...artworks].sort(SORTS[sortSel.value]);
    layout();
});
addEventListener("resize", () => { const n = colCount(); if (n !== cn) { cn = n; layout(); } });

/* ---------- filter chips + search ---------- */
const activeMediums = new Set();
let activeLikes = false, activeKind = "", query = "";
const mediumButtons = new Map();
const kindButtons = new Map();
const queryWords = () => query.toLowerCase().split(/\s+/).filter(Boolean);

function matchesMedium(art, mediumFilter = { mediums: activeMediums, likes: activeLikes }) {
    if (mediumFilter.likes) return favs.has(art.slug);
    return !mediumFilter.mediums.size || [...mediumFilter.mediums].some(medium => art.mediums.includes(medium));
}

function countMatches(mediumFilter = { mediums: activeMediums, likes: activeLikes }, kindChoice = activeKind) {
    const words = queryWords();
    return artworks.filter(a => {
        const okMedium = matchesMedium(a, mediumFilter);
        const okKind = !kindChoice || a.kind === kindChoice;
        return okMedium && okKind && words.every(w => a.hay.includes(w));
    }).length;
}

function syncFilterButtons() {
    mediumButtons.forEach((button, medium) => {
        const selected = medium === "All"
            ? !activeMediums.size && !activeLikes
            : medium === FAV ? activeLikes : activeMediums.has(medium);
        button.classList.toggle("on", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
    kindButtons.forEach((button, kind) => {
        const selected = activeKind === kind;
        button.classList.toggle("on", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
}

function addActiveTag(label, onRemove) {
    const tag = document.createElement("button");
    tag.type = "button";
    tag.className = "active-filter-tag";
    tag.textContent = `${label} ×`;
    tag.addEventListener("click", onRemove);
    activeFilterTags.append(tag);
}

function updateFilterUI() {
    // Medium counts reflect adding that medium; type counts respect all active filters.
    mediumButtons.forEach((button, medium) => {
        const filter = medium === "All"
            ? { mediums: new Set(), likes: false }
            : medium === FAV
                ? { mediums: new Set(), likes: true }
                : { mediums: new Set([...activeMediums, medium]), likes: false };
        const count = countMatches(filter, activeKind);
        button.textContent = medium === FAV ? `${FAV} My likes (${count})` : `${medium} (${count})`;
    });
    kindButtons.forEach((button, kind) => {
        const count = countMatches({ mediums: activeMediums, likes: activeLikes }, kind);
        button.textContent = kind ? `${kind} (${count})` : `All types (${count})`;
    });

    const filtering = !!activeMediums.size || activeLikes || !!activeKind || !!query.trim();
    filterResultCount.textContent = filtering
        ? `Showing ${list.length} of ${artworks.length} artworks`
        : `${artworks.length} in total. a lot more surprises coming very soon!`;
    activeFilterTags.replaceChildren();
    activeMediums.forEach(medium => addActiveTag(`Medium: ${medium}`, () => {
        activeMediums.delete(medium); syncFilterButtons(); applyFilters(false);
    }));
    if (activeLikes) addActiveTag("My likes", () => {
        activeLikes = false; syncFilterButtons(); applyFilters(false);
    });
    if (activeKind) addActiveTag(`Type: ${activeKind}`, () => {
        activeKind = ""; syncFilterButtons(); applyFilters(false);
    });
    if (query.trim()) addActiveTag(`Search: ${query.trim()}`, () => {
        clearTimeout(typing); query = ""; search.value = ""; applyFilters(false);
    });
    clearFiltersBtn.hidden = !filtering;
    surpriseBtn.disabled = !list.length;
}

clearFiltersBtn.addEventListener("click", () => {
    clearTimeout(typing);
    activeMediums.clear();
    activeLikes = false;
    activeKind = "";
    query = "";
    search.value = "";
    syncFilterButtons();
    applyFilters(false);
});

function applyFilters(animate) {
    const words = queryWords();
    artworks.forEach(a => {
        const okMedium = matchesMedium(a);
        const okKind = !activeKind || a.kind === activeKind;
        a.card.hidden = !(okMedium && okKind && words.every(w => a.hay.includes(w)));
    });
    layout();
    if (animate) list.slice(0, placed).forEach(a => {
        a.card.classList.remove("shuffle"); void a.card.offsetWidth; a.card.classList.add("shuffle");
    });
}

let typing;
search.addEventListener("input", () => {
    clearTimeout(typing);
    typing = setTimeout(() => { query = search.value; applyFilters(false); }, 160);
});

const nav = document.getElementById("filters");
const mediums = ["All", ...new Set(artworks.flatMap(a => a.mediums))];
nav.hidden = mediums.length < 3;
[mediums[0], FAV, ...mediums.slice(1)].forEach((m, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (i ? "" : " on");
    b.textContent = m === FAV ? favLabel() : m;
    b.setAttribute("aria-pressed", i === 0);
    b.style.setProperty("--c", PALETTE[(i + 4) % PALETTE.length]);
    b.style.setProperty("--fg", fgFor(PALETTE[(i + 4) % PALETTE.length]));
    b.style.setProperty("--cr", rand(-3, 3).toFixed(1) + "deg");
    b.addEventListener("click", () => {
        if (m === "All") {
            activeMediums.clear();
            activeLikes = false;
        } else if (m === FAV) {
            activeMediums.clear();
            activeLikes = !activeLikes;
        } else {
            activeLikes = false;
            if (activeMediums.has(m)) activeMediums.delete(m);
            else activeMediums.add(m);
        }
        syncFilterButtons();
        applyFilters(true);
    });
    mediumButtons.set(m, b);
    nav.append(b);
});

/* type row: All types / OC / Fanart (only appears once some pieces have a type) */
const kindBar = document.createElement("div");
kindBar.className = "kinds"; kindBar.setAttribute("role", "group"); kindBar.setAttribute("aria-label", "Filter by type");
nav.after(kindBar);
const kindNames = [...new Set(artworks.map(a => a.kind).filter(Boolean))]
    .sort((a, b) => (a === "OC" ? -1 : b === "OC" ? 1 : a === "Fanart" ? -1 : b === "Fanart" ? 1 : a.localeCompare(b)));
kindBar.hidden = !kindNames.length;
if (kindNames.length) {
    kindBar.innerHTML = '<span class="lbl">type</span>';
    ["", ...kindNames].forEach((k, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (i ? "" : " on");
        b.textContent = k ? `${k} (${artworks.filter(a => a.kind === k).length})` : "All types";
        b.setAttribute("aria-pressed", i === 0);
        b.style.setProperty("--c", k === "OC" ? "var(--mint)" : k === "Fanart" ? "var(--yellow)" : "var(--pink)");
        b.style.setProperty("--fg", "var(--deep)");
        b.style.setProperty("--cr", rand(-3, 3).toFixed(1) + "deg");
        b.addEventListener("click", () => {
            activeKind = k;
            syncFilterButtons();
            applyFilters(true);
        });
        kindButtons.set(k, b);
        kindBar.append(b);
    });
}
window.addEventListener("artwork-likes-changed", () => {
    artworks.forEach(a => {
        const liked = favs.has(a.slug);
        if (a.heart) {
            a.heart.classList.toggle("on", liked);
            a.heart.setAttribute("aria-pressed", liked);
        }
    });
    if (cur) syncLbHeart();
    if (activeLikes) applyFilters(false);
    else updateFilterUI();
});

layout();
status.dataset.ready = "1";

/* ---------- lightbox: open, prev/next, zoom ---------- */
const lb = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const wrap = lb.querySelector(".imgwrap");
const navBtns = lb.querySelectorAll(".lb-nav");
let lastFocus, cur = null;

const visible = () => order.filter(a => !a.card.hidden);

function show(art) {
    cur = art;
    const hasImg = !!art.img.getAttribute("src");
    wrap.classList.remove("zoomed");
    wrap.setAttribute("aria-pressed", "false");
    lbImg.style.transformOrigin = "";
    lbImg.alt = art.title;
    lbImg.style.setProperty("--fallback", gradient(art.colors));
    lbImg.style.minHeight = hasImg ? "" : "320px";
    if (hasImg) lbImg.src = art.image; else lbImg.removeAttribute("src");
    document.getElementById("lb-title").textContent = art.title;
    lbKind.replaceChildren();
    if (art.kind) { const k = document.createElement("span"); k.className = "kind " + kindClass(art.kind); k.textContent = art.kind; lbKind.append(k); }
    if (art.subject) { const w = document.createElement("span"); w.className = "who"; w.textContent = art.subject; lbKind.append(w); }
    lbKind.hidden = !lbKind.childNodes.length;
    document.getElementById("lb-meta").textContent = [art.mediums.join(", "), fmt(art.date)].filter(Boolean).join(", ");
    document.getElementById("lb-desc").textContent = art.description;
    const list = visible();
    document.getElementById("lb-count").textContent = `${list.indexOf(art) + 1} of ${list.length}`;
    navBtns.forEach(b => (b.hidden = list.length < 2));
    setGlow(art.colors?.[0]);
    syncLbHeart();
    if (hasImg) lbImg.onload = () => { if (cur === art) setGlow(dominantColor(lbImg) || art.colors?.[0]); };
}

let pushed = false;   // did we add a history entry when opening?

function openLightbox(art) {
    lastFocus = document.activeElement;
    show(art);
    lb.hidden = false;
    lb.querySelector(".lb-close").focus();
    history.pushState(null, "", "#" + art.slug);
    pushed = true;
}

function step(d) {
    const list = visible();
    if (list.length < 2) return;
    const next = list[(list.indexOf(cur) + d + list.length) % list.length];
    show(next);
    history.replaceState(null, "", "#" + next.slug);
}

function closeLightbox(fromHistory) {
    lb.hidden = true;
    setGlow(null);
    lastFocus && lastFocus.focus();
    if (fromHistory === true) { pushed = false; return; }
    if (pushed) { pushed = false; history.back(); }
    else history.replaceState(null, "", location.pathname + location.search);
}

/* copy-link button + back button / pasted links */
const lbKind = document.createElement("p");
lbKind.className = "lb-kind hand";
document.getElementById("lb-title").after(lbKind);
const linkBtn = document.createElement("button");
linkBtn.className = "lb-link"; linkBtn.textContent = "copy link";
const lbHeart = document.createElement("button");
lbHeart.className = "lb-heart";
lbHeart.addEventListener("click", () => cur && toggleFav(cur));
const actions = document.createElement("div");
actions.className = "lb-actions";
actions.append(lbHeart, linkBtn);
document.getElementById("lb-count").after(actions);
function syncLbHeart() {
    if (!cur) return;
    const on = favs.has(cur.slug);
    const count = window.ArtworkLikes?.getCount(cur.slug) ?? 0;
    lbHeart.classList.toggle("on", on);
    lbHeart.setAttribute("aria-pressed", on);
    lbHeart.innerHTML = `${HEART}<span data-like-label>${on ? "liked" : "like"}</span><b data-like-count>${count}</b>`;
    window.ArtworkLikes?.register(cur, lbHeart);
}
linkBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); linkBtn.textContent = "copied!"; }
    catch { prompt("Copy this link:", location.href); }
    setTimeout(() => (linkBtn.textContent = "copy link"), 1500);
});

function route() {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (typeof profileRoute === "function" && profileRoute(slug)) return;
    const art = artworks.find(a => a.slug === slug);
    if (art) {
        if (lb.hidden) lastFocus = document.activeElement;
        show(art);
        lb.hidden = false;
    } else if (!lb.hidden) closeLightbox(true);
}
addEventListener("popstate", route);

lb.addEventListener("click", e => {
    const n = e.target.closest(".lb-nav");
    if (n) return step(+n.dataset.dir);
    if (e.target === lb || e.target.closest(".lb-close")) closeLightbox();
});

/* keep Tab inside an open dialog */
function trap(el, e) {
    if (e.key !== "Tab") return;
    const f = [...el.querySelectorAll('button, a[href], input, select, [tabindex]:not([tabindex="-1"])')]
        .filter(x => !x.disabled && !x.hidden && x.getClientRects().length);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

addEventListener("keydown", e => {
    if (lb.hidden) return;
    trap(lb, e);
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
});

/* swipe on phones */
let tx = null, ty = 0;
lb.addEventListener("touchstart", e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
lb.addEventListener("touchend", e => {
    if (tx === null || wrap.classList.contains("zoomed")) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);   // mostly sideways only
    tx = null;
});

/* click the image to zoom, move the pointer to pan */
function aim(e) {
    const r = wrap.getBoundingClientRect();
    lbImg.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
}
wrap.setAttribute("role", "button"); wrap.setAttribute("tabindex", "0");
wrap.setAttribute("aria-label", "Zoom image"); wrap.setAttribute("aria-pressed", "false");
function toggleZoom(e) {
    if (!lbImg.getAttribute("src")) return;
    const r = wrap.getBoundingClientRect();
    const fx = e ? (e.clientX - r.left) / r.width : .5, fy = e ? (e.clientY - r.top) / r.height : .5;
    if (!coarse && e) aim(e);
    const on = wrap.classList.toggle("zoomed");
    wrap.setAttribute("aria-pressed", on);
    if (coarse) {                      // touch: a real scrolling area, so a finger can drag around the zoomed image
        wrap.scrollLeft = 0; wrap.scrollTop = 0;
        if (on) requestAnimationFrame(() => {
            wrap.scrollLeft = fx * wrap.scrollWidth - wrap.clientWidth / 2;
            wrap.scrollTop = fy * wrap.scrollHeight - wrap.clientHeight / 2;
        });
    }
}
wrap.addEventListener("click", e => toggleZoom(e.detail === 0 ? null : e));
wrap.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleZoom(null); } });
wrap.addEventListener("pointermove", e => { if (!coarse && wrap.classList.contains("zoomed")) aim(e); });

/* page glow follows the artwork (needs Live Server for pixel reading) */
function dominantColor(img) {
    try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const x = c.getContext("2d");
        x.drawImage(img, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        let best = null, score = -1;
        for (let i = 0; i < d.length; i += 4) {
            const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
            const s = Math.max(r, g, b) - Math.min(r, g, b);
            if (s > score) { score = s; best = `rgb(${r},${g},${b})`; }
        }
        return score > 20 ? best : null;
    } catch {
        return null;
    }
}

function setGlow(color) {
    if (color) root.style.setProperty("--glow", color); else root.style.removeProperty("--glow");
}

/* ---------- blobs follow the cursor ---------- */
const blobs = [...document.querySelectorAll(".blob")];
if (!reduce && !coarse && !lowPower) {
    addEventListener("pointermove", e => {
        const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
        blobs.forEach((b, i) => {
            const k = (i + 1) * 40;
            b.style.transform = `translate(${nx * k}px, ${ny * k}px)`;
        });
    });
}

/* ---------- paint trail: thicker when you move fast ---------- */
const cv = document.getElementById("trail");
const trailEnabled = !reduce && !coarse && !lowPower;
const ctx = trailEnabled ? cv.getContext("2d") : null;
let hue = 0, last = null;

if (trailEnabled) {
    function fit() { cv.width = innerWidth; cv.height = innerHeight; }
    fit();
    addEventListener("resize", fit);

    let fadeFrame = 0, lastTrailAt = 0;
    function fade() {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,.035)";
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.globalCompositeOperation = "source-over";
        if (performance.now() - lastTrailAt < 1200) {
            fadeFrame = requestAnimationFrame(fade);
        } else {
            ctx.clearRect(0, 0, cv.width, cv.height);
            fadeFrame = 0;
        }
    }

    addEventListener("pointermove", e => {
        hue = (hue + 5) % 360;
        if (last) {
            const d = Math.hypot(e.clientX - last.x, e.clientY - last.y);
            const dark = root.dataset.theme === "dark";
            const h = dark ? 170 + (hue % 150) : 25 + Math.sin(hue * Math.PI / 180) * 18;
            ctx.strokeStyle = `hsl(${h} ${dark ? 100 : 68}% ${dark ? 62 : 52}%)`;
            ctx.lineWidth = Math.min(32, 14 + d * .4);
            ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(e.clientX, e.clientY); ctx.stroke();
        }
        last = { x: e.clientX, y: e.clientY };
        lastTrailAt = performance.now();
        if (!fadeFrame) fadeFrame = requestAnimationFrame(fade);
    });
    document.addEventListener("mouseleave", () => { last = null; });
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) return;
        if (fadeFrame) cancelAnimationFrame(fadeFrame);
        fadeFrame = 0;
        last = null;
        ctx.clearRect(0, 0, cv.width, cv.height);
    });
}

/* ---------- click the walls: splat ---------- */
document.addEventListener("click", e => {
    if (e.target.closest(".card, .lightbox, button, input, select, label, .profile")) return;
    const n = 5;
    for (let i = 0; i < n; i++) {
        const s = document.createElement("i");
        const size = i === 0 ? rand(70, 130) : rand(10, 40);
        const spread = i === 0 ? 0 : rand(40, 110);
        const a = rand(0, Math.PI * 2);
        s.className = "splat";
        s.style.cssText = `left:${e.clientX + Math.cos(a) * spread}px;top:${e.clientY + Math.sin(a) * spread}px;
        width:${size}px;height:${size}px;background:${pick(PALETTE)};`;
        document.body.append(s);
        setTimeout(() => s.remove(), 6000);
    }
});

/* ============ CANVAS DECOR: paint drips, floating doodles ============ */
const SHAPES = {
    star: '<path d="M50 8 L61 38 L93 40 L68 60 L77 92 L50 74 L23 92 L32 60 L7 40 L39 38 Z"/>',
    spiral: '<path d="M50 52 C54 46 62 50 60 58 C57 68 42 66 40 54 C37 38 58 32 68 44 C80 58 68 80 48 80 C26 80 16 58 24 40"/>',
    squiggle: '<path d="M5 50 Q15 25 25 50 T45 50 T65 50 T85 50 T98 50"/>',
    arrow: '<path d="M10 80 C30 20 60 20 85 40 M85 40 L68 34 M85 40 L80 57"/>',
    heart: '<path d="M50 85 C10 55 12 20 33 20 C43 20 50 28 50 34 C50 28 57 20 67 20 C88 20 90 55 50 85 Z"/>',
    sparkle: '<path d="M50 5 C52 35 65 48 95 50 C65 52 52 65 50 95 C48 65 35 52 5 50 C35 48 48 35 50 5 Z"/>',
    flower: '<circle cx="50" cy="50" r="9"/><circle cx="76" cy="50" r="14"/><circle cx="58" cy="75" r="14"/><circle cx="29" cy="66" r="14"/><circle cx="29" cy="34" r="14"/><circle cx="58" cy="25" r="14"/>',
    cross: '<path d="M20 20 L80 80 M80 20 L20 80"/>',
    loop: '<path d="M10 60 C10 20 50 20 50 55 C50 85 20 80 25 55 C30 30 80 30 90 60"/>',
    bolt: '<path d="M55 5 L25 55 L48 55 L40 95 L78 40 L52 40 Z"/>',
    ring: '<path d="M50 10 C85 10 92 50 70 78 C45 100 10 80 10 50 C10 25 35 12 60 18"/>'
};
const svg = k => `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SHAPES[k]}</svg>`;
const NOTES = ["~", "?", "*", "'", "^", "%"];
const small = innerWidth < 760 || lowPower;

(function decor() {
    /* paint dripping from the top edge of the page */
    const dr = document.createElement("div");
    dr.className = "drips"; dr.setAttribute("aria-hidden", "true");
    const N = lowPower ? 6 : small ? 8 : 18;
    for (let i = 0; i < N; i++) {
        const x = (i + rand(.15, .85)) / N * 100, mid = x > 28 && x < 72;   // keep the middle short so the title stays readable
        const d = document.createElement("i");
        d.className = "drip";
        d.style.cssText = `left:${x}%;--w:${rand(10, 24).toFixed(0)}px;--h:${(mid ? rand(30, 90) : rand(70, 300)).toFixed(0)}px;` +
            `--c:${pick(PALETTE)};--d:${rand(0, 1.6).toFixed(2)}s;--t:${rand(2, 4).toFixed(1)}s`;
        dr.append(d);
    }
    document.body.append(dr);

    /* sparkles around the title */
    const hero = document.querySelector(".hero");
    [["10%", "16%", "sparkle"], ["84%", "8%", "star"], ["80%", "58%", "heart"], ["14%", "62%", "spiral"]].forEach(([l, t, k], i) => {
        const e = document.createElement("div");
        e.className = "hero-doodle";
        e.style.cssText = `left:${l};top:${t};--c:${PALETTE[(i * 2) % 5]};animation-delay:${i * .7}s`;
        e.innerHTML = svg(k);
        hero.append(e);
    });

    /* doodles that float by at different speeds as you scroll */
    const layer = document.createElement("div");
    layer.className = "doodles"; layer.setAttribute("aria-hidden", "true");
    const keys = Object.keys(SHAPES), items = [];
    for (let i = 0; i < (lowPower ? 4 : small ? 8 : 26); i++) {
        const el = document.createElement("div");
        const isNote = Math.random() < .2;
        const left = Math.random() < .8 ? (Math.random() < .5 ? rand(1, 13) : rand(84, 95)) : rand(15, 80);
        el.className = "doodle" + (isNote ? " note" : "");
        el.style.cssText = `left:${left.toFixed(1)}%;--c:${pick(PALETTE)};--o:${rand(.7, .95).toFixed(2)};--s:${rand(52, 110).toFixed(0)}px;` +
            `--rot:${rand(-25, 25).toFixed(0)}deg;--bt:${rand(4, 8).toFixed(1)}s;--bd:${rand(-6, 0).toFixed(1)}s`;
        el.innerHTML = isNote ? `<span>${pick(NOTES)}</span>` : svg(pick(keys));
        layer.append(el);
        items.push({ el, base: Math.random(), speed: rand(.08, .45) });
    }
    document.body.append(layer);

    const drift = () => {
        const t = innerHeight + 200, sy = reduce ? 0 : scrollY;
        items.forEach(o => {
            const y = (((o.base * t - sy * o.speed) % t) + t) % t - 100;
            o.el.style.transform = `translateY(${y.toFixed(0)}px)`;
        });
    };
    let queued = false;
    if (!reduce && !lowPower) addEventListener("scroll", () => {
        if (!queued) { queued = true; requestAnimationFrame(() => { drift(); queued = false; }); }
    }, { passive: true });
    addEventListener("resize", drift);
    drift();
})();

/* ============ ARTIST PROFILE (a page inside the sketchbook) ============ */
const P = typeof PROFILE !== "undefined" ? PROFILE : { name: "Artist", about: ["Add profile.js next to index.html to fill in this page."] };
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pcol = i => PALETTE[i % PALETTE.length];

const aboutBtn = document.createElement("button");
aboutBtn.className = "about-btn"; aboutBtn.textContent = "about me";
const pf = document.createElement("div");
pf.className = "profile"; pf.hidden = true;
pf.setAttribute("role", "dialog"); pf.setAttribute("aria-modal", "true"); pf.setAttribute("aria-label", "About the artist");
document.body.append(pf);
toolsSection.append(aboutBtn);
let pfBuilt = false, pfPushed = false, pfLast = null;

function buildProfile() {
    if (pfBuilt) return;
    pfBuilt = true;
    const has = a => Array.isArray(a) && a.length;
    const sections = [];                                    // [id, tab label] for the tabs

    /* sketchbook stats, worked out from the wall itself */
    const dated = artworks.filter(a => a.key).sort((a, b) => (a.key < b.key ? -1 : 1));
    const counts = {};
    artworks.flatMap(a => a.mediums).forEach(m => (counts[m] = (counts[m] || 0) + 1));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const stats = [[artworks.length, "pieces on the wall"]];
    if (dated.length) stats.push([fmt(dated[0].date), "first piece"]);
    if (top) stats.push([top[0], "most used"]);

    const status = P.status === "open" ? ["commissions open!", "var(--mint)"] : P.status === "closed" ? ["commissions closed", "var(--red)"] : null;
    const tag = (t, i) => `<span class="tag" style="--c:${pcol(i)}">${esc(t)}</span>`;

    const left = `
        <div class="pf-head">
            <figure class="pf-photo">
                ${P.avatar ? `<img src="${esc(P.avatar)}" alt="${esc(P.name)}">` : ""}
                <div class="pf-doodle" style="color:var(--pink)">${svg("flower")}</div>
                ${status ? `<span class="sticker pf-status" style="--stk:${status[1]}">${status[0]}</span>` : ""}
            </figure>
            <div>
                <h2 id="pf-name">${esc(P.name)}</h2>
                ${P.tagline ? `<p class="pf-tag">${esc(P.tagline)}</p>` : ""}
                ${P.location ? `<p class="pf-loc">${esc(P.location)}</p>` : ""}
            </div>
        </div>
        ${has(P.about) ? `<h3 id="pf-about">about me</h3>${P.about.map(t => `<p>${esc(t)}</p>`).join("")}` : ""}
        ${has(P.interests) ? `<h3 style="--c:var(--mint)">interests</h3><div class="tags">${P.interests.map(tag).join("")}</div>` : ""}
        <h3 style="--c:var(--pink)">sketchbook stats</h3>
        <div class="stats">${stats.map(([v, l], i) => `<div class="stat" style="--c:${pcol(i + 1)}"><b>${esc(v)}</b><span>${l}</span></div>`).join("")}</div>`;
    if (has(P.about)) sections.push(["about", "about"]);

    let right = "";
    if (has(P.journey)) {
        sections.push(["journey", "journey"]);
        right += `<h3 id="pf-journey" style="--c:var(--pink)">artistic journey</h3><ol class="timeline">${P.journey.map((j, i) =>
            `<li style="--c:${pcol(i)}"><span class="when">${esc(j.when)}</span><strong>${esc(j.title)}</strong><p>${esc(j.text)}</p></li>`).join("")}</ol>`;
    }
    if (has(P.tools)) {
        sections.push(["tools", "tools"]);
        right += `<h3 id="pf-tools" style="--c:var(--mint)">tools of the trade</h3>${P.tools.map((g, gi) =>
            `<h4>${esc(g.group)}</h4><div class="tags">${(g.items || []).map((t, i) => tag(t, i + gi * 2)).join("")}</div>`).join("")}`;
    }
    if (has(P.links)) {
        sections.push(["find", "find me"]);
        right += `<h3 id="pf-find" style="--c:var(--yellow)">find me</h3><div class="pf-links">${P.links.map(l =>
            `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}${l.handle ? ` <small>${esc(l.handle)}</small>` : ""}</a>`).join("")}</div>`;
    }
    if (P.contact && P.contact.email) {
        sections.push(["contact", "contact"]);
        right += `<h3 id="pf-contact" style="--c:var(--red)">contact me</h3>
            ${P.contact.note ? `<p>${esc(P.contact.note)}</p>` : ""}
            <p class="pf-mail">${esc(P.contact.email)}</p>
            <div class="pf-actions">
                <a class="pf-btn" href="mailto:${esc(P.contact.email)}?subject=${encodeURIComponent("Hello from your sketchbook")}">email me</a>
                <button class="pf-btn alt" type="button" data-copy="${esc(P.contact.email)}">copy email</button>
            </div>`;
    }

    pf.innerHTML = `
        <div class="pf-wrap">
            <nav class="tabs" aria-label="Sections">${sections.map(([id, label], i) =>
                `<button class="tab" data-t="${id}" style="--c:${pcol(i + 2)};--fg:${fgFor(pcol(i + 2))}">${label}</button>`).join("")}</nav>
            <article class="book">
                <section class="page">${left}</section>
                <section class="page">${right}</section>
            </article>
        </div>
        <button class="lb-close pf-close" aria-label="Close profile">&times;</button>`;

    /* a doodle stands in when there's no photo (or it fails to load) */
    const photo = pf.querySelector(".pf-photo"), img = photo.querySelector("img");
    if (img) { img.addEventListener("load", () => photo.classList.add("has-img")); img.addEventListener("error", () => img.remove()); }

    pf.addEventListener("click", e => {
        const tab = e.target.closest(".tab");
        if (tab) { pf.querySelector("#pf-" + tab.dataset.t)?.scrollIntoView({ behavior: SMOOTH, block: "start" }); return; }
        const cp = e.target.closest("[data-copy]");
        if (cp) {
            const done = () => { cp.textContent = "copied!"; setTimeout(() => (cp.textContent = "copy email"), 1500); };
            navigator.clipboard.writeText(cp.dataset.copy).then(done, () => prompt("Copy this email:", cp.dataset.copy));
            return;
        }
        if (e.target === pf || e.target.closest(".pf-close")) closeProfile();
    });
}

function openProfile(push = true) {
    buildProfile();
    pfLast = document.activeElement;
    pf.hidden = false;
    document.body.style.overflow = "hidden";
    pf.querySelector(".pf-close").focus();
    if (push) { history.pushState(null, "", "#about"); pfPushed = true; }
}

function closeProfile(fromHistory) {
    pf.hidden = true;
    document.body.style.overflow = "";
    pfLast && pfLast.focus();
    if (fromHistory === true) { pfPushed = false; return; }
    if (pfPushed) { pfPushed = false; history.back(); }
    else history.replaceState(null, "", location.pathname + location.search);
}

function profileRoute(slug) {          // called by the link router
    if (slug === "about" && !artworks.some(a => a.slug === "about")) { if (pf.hidden) openProfile(false); return true; }
    if (!pf.hidden) closeProfile(true);
    return false;
}

aboutBtn.addEventListener("click", () => (pf.hidden ? openProfile() : closeProfile()));
addEventListener("keydown", e => {
    if (pf.hidden) return;
    trap(pf, e);
    if (e.key === "Escape") closeProfile();
});

route();   // open a piece straight away if the link has one

/* ============ LIGHT / DARK THEME ============ */
(function theme() {
    const KEY = "art-theme";
    const btn = document.createElement("button");
    btn.className = "theme-btn";
    appearanceSection.append(btn);
    const apply = (dark, save) => {
        root.dataset.theme = dark ? "dark" : "light";
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1022" : "#f5eee2");
        btn.textContent = dark ? "lights on" : "lights off";
        btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
        if (save) { try { localStorage.setItem(KEY, dark ? "dark" : "light"); } catch { } }
    };
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { }
    apply(saved === "dark", false);
    btn.addEventListener("click", () => {
        root.classList.add("theme-fade");
        apply(root.dataset.theme !== "dark", true);
        setTimeout(() => root.classList.remove("theme-fade"), 500);
    });
})();
