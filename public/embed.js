/**
 * Rooms To Go — Roomie Shopping Assistant embed script.
 *
 * Drop this single <script> tag on any Shopify (or other) page:
 *   <script src="https://rtg-roomie-chatbot.vercel.app/embed.js" defer></script>
 *
 * It auto-detects the Shopify page context (product, collection, cart, search,
 * homepage), tracks browsing history, and manages chat persistence — all in the
 * host page's first-party storage so Safari ITP cannot block it.
 *
 * The chat widget itself loads inside a same-origin iframe at /embed.
 */
(function () {
  "use strict";

  // ─── Constants ────────────────────────────────────────────────────────
  var STORAGE = {
    SESSION:    "rtg_session_id",
    CHAT:       "rtg_chat_messages",
    HISTORY:    "rtg_browsing_history",
    PENDING:    "rtg_pending_product",
    PROFILE:    "rtg_visitor_profile",
    WIDGET_OPEN:"rtg_widget_open",
  };
  var MAX_HISTORY = 30;
  var MSG_CONTEXT = "rtg-page-context-update";

  // ─── Helpers ──────────────────────────────────────────────────────────
  function uid() {
    return "rtg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch (_) { /* quota */ }
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (_) { /* noop */ }
  }
  function safeJSON(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  // ─── Session ID (first-party localStorage) ───────────────────────────
  function getSessionId() {
    var sid = safeGet(STORAGE.SESSION);
    if (!sid) { sid = uid(); safeSet(STORAGE.SESSION, sid); }
    return sid;
  }

  // ─── Shopify Page Context Detection ───────────────────────────────────
  function getShopifyContext() {
    var ctx = { page: "unknown" };

    // 1. Try ShopifyAnalytics.meta (most reliable)
    var sa = window.ShopifyAnalytics;
    var meta = sa && sa.meta;
    if (meta && meta.page) {
      var pt = (meta.page.pageType || "").toLowerCase();
      if (pt === "product")    ctx.page = "pdp";
      else if (pt === "collection") ctx.page = "category";
      else if (pt === "cart")       ctx.page = "cart";
      else if (pt === "search")     ctx.page = "search";
      else if (pt === "home" || pt === "index") ctx.page = "homepage";
    }

    // 2. Fallback: URL pattern matching
    if (ctx.page === "unknown") {
      var path = window.location.pathname;
      if (/^\/products\/.+/.test(path))      ctx.page = "pdp";
      else if (/^\/collections\/.+/.test(path)) ctx.page = "category";
      else if (path === "/cart")                 ctx.page = "cart";
      else if (/^\/search/.test(path))           ctx.page = "search";
      else if (path === "/" || path === "")       ctx.page = "homepage";
    }

    // 3. Product data (PDP)
    if (ctx.page === "pdp") {
      // Try window.meta.product (Shopify Dawn-based themes)
      var mp = window.meta && window.meta.product;
      if (mp) {
        ctx.productName  = mp.title;
        ctx.productId    = mp.id;
        ctx.productVendor = mp.vendor;
        ctx.productType  = mp.type;
        if (mp.variants && mp.variants.length) {
          ctx.productSku   = mp.variants[0].sku;
          ctx.productPrice = "$" + (mp.variants[0].price / 100).toFixed(2);
        }
      }

      // Try ShopifyAnalytics.meta.product
      if (!ctx.productName && meta && meta.product) {
        ctx.productName  = meta.product.title;
        ctx.productId    = meta.product.id;
        ctx.productVendor = meta.product.vendor;
        ctx.productType  = meta.product.type;
        if (meta.product.variants && meta.product.variants.length) {
          ctx.productSku   = meta.product.variants[0].sku;
          ctx.productPrice = "$" + (meta.product.variants[0].price / 100).toFixed(2);
        }
      }

      // Fallback: scrape from the DOM
      if (!ctx.productName) {
        var titleEl = document.querySelector("h1.product__title, h1.product-title, .product-single__title, h1[data-product-title]");
        if (titleEl) ctx.productName = titleEl.textContent.trim();
      }
      if (!ctx.productPrice) {
        var priceEl = document.querySelector(".product__price .price-item--regular, .product-single__price, [data-product-price], .price--large");
        if (priceEl) ctx.productPrice = priceEl.textContent.trim();
      }

      // Extract product handle from URL for product JSON fetch
      var handleMatch = window.location.pathname.match(/\/products\/([^/?#]+)/);
      if (handleMatch) {
        ctx.productHandle = handleMatch[1];
        ctx.productUrl = window.location.href;
      }
    }

    // 4. Collection/Category data
    if (ctx.page === "category") {
      var collTitle = document.querySelector("h1.collection__title, h1.collection-hero__title, h1");
      if (collTitle) ctx.category = collTitle.textContent.trim();
      // Fallback from URL
      if (!ctx.category) {
        var collMatch = window.location.pathname.match(/\/collections\/([^/?#]+)/);
        if (collMatch) ctx.category = collMatch[1].replace(/-/g, " ");
      }
    }

    // 5. Search query
    if (ctx.page === "search") {
      ctx.searchQuery = new URLSearchParams(window.location.search).get("q") || "";
    }

    return ctx;
  }

  // Fetch enriched product data from Shopify JSON endpoint (async)
  function fetchProductDetails(handle, callback) {
    if (!handle) return;
    fetch("/products/" + handle + ".json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.product) {
          callback({
            productDescription: stripHtml(data.product.body_html || "").slice(0, 500),
            productImage: data.product.images && data.product.images.length
              ? data.product.images[0].src : undefined,
            productTags: data.product.tags ? data.product.tags.split(", ").slice(0, 10) : [],
          });
        }
      })
      .catch(function () { /* not critical */ });
  }

  // Fetch Shopify cart
  function fetchCart(callback) {
    fetch("/cart.js")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cart) {
        if (cart && cart.items) {
          callback({
            cartItems: cart.items.map(function (i) {
              return i.title + (i.variant_title ? " — " + i.variant_title : "");
            }),
            cartTotal: "$" + (cart.total_price / 100).toFixed(2),
            cartCount: cart.item_count,
          });
        }
      })
      .catch(function () { /* not critical */ });
  }

  function stripHtml(html) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  }

  // ─── Browsing History ─────────────────────────────────────────────────
  function getBrowsingHistory() {
    return safeJSON(safeGet(STORAGE.HISTORY)) || [];
  }

  function trackPageView(ctx) {
    if (ctx.page !== "pdp" || !ctx.productName) return;
    var history = getBrowsingHistory();

    // Remove duplicate
    history = history.filter(function (h) { return h.productName !== ctx.productName; });

    // Add to front
    history.unshift({
      productName: ctx.productName,
      productPrice: ctx.productPrice || "",
      productUrl: ctx.productUrl || window.location.href,
      viewedAt: new Date().toISOString(),
    });

    // Trim
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);

    safeSet(STORAGE.HISTORY, JSON.stringify(history));
  }

  // ─── Visitor Profile ──────────────────────────────────────────────────
  function getVisitorProfile() {
    return safeJSON(safeGet(STORAGE.PROFILE)) || null;
  }

  // ─── Shared Chat ─────────────────────────────────────────────────────
  // Two formats supported:
  //   ?chat=<gzip+base64url>  — self-contained (works across browsers)
  //   ?c=<short-id>           — server-side lookup (in-memory, best effort)
  function getSharedChatInput() {
    var params = new URLSearchParams(window.location.search);
    var chatData = params.get("chat");
    var shortId = params.get("c");
    if (!chatData && !shortId) return null;

    var clean = new URL(window.location.href);
    clean.searchParams.delete("chat");
    clean.searchParams.delete("c");
    history.replaceState(null, "", clean.toString());

    return { chatData: chatData, shortId: shortId };
  }

  // Gzip-decompress a URL-safe base64 string → JSON string
  function decompressChat(encoded) {
    var b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    var stream = new Blob([bytes]).stream().pipeThrough(
      new DecompressionStream("gzip")
    );
    return new Response(stream).text();
  }

  function resolveSharedChat(origin, input, callback) {
    // Try the self-contained compressed data first
    if (input.chatData) {
      decompressChat(input.chatData)
        .then(function (json) {
          var arr = JSON.parse(json);
          if (Array.isArray(arr)) {
            callback(arr.map(function (m, i) {
              return { id: "shared-" + i, role: m.role, text: m.text };
            }));
          } else { callback(null); }
        })
        .catch(function () { callback(null); });
      return;
    }

    // Fallback: short-id server lookup
    if (input.shortId) {
      fetch(origin + "/api/share/" + encodeURIComponent(input.shortId))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && Array.isArray(data.messages)) {
            callback(data.messages.map(function (m, i) {
              return { id: "shared-" + i, role: m.role, text: m.text };
            }));
          } else { callback(null); }
        })
        .catch(function () { callback(null); });
      return;
    }

    callback(null);
  }

  // ─── Main Inject ──────────────────────────────────────────────────────
  function inject() {
    // Determine embed origin from the script tag src
    var scripts = document.querySelectorAll("script[src]");
    var origin = "";
    for (var i = 0; i < scripts.length; i++) {
      if (/embed\.js/.test(scripts[i].src)) {
        origin = new URL(scripts[i].src).origin;
        break;
      }
    }
    if (!origin) return;

    var sessionId = getSessionId();
    var pageContext = getShopifyContext();
    trackPageView(pageContext);

    // ── Create iframe ──
    var iframe = document.createElement("iframe");
    iframe.src = origin + "/embed";
    iframe.title = "Shopping Assistant";
    // Start small (just enough for the toggle button), expand when widget opens
    var CLOSED_STYLE = [
      "position:fixed",
      "bottom:0",
      "right:0",
      "width:300px",
      "height:90px",
      "border:0",
      "z-index:2147483647",
      "background:transparent",
      "transition:width 0.3s ease, height 0.3s ease",
    ].join(";");

    var OPEN_STYLE = [
      "position:fixed",
      "bottom:0",
      "right:0",
      "width:min(440px,100vw)",
      "height:min(720px,100vh)",
      "max-width:100vw",
      "max-height:100vh",
      "border:0",
      "z-index:2147483647",
      "background:transparent",
      "transition:width 0.3s ease, height 0.3s ease",
    ].join(";");

    // Restore previous widget open/closed state so the iframe loads at the
    // right size (no flash of the small pill when the chat was open).
    var wasOpen = safeGet(STORAGE.WIDGET_OPEN) === "1";
    iframe.setAttribute("style", wasOpen ? OPEN_STYLE : CLOSED_STYLE);
    iframe.setAttribute("allow", "clipboard-write");

    var ready = false;

    function sendToIframe(payload) {
      if (!iframe.contentWindow) return;
      iframe.contentWindow.postMessage(payload, origin);
    }

    // When iframe signals ready, send the full init payload
    function handleReady() {
      ready = true;

      var sharedInput = getSharedChatInput();
      var localChat = safeJSON(safeGet(STORAGE.CHAT));
      var pending = safeJSON(safeGet(STORAGE.PENDING));
      var profile = getVisitorProfile();
      var history = getBrowsingHistory();

      function sendInit(chatMessages, isSharedChat) {
        sendToIframe({
          type: "rtg-init",
          sessionId: sessionId,
          chatMessages: chatMessages,
          pageContext: pageContext,
          browsingHistory: history,
          pendingProduct: pending,
          visitorProfile: profile,
          isSharedChat: !!isSharedChat,
          widgetOpen: wasOpen,
        });
      }

      if (sharedInput) {
        resolveSharedChat(origin, sharedInput, function (sharedMessages) {
          if (sharedMessages && sharedMessages.length > 0) {
            sendInit(sharedMessages, true);
          } else {
            // Decode failed or expired — fall back to local chat
            sendInit(localChat, false);
          }
        });
      } else {
        sendInit(localChat, false);
      }

      // Clear pending product after sending
      if (pending) safeRemove(STORAGE.PENDING);

      // Fetch enriched product details (async) and send as update
      if (pageContext.productHandle) {
        fetchProductDetails(pageContext.productHandle, function (details) {
          pageContext = Object.assign(pageContext, details);
          sendToIframe({ type: MSG_CONTEXT, context: pageContext });
        });
      }

      // Fetch cart data (async) and send as update
      fetchCart(function (cartData) {
        pageContext = Object.assign(pageContext, cartData);
        sendToIframe({ type: MSG_CONTEXT, context: pageContext });
      });
    }

    // ── Message listener ──
    window.addEventListener("message", function (e) {
      if (e.origin !== origin) return;
      if (!e.data || typeof e.data.type !== "string") return;

      switch (e.data.type) {
        case "rtg-embed-ready":
          handleReady();
          break;

        case "rtg-navigate":
          // Save pending product before navigating
          if (e.data.pendingProduct) {
            safeSet(STORAGE.PENDING, JSON.stringify(e.data.pendingProduct));
          }
          if (typeof e.data.url === "string") {
            window.location.href = e.data.url;
          }
          break;

        case "rtg-save-messages":
          if (e.data.messages) {
            safeSet(STORAGE.CHAT, JSON.stringify(e.data.messages));
          }
          break;

        case "rtg-save-profile":
          if (e.data.profile) {
            safeSet(STORAGE.PROFILE, JSON.stringify(e.data.profile));
          }
          break;

        case "rtg-clear-messages":
          safeRemove(STORAGE.CHAT);
          break;

        case "rtg-widget-open":
          iframe.setAttribute("style", OPEN_STYLE);
          safeSet(STORAGE.WIDGET_OPEN, "1");
          break;

        case "rtg-widget-close":
          iframe.setAttribute("style", CLOSED_STYLE);
          safeSet(STORAGE.WIDGET_OPEN, "0");
          break;
      }
    });

    // ── SPA navigation detection (Shopify themes with AJAX) ──
    var lastUrl = window.location.href;
    function onUrlChange() {
      var newUrl = window.location.href;
      if (newUrl === lastUrl) return;
      lastUrl = newUrl;

      // Re-detect context after a short delay (DOM needs to update)
      setTimeout(function () {
        pageContext = getShopifyContext();
        trackPageView(pageContext);
        if (ready) {
          sendToIframe({ type: MSG_CONTEXT, context: pageContext });

          // Fetch product details if on a new PDP
          if (pageContext.productHandle) {
            fetchProductDetails(pageContext.productHandle, function (details) {
              pageContext = Object.assign(pageContext, details);
              sendToIframe({ type: MSG_CONTEXT, context: pageContext });
            });
          }
        }
      }, 500);
    }

    // Intercept pushState/replaceState for SPA navigation
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function () {
      origPush.apply(this, arguments);
      onUrlChange();
    };
    history.replaceState = function () {
      origReplace.apply(this, arguments);
      onUrlChange();
    };
    window.addEventListener("popstate", onUrlChange);

    // ── Activity tracking (throttled) — for IDLE/re-engagement detection ──
    var lastActivitySent = 0;
    function onActivity() {
      var now = Date.now();
      if (now - lastActivitySent < 5000) return; // throttle to one pulse per 5s
      lastActivitySent = now;
      if (ready) sendToIframe({ type: "rtg-activity", at: now });
    }
    ["mousemove", "scroll", "click", "keydown", "touchstart"].forEach(function (evt) {
      window.addEventListener(evt, onActivity, { passive: true });
    });

    // ── Append iframe ──
    document.body.appendChild(iframe);

    // ── Public API (optional) ──
    window.RTGChatEmbed = {
      version: 2,
      origin: origin,
      setContext: function (ctx) {
        if (!ctx || typeof ctx !== "object") return;
        pageContext = Object.assign(pageContext, ctx);
        if (ready) sendToIframe({ type: MSG_CONTEXT, context: pageContext });
      },
      getIframe: function () { return iframe; },
    };
  }

  // ── Boot ──
  if (document.body) inject();
  else document.addEventListener("DOMContentLoaded", inject);
})();
