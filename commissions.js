
const COMMISSION_TYPES = [
    {
        value: "Character sketch",
        title: "Character sketches",
        description: "Any character drawings, from a quick pose to a more finished sketch.",
        price: "Quote on request",
        sampleTitle: "Kaoruko Waguri",
        sampleAlt: "Monochrome character sketch example",
        tape: "var(--yellow)"
    },
    {
        value: "Portrait",
        title: "Portraits & expressions",
        description: "A character or person, usually focused on the face and expression.",
        price: "Quote on request",
        sampleTitle: "",
        sampleAlt: "Monochrome portrait example",
        tape: "var(--pink)"
    },
    {
        value: "Color / full render",
        title: "Color & full renders",
        description: "Color, more rendering, and whatever extra details the idea needs.",
        price: "Quote on request",
        sampleTitle: "Familiar Encounter",
        sampleAlt: "Colored character illustration example",
        tape: "var(--mint)"
    },
    {
        value: "Anime-style adaptation",
        title: "Anime-style adaptations",
        description: "A person or character from outside anime, reimagined in an anime-inspired style.",
        price: "Quote on request",
        sampleTitle: "Autumn Vibe Girl",
        sampleAlt: "Anime-style portrait adaptation example",
        tape: "var(--blue)"
    }
];

const COMMISSION_CONTENT = {
    process: [
        { title: "You send me the idea", text: "A description, a character sheet, a handful of links, everything. Just send whatever you have." },
        { title: "We talk it through", text: "I'll get back to you about the scope, price, timing and how you'll use the art. Nothing starts until we're on the same page." },
        { title: "I get drawing", text: "If the piece needs a rough check-in, we'll do that before I get into the details. We'll agree on revisions beforehand, too." },
        { title: "It's yours", text: "I'll send the finished art in the format we agreed on. Easy." }
    ],
    guidelines: [
        "References are helpful, but don't worry if you only have a rough description so far.",
        "Let me know if you want a sketch, monochrome, or color piece.",
        "If you have a budget or deadline in mind, mention it up front. I can't promise every deadline, but we can figure it out.",
        "Commercial use or merch? Tell me before we settle on the price. It changes what we need to discuss.",
        "We'll agree on the price, payment, delivery and revisions before I start drawing."
    ],
    faqs: [
        { q: "Can you draw fanart or an original character?", a: "Yep. Send a character sheet or links if you have them. If not, a description is a good start." },
        { q: "How much does it cost?", a: "I quote each piece separately — it depends on things like how many characters, the detail, background and how you'll use it. Tell me the idea and I'll work out a price with you." },
        { q: "How long will it take?", a: "It depends on the piece and what else is on my desk. I'll give you an estimate before we agree to anything." },
        { q: "Can I use the art commercially?", a: "Possibly! Let me know what you have in mind first so we can talk about usage and pricing." },
        { q: "My idea's still vague. Is that okay?", a: "Absolutely. A messy first draft of an idea is still an idea. Send it over." }
    ]
};

const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));
const profile = typeof PROFILE !== "undefined" ? PROFILE : {};
const artList = typeof artworks !== "undefined" && Array.isArray(artworks) ? artworks : [];
const email = profile.contact?.email || "";

function getSample(title) {
    return artList.find(art => art.title === title);
}

function renderCommissionTypes() {
    const grid = document.getElementById("commission-types");
    const select = document.getElementById("commission-type-select");
    if (!grid || !select) return;

    COMMISSION_TYPES.forEach((type, index) => {
        const art = getSample(type.sampleTitle);
        const sample = art ? `<img src="${escapeHTML(art.thumb || art.image)}" alt="${escapeHTML(type.sampleAlt)}" loading="lazy">` : `<span class="comm-art-missing">sample<br>from my sketchbook</span>`;
        const card = document.createElement("article");
        card.className = "comm-card";
        card.style.setProperty("--tape", type.tape || "var(--pink)");
        card.innerHTML = `
            <div class="comm-card-art">${sample}</div>
            <h3>${escapeHTML(type.title)}</h3>
            <p>${escapeHTML(type.description)}</p>
            <span class="comm-price">${escapeHTML(type.price || "Quote on request")}</span>
            <a class="comm-card-prompt" href="#request" data-commission-value="${escapeHTML(type.value)}">ask about this ↗</a>`;
        grid.append(card);

        const option = document.createElement("option");
        option.value = type.value;
        option.textContent = type.title;
        select.append(option);
    });

    grid.addEventListener("click", event => {
        const link = event.target.closest("[data-commission-value]");
        if (!link) return;
        select.value = link.dataset.commissionValue;
    });
}

