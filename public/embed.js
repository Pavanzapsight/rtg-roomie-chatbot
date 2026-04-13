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

    window.addEventListener("message", function (e) {
      if (e.origin !== origin) return;
      if (!e.data || e.data.type !== MSG_READY) return;
      ready = true;
      flushPending();
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
