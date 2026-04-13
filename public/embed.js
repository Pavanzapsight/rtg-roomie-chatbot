/**
 * Third-party embed: loads the chat iframe and exposes RTGChatEmbed.setContext().
 *
 * <script src="https://YOUR_APP.vercel.app/embed.js" defer></script>
 *
 * Optional initial JSON:
 * <script src="..." data-rtg-context='{"page":"pdp","productName":"..."}' defer></script>
 *
 * After load, call RTGChatEmbed.setContext({ page: "pdp", productName: "..." }) on route changes.
 * Or listen for window message { type: "rtg-embed-ready" } (same origin as script) then setContext.
 */
(function () {
  var MSG_CONTEXT = "rtg-page-context-update";
  var MSG_READY = "rtg-embed-ready";

  // Storage keys the iframe may read/write via the bridge
  var STORAGE_KEYS = [
    "rtg_roomie_chat",
    "rtg_pending_product_summary",
    "rtg_visitor_profile"
  ];

  function inject() {
    var s = document.currentScript;
    if (!s || !s.src) return;
    var origin = new URL(s.src).origin;

    var iframe = document.createElement("iframe");
    iframe.src = origin + "/embed";
    iframe.title = "Shopping Assistant";
    iframe.setAttribute(
      "style",
      [
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
      ].join(";")
    );
    iframe.setAttribute("allow", "clipboard-write");

    var pending = null;
    var scriptTagContext = null;
    var ready = false;

    try {
      var raw = s.getAttribute("data-rtg-context");
      if (raw) scriptTagContext = JSON.parse(raw);
    } catch (_) {
      /* ignore invalid JSON */
    }

    function sendToIframe(payload) {
      if (!iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        { type: MSG_CONTEXT, context: payload },
        origin
      );
    }

    function flushPending() {
      if (!ready || !iframe.contentWindow) return;
      var merged = {};
      if (scriptTagContext) Object.assign(merged, scriptTagContext);
      if (pending) Object.assign(merged, pending);
      scriptTagContext = null;
      pending = null;
      if (Object.keys(merged).length) sendToIframe(merged);
    }

    // Send stored chat data to iframe on load so it can restore conversation
    function sendStorageInit() {
      if (!iframe.contentWindow) return;
      var data = {};
      STORAGE_KEYS.forEach(function (k) {
        try {
          var v = localStorage.getItem(k);
          if (v) data[k] = v;
        } catch (_) {
          /* localStorage may be unavailable */
        }
      });
      iframe.contentWindow.postMessage(
        { type: "rtg-storage-init", data: data },
        origin
      );
    }

    window.addEventListener("message", function (e) {
      if (e.origin !== origin) return;
      if (!e.data) return;

      // Iframe is ready
      if (e.data.type === MSG_READY) {
        ready = true;
        sendStorageInit();
        flushPending();
        return;
      }

      // Navigate the host page (same tab)
      if (e.data.type === "rtg-navigate" && typeof e.data.url === "string") {
        window.location.href = e.data.url;
        return;
      }

      // Storage bridge: set
      if (e.data.type === "rtg-storage-set" && typeof e.data.key === "string") {
        try {
          localStorage.setItem(e.data.key, e.data.value);
        } catch (_) {
          /* quota or unavailable */
        }
        return;
      }

      // Storage bridge: remove
      if (e.data.type === "rtg-storage-remove" && typeof e.data.key === "string") {
        try {
          localStorage.removeItem(e.data.key);
        } catch (_) {
          /* ignore */
        }
        return;
      }
    });

    document.body.appendChild(iframe);

    window.RTGChatEmbed = {
      version: 1,
      origin: origin,
      setContext: function (ctx) {
        if (!ctx || typeof ctx !== "object") return;
        if (ready && iframe.contentWindow) {
          sendToIframe(ctx);
        } else {
          pending = Object.assign({}, pending || {}, ctx);
        }
      },
      getIframe: function () {
        return iframe;
      },
    };
  }

  if (document.body) inject();
  else document.addEventListener("DOMContentLoaded", inject);
})();