function renderContent() {
    const process = document.getElementById("commission-process");
    if (process) process.innerHTML = COMMISSION_CONTENT.process.map((step, index) =>
        `<li style="--c:${["var(--yellow)", "var(--pink)", "var(--mint)", "var(--blue)"][index % 4]}"><h3>${escapeHTML(step.title)}</h3><p>${escapeHTML(step.text)}</p></li>`
    ).join("");

    const guidelines = document.getElementById("commission-guidelines");
    if (guidelines) guidelines.innerHTML = COMMISSION_CONTENT.guidelines.map(item => `<li>${escapeHTML(item)}</li>`).join("");

    const faq = document.getElementById("commission-faqs");
    if (faq) faq.innerHTML = COMMISSION_CONTENT.faqs.map((item, index) =>
        `<details class="comm-faq-item"${index === 0 ? " open" : ""}><summary>${escapeHTML(item.q)}</summary><p>${escapeHTML(item.a)}</p></details>`
    ).join("");
}

function renderProfileDetails() {
    const status = document.getElementById("commission-status");
    const note = document.getElementById("commission-status-note");
    const statusValue = String(profile.status || "").toLowerCase();
    if (status) {
        if (statusValue === "open") {
            status.textContent = "Open for commissions";
            status.classList.add("is-open");
            if (note) note.textContent = "Send me your idea and we'll figure out the details.";
        } else if (statusValue === "closed") {
            status.textContent = "Closed for now";
            status.classList.add("is-closed");
            if (note) note.textContent = "You can still say hi, but I might not be able to take on a piece right now.";
        } else {
            status.textContent = "Ask me first";
            if (note) note.textContent = "I haven't posted my availability — just drop me a message.";
        }
    }

    const mailLink = document.getElementById("commission-email-link");
    if (mailLink && email) {
        mailLink.href = `mailto:${email}`;
        mailLink.textContent = email;
    } else if (mailLink) {
        mailLink.hidden = true;
    }

    const socials = document.getElementById("commission-socials");
    if (socials && Array.isArray(profile.links)) {
        socials.innerHTML = profile.links.map(link =>
            `<a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)}${link.handle ? ` (${escapeHTML(link.handle)})` : ""}</a>`
        ).join("");
    }
}

function setupInquiryForm() {
    const form = document.getElementById("commission-form");
    const status = document.getElementById("commission-form-status");
    if (!form || !status) return;

    form.addEventListener("submit", event => {
        event.preventDefault();
        if (!email) {
            status.textContent = "I haven't set up my email yet — please try again later.";
            return;
        }
        const data = new FormData(form);
        const name = String(data.get("name") || "").trim();
        const replyEmail = String(data.get("replyEmail") || "").trim();
        const brief = String(data.get("brief") || "").trim();
        if (!name || !replyEmail || brief.length < 10) {
            status.textContent = "Add your name, a valid email and a little more about the idea, then try again.";
            return;
        }

        const details = [
            `Name / handle: ${name}`,
            `Reply-to email: ${replyEmail}`,
            `Commission type: ${data.get("type") || "Not selected"}`,
            `Budget: ${data.get("budget") || "Not specified"}`,
            `Deadline: ${data.get("deadline") || "Not specified"}`,
            `Intended use: ${data.get("usage") || "Not specified"}`,
            `Reference links: ${data.get("references") || "None provided"}`,
            "",
            "Idea / brief:",
            brief
        ].join("\n");
        const subject = `Commission inquiry — ${name}`;
        const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(details)}`;
        status.textContent = "Opening your email app…";
        window.location.href = mailto;
    });
}

function setupThemeButton() {
    const root = document.documentElement;
    const button = document.getElementById("commission-theme-btn");
    const apply = (dark, save) => {
        root.dataset.theme = dark ? "dark" : "light";
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1022" : "#f5eee2");
        if (button) {
            button.textContent = dark ? "lights on" : "lights off";
            button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
        }
        if (save) {
            try { localStorage.setItem("art-theme", dark ? "dark" : "light"); } catch { /* storage may be unavailable */ }
        }
    };
    let saved = null;
    try { saved = localStorage.getItem("art-theme"); } catch { /* storage may be unavailable */ }
    apply(saved === "dark", false);
    button?.addEventListener("click", () => {
        root.classList.add("theme-fade");
        apply(root.dataset.theme !== "dark", true);
        setTimeout(() => root.classList.remove("theme-fade"), 500);
    });
}

renderCommissionTypes();
renderContent();
renderProfileDetails();
setupInquiryForm();
setupThemeButton();
