/* Sugary Treats — authenticated, real-time artwork likes (Supabase) */
(() => {
  const config = window.SUPABASE_CONFIG || {};
  const trigger = document.getElementById("likes-auth-trigger");
  const likedSlugs = new Set();
  const counts = new Map();
  const buttons = new Map();
  const pending = new Set();
  let user = null;
  let client = null;
  let channel = null;
  let modal = null;
  let statusNode = null;

  const dispatchChanged = () =>
    window.dispatchEvent(new CustomEvent("artwork-likes-changed"));
  const slugButtons = (slug) => buttons.get(slug) || new Set();

  function updateButton(button, slug, title = "this artwork") {
    const count = counts.get(slug) || 0;
    const liked = likedSlugs.has(slug);
    const countNode = button.querySelector("[data-like-count]");
    if (countNode) countNode.textContent = String(count);
    const labelNode = button.querySelector("[data-like-label]");
    if (labelNode) labelNode.textContent = liked ? "liked" : "like";
    button.classList.toggle("on", liked);
    button.setAttribute("aria-pressed", String(liked));
    button.setAttribute(
      "aria-label",
      `${liked ? "Unlike" : "Like"} ${title}; ${count} ${count === 1 ? "like" : "likes"}`,
    );
    button.disabled = pending.has(slug);
  }

  function setCount(slug, value) {
    if (!slug) return;
    const count = Math.max(0, Number(value) || 0);
    counts.set(slug, count);
    slugButtons(slug).forEach((button) =>
      updateButton(button, slug, button.dataset.likeTitle || "this artwork"),
    );
  }

  function register(art, button) {
    if (!art?.slug || !button) return;
    const previousSlug = button.dataset.likeSlug;
    if (previousSlug && previousSlug !== art.slug)
      buttons.get(previousSlug)?.delete(button);
    button.dataset.likeSlug = art.slug;
    button.dataset.likeTitle = art.title || "this artwork";
    if (!buttons.has(art.slug)) buttons.set(art.slug, new Set());
    buttons.get(art.slug).add(button);
    updateButton(button, art.slug, art.title || "this artwork");
  }

  function setLiked(slug, liked) {
    if (liked) likedSlugs.add(slug);
    else likedSlugs.delete(slug);
    slugButtons(slug).forEach((button) =>
      updateButton(button, slug, button.dataset.likeTitle || "this artwork"),
    );
    dispatchChanged();
  }

  function updateAuthButton() {
    if (!trigger) return;
    trigger.textContent = user ? "account" : "sign in to like ♡";
    trigger.setAttribute(
      "aria-label",
      user
        ? `Account: ${user.email || "signed in"}`
        : "Sign in to like artworks",
    );
    window.dispatchEvent(
      new CustomEvent("artwork-auth-changed", { detail: { signedIn: !!user } }),
    );
  }

  function setStatus(message, isError = false) {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.classList.toggle("is-error", isError);
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    trigger?.focus();
  }

  function openModal(
    message = "Sign in to like an artwork and keep your likes synced across devices.",
  ) {
    if (!modal) return;
    const heading = modal.querySelector("[data-auth-title]");
    const intro = modal.querySelector("[data-auth-intro]");
    const kicker = modal.querySelector(".likes-kicker");
    const closeButton = modal.querySelector(".likes-close");
    if (heading)
      heading.textContent = user ? "Welcome back." : "Join the sketchbook.";
    if (intro)
      intro.textContent = user
        ? "Your likes are saved and synced across devices."
        : message;
    if (kicker)
      kicker.textContent = user
        ? "your sketchbook is ready"
        : "a tiny bit of account magic";
    if (closeButton)
      closeButton.setAttribute(
        "aria-label",
        user ? "Close account dialog" : "Close sign-in dialog",
      );
    setStatus("");
    const signedInPanel = modal.querySelector("[data-signed-in]");
    const signedOutPanel = modal.querySelector("[data-signed-out]");
    signedInPanel.hidden = !user;
    signedOutPanel.hidden = !!user;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    (user
      ? modal.querySelector("[data-signout]")
      : modal.querySelector("[data-google-signin]")
    )?.focus();
  }

  function buildModal() {
    modal = document.createElement("div");
    modal.className = "likes-modal";
    modal.hidden = true;
    modal.innerHTML = `
          <section class="likes-dialog" role="dialog" aria-modal="true" aria-labelledby="likes-title">
            <button class="likes-close" type="button" aria-label="Close sign-in dialog">×</button>
            <p class="likes-kicker">a tiny bit of account magic</p>
            <h2 id="likes-title" data-auth-title>Join the sketchbook.</h2>
            <p class="likes-intro" data-auth-intro>Sign in to like an artwork and keep your likes synced across devices.</p>
            <div data-signed-out>
                <button class="likes-submit" data-google-signin type="button">
                    Continue with Google ↗
                </button>

                <p class="likes-hint">
                    Sign in securely with your Google account.
                    Your artwork likes will sync across devices.
                </p>
            </div>
            <div data-signed-in hidden>
              <p class="likes-account-email"></p>
              <button class="likes-submit" data-signout type="button">sign out</button>
            </div>
            <p class="likes-status" role="status" aria-live="polite"></p>
          </section>`;
    document.body.append(modal);
    statusNode = modal.querySelector(".likes-status");
    // form = modal.querySelector("#likes-login-form");
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest(".likes-close"))
        closeModal();
    });
    modal
      .querySelector("[data-signout]")
      .addEventListener("click", async () => {
        const { error } = await client.auth.signOut();
        if (error) setStatus(error.message, true);
        else {
          setStatus("Signed out.");
          closeModal();
        }
      });
    modal
      .querySelector("[data-google-signin]")
      .addEventListener("click", async (event) => {
        const button = event.currentTarget;

        if (!client) return;

        button.disabled = true;
        setStatus("Opening Google sign-in...");

        try {
          const redirectTo = `${window.location.origin}${window.location.pathname}`;

          const { error } = await client.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo,
            },
          });

          if (error) throw error;
        } catch (error) {
          console.error("Google sign-in failed:", error);

          setStatus(
            error?.message || "Google sign-in failed. Please try again.",
            true,
          );

          button.disabled = false;
        }
      });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
      if (event.key !== "Tab") return;
      const focusable = [
        ...modal.querySelectorAll(
          "button:not([disabled]), input:not([disabled])",
        ),
      ].filter((el) => !el.closest("[hidden]"));
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  async function refreshCounts() {
    const { data, error } = await client
      .from("artwork_like_counts")
      .select("artwork_slug, like_count");
    if (error) {
      console.error("Could not load like counts:", error);
      return;
    }
    (data || []).forEach((row) => setCount(row.artwork_slug, row.like_count));
  }

  async function refreshMyLikes() {
    likedSlugs.clear();
    if (user) {
      const { data, error } = await client.rpc("get_my_artwork_likes");
      if (error) console.error("Could not load your likes:", error);
      else (data || []).forEach((row) => likedSlugs.add(row.artwork_slug));
    }
    buttons.forEach((set, slug) =>
      set.forEach((button) =>
        updateButton(button, slug, button.dataset.likeTitle || "this artwork"),
      ),
    );
    dispatchChanged();
  }

  async function setArtworkLike(art, desired) {
    if (!user) {
      openModal("Sign in first, then tap the heart to add your like.");
      return;
    }
    const slug = art.slug;
    if (pending.has(slug)) return;
    const previousLiked = likedSlugs.has(slug);
    const previousCount = counts.get(slug) || 0;
    pending.add(slug);
    setLiked(slug, desired);
    setCount(slug, previousCount + Number(desired) - Number(previousLiked));
    try {
      const { data, error } = await client.rpc("set_artwork_like", {
        p_artwork_slug: slug,
        p_liked: desired,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setCount(slug, row.like_count);
        setLiked(slug, Boolean(row.liked ?? desired));
      }
      slugButtons(slug).forEach((button) => {
        button.classList.remove("pop");
        if (desired) {
          void button.offsetWidth;
          button.classList.add("pop");
        }
      });
    } catch (error) {
      console.error("Like action failed:", error);
      setLiked(slug, previousLiked);
      setCount(slug, previousCount);
      openModal("Something went wrong while updating your like.");
      setStatus(error?.message || "Please try again in a moment.", true);
    } finally {
      pending.delete(slug);
      slugButtons(slug).forEach((button) =>
        updateButton(button, slug, art.title),
      );
    }
  }

  async function toggle(art) {
    if (!art?.slug) return;
    await setArtworkLike(art, !likedSlugs.has(art.slug));
  }

  function showSetupMessage() {
    openModal("The like system is not connected yet.");
    const signedOutPanel = modal?.querySelector("[data-signed-out]");
    if (signedOutPanel) signedOutPanel.hidden = true;
    setStatus(
      "Add your Supabase project URL and publishable key to supabase-config.js, then reload the page.",
      true,
    );
  }

  function connectRealtime() {
    channel = client
      .channel("public-artwork-like-counts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "artwork_like_counts",
        },
        (payload) => {
          const row = payload.new || payload.old;
          if (row?.artwork_slug)
            setCount(row.artwork_slug, row.like_count ?? 0);
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Realtime likes channel:", status, error);
        }
      });
  }

  const api = {
    enabled: false,
    likedSlugs,
    register,
    toggle,
    getCount: (slug) => counts.get(slug) || 0,
    showSetupMessage,
    openLogin: openModal,
    getUser: () => user,
  };
  window.ArtworkLikes = api;

  buildModal();
  trigger?.addEventListener("click", () =>
    client ? openModal() : showSetupMessage(),
  );

  if (
    !window.supabase?.createClient ||
    !/^https:\/\//.test(config.url || "") ||
    !config.publishableKey ||
    config.publishableKey.includes("YOUR_")
  ) {
    if (trigger) trigger.textContent = "likes setup needed ♡";
    return;
  }

  client = window.supabase.createClient(config.url, config.publishableKey);
  api.enabled = true;

  async function applySession(session) {
    const previousUser = user?.id || null;
    user = session?.user || null;
    updateAuthButton();
    const accountEmail = modal.querySelector(".likes-account-email");
    if (accountEmail) accountEmail.textContent = user?.email || "Signed in";
    await refreshMyLikes();
    if (user && !previousUser) closeModal();
    if (!user && previousUser) likedSlugs.clear();
  }

  client.auth.getSession().then(({ data, error }) => {
    if (error) console.warn("Session check:", error);
    applySession(data?.session || null);
  });
  client.auth.onAuthStateChange((_event, session) => {
    // Defer database reads outside the auth callback to avoid blocking auth state processing.
    setTimeout(() => applySession(session), 0);
  });

  connectRealtime();
  refreshCounts();
})();
