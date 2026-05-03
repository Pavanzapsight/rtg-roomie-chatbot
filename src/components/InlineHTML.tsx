"use client";

import { useRef, useEffect, useState } from "react";

// Script injected into every iframe to provide sendPrompt, multi-select, and auto-resize
const IFRAME_BRIDGE_SCRIPT = `
<script>
  // Single send — sends text immediately
  function sendPrompt(text) {
    window.parent.postMessage({ type: 'rtg-send-prompt', text: text }, '*');
  }

  // Multi-select support
  var _selected = new Set();

  function toggleSelect(el, value) {
    if (_selected.has(value)) {
      _selected.delete(value);
      el.classList.remove('selected');
    } else {
      _selected.add(value);
      el.classList.add('selected');
    }
  }

  function submitSelected(prefix) {
    if (_selected.size === 0) return;
    var items = Array.from(_selected);
    var text = (prefix || '') + items.join(', ');
    window.parent.postMessage({ type: 'rtg-send-prompt', text: text.trim() }, '*');
  }

  /** Opens the Rooms To Go product page (parent window; works inside sandboxed iframe). */
  function openProduct(url, productName) {
    if (!url) return;
    window.parent.postMessage({ type: 'rtg-open-url', url: String(url).trim(), productName: productName || '' }, '*');
  }

  /**
   * Adds a line item on the host Shopify store (via parent embed script).
   * variantId: numeric Shopify variant id. quantity: optional, default 1, max 99.
   */
  function addToCart(variantId, quantity) {
    var q = quantity == null || quantity === '' ? 1 : Number(quantity);
    if (!(q >= 1) || q > 99) q = 1;
    window.parent.postMessage({
      type: 'rtg-add-to-cart',
      variantId: variantId,
      quantity: Math.floor(q)
    }, '*');
  }

  /** Navigates the host Shopify store to /checkout (via parent embed script). */
  function checkout() {
    window.parent.postMessage({ type: 'rtg-checkout' }, '*');
  }

  function askSimilar(productName) {
    var name = String(productName || '').trim();
    if (!name) return;
    sendPrompt('Show me products similar to ' + name);
  }

  // Auto-resize iframe to fit content.
  // Multiple strategies because size changes can happen from many sources
  // (DOM mutations, image loads, font loads, reflows) and we must never
  // clip the bottom of the content — but also never add visible padding.
  function measuredHeight() {
    // Body-only measurement avoids html.* variance (margin/outer chrome).
    // Max of scroll+offset handles edge cases where one is 0 during paint.
    return Math.max(
      document.body.scrollHeight || 0,
      document.body.offsetHeight || 0
    );
  }

  var _lastSent = 0;
  function notifyHeight() {
    // +2px buffer — enough for true sub-pixel rounding, not visible.
    var h = measuredHeight() + 2;
    // Skip redundant posts when nothing actually changed, and debounce
    // tiny fluctuations (<=1px) that can fire during layout flickers.
    if (Math.abs(h - _lastSent) < 2) return;
    _lastSent = h;
    window.parent.postMessage({ type: 'rtg-iframe-resize', height: h }, '*');
  }

  // 1) DOM mutations — catches added/removed/rearranged nodes
  new MutationObserver(notifyHeight).observe(document.body, {
    childList: true, subtree: true, attributes: true
  });

  // 2) ResizeObserver on body — catches size changes from ANY cause
  //    (image loads, font loads, CSS reflow, flex/grid adjustments).
  if (typeof ResizeObserver !== 'undefined') {
    try {
      new ResizeObserver(function () { notifyHeight(); }).observe(document.body);
    } catch (_) { /* ignore */ }
  }

  // 3) window.load — final paint after all external resources
  window.addEventListener('load', notifyHeight);

  // 4) Every image fires its own load handler — fixed heights may apply
  //    slightly later than initial paint on some browsers.
  function hookImages() {
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.__rtgHooked) continue;
      img.__rtgHooked = true;
      img.addEventListener('load', notifyHeight);
      img.addEventListener('error', notifyHeight);
    }
  }
  hookImages();
  new MutationObserver(hookImages).observe(document.body, {
    childList: true, subtree: true
  });

  function enhanceProductCards() {
    var cards = document.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.__rtgEnhanced) continue;
      card.__rtgEnhanced = true;

      var media = card.querySelector('.card-media');
      var title = card.querySelector('.card-title');
      if (!media || !title) continue;

      media.style.position = 'relative';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card-similar-btn';
      btn.setAttribute('aria-label', 'Show products similar to ' + title.textContent.trim());
      btn.textContent = '+';
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var parentCard = event.currentTarget.closest('.card');
        var parentTitle = parentCard ? parentCard.querySelector('.card-title') : null;
        var productName = parentTitle ? parentTitle.textContent : '';
        askSimilar(productName);
      });
      media.appendChild(btn);
    }
  }
  enhanceProductCards();
  new MutationObserver(function () {
    enhanceProductCards();
    notifyHeight();
  }).observe(document.body, {
    childList: true, subtree: true
  });

  // 5) Font loading — text can reflow after web fonts land
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(notifyHeight).catch(function () {});
  }

  // 6) Staggered retries to catch anything the observers miss
  [10, 100, 300, 800, 1500].forEach(function (ms) {
    setTimeout(notifyHeight, ms);
  });
</script>
`;

// Base styles injected into iframe for RTG brand consistency
const IFRAME_BASE_STYLES = `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #1A1A1A;
    background: transparent;
    overflow: hidden;
    /* No extra space */
    height: auto;
  }
  body { padding: 0; }

  /* Default pill/chip styles */
  .pill, .chip, [data-prompt] {
    display: inline-block;
    padding: 6px 14px;
    margin: 3px;
    border-radius: 999px;
    border: 1px solid #003DA5;
    color: #003DA5;
    background: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
  }
  .pill:hover, .chip:hover, [data-prompt]:hover {
    background: #003DA5;
    color: white;
  }
  .pill:active, .chip:active, [data-prompt]:active {
    transform: scale(0.97);
  }
  /* Selected state for multi-select */
  .pill.selected, .chip.selected {
    background: #003DA5;
    color: white;
    box-shadow: 0 0 0 2px rgba(0,61,165,0.3);
  }

  /* Card styles */
  .card {
    border: 1px solid #E8E4DC;
    border-radius: 24px;
    padding: 0;
    margin: 4px 0;
    background: white;
    box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
    overflow: hidden;
  }
  .card-title {
    font-weight: 700;
    font-size: 19px;
    line-height: 1.3;
    padding: 18px 20px 0;
    margin-bottom: 0;
    color: #232323;
  }
  .card-media {
    cursor: pointer;
    margin: 0;
    border-radius: 24px 24px 0 0;
    overflow: hidden;
    background: linear-gradient(180deg, #FFFFFF 0%, #FBFAF7 100%);
    border-bottom: 1px solid #EEE8DF;
  }
  .card-media:focus-visible { outline: 2px solid #E4002B; outline-offset: 2px; }
  .card-image {
    width: 100%;
    height: 240px;
    object-fit: contain;
    display: block;
    vertical-align: middle;
    padding: 16px;
  }
  .card-price {
    font-weight: 500;
    color: #232323;
    font-size: 16px;
    padding: 0 20px 18px;
  }
  .card-tag {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    margin: 10px 0 0 20px;
  }
  .tag-premium { background: #FDF4E7; color: #C9A95C; }
  .tag-value { background: #E8F5E9; color: #2E7D32; }
  .tag-cooling { background: #E3F2FD; color: #1565C0; }
  .card-similar-btn {
    position: absolute;
    right: 16px;
    bottom: 16px;
    width: 42px;
    height: 42px;
    border-radius: 999px;
    border: 1px solid #E8E4DC;
    background: rgba(255, 255, 255, 0.96);
    color: #232323;
    font-size: 24px;
    line-height: 1;
    font-weight: 500;
    box-shadow: 0 8px 20px rgba(17, 24, 39, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .card-similar-btn:hover {
    background: #FFFFFF;
    transform: scale(1.03);
  }
  .card > p {
    padding: 8px 20px 0;
    color: #5A5A5A;
    font-size: 14px !important;
    line-height: 1.45;
  }
  .card > div[style*="display:flex"] {
    display: flex !important;
    flex-direction: column;
    gap: 0 !important;
    margin: 0 !important;
    border-top: 1px solid #EEE8DF;
  }
  .card > div[style*="display:flex"] > button {
    width: 100%;
    border: 0;
    border-top: 1px solid #EEE8DF;
    border-radius: 0;
    background: #FFFFFF;
    color: #232323;
    padding: 18px 20px;
    font-size: 15px;
    font-weight: 700;
    justify-content: center;
    text-align: center;
  }
  .card > div[style*="display:flex"] > button:first-child {
    border-top: 0;
  }
  .card > div[style*="display:flex"] > button:hover {
    background: #F7F4EF;
    color: #111111;
  }

  /* Button styles */
  button { font-family: inherit; }
  .btn-primary {
    background: #003DA5; color: white; border: none;
    padding: 8px 16px; border-radius: 8px; font-weight: 600;
    font-size: 13px; cursor: pointer; transition: background 0.15s;
  }
  .btn-primary:hover { background: #002D7A; }
  .btn-secondary {
    background: white; color: #0033A0; border: 1px solid #0033A0;
    padding: 8px 16px; border-radius: 8px; font-weight: 600;
    font-size: 13px; cursor: pointer; transition: all 0.15s;
  }
  .btn-secondary:hover { background: #0033A0; color: white; }
  /* Add to cart button */
  .btn-cart {
    background: #2E7D32; color: white; border: none;
    padding: 8px 16px; border-radius: 8px; font-weight: 600;
    font-size: 13px; cursor: pointer; transition: background 0.15s;
  }
  .btn-cart:hover { background: #1B5E20; }

  /* Submit button for multi-select */
  .btn-submit {
    display: block;
    margin-top: 8px;
    background: #003DA5; color: white; border: none;
    padding: 8px 20px; border-radius: 8px; font-weight: 600;
    font-size: 13px; cursor: pointer; transition: background 0.15s;
    width: 100%;
  }
  .btn-submit:hover { background: #002D7A; }

  /* Layout helpers */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .flex-wrap { display: flex; flex-wrap: wrap; gap: 4px; }
</style>
`;

interface InlineHTMLProps {
  html: string;
  id: string;
  className?: string;
}

export function InlineHTML({ html, id, className }: InlineHTMLProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(40);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "rtg-iframe-resize" && iframeRef.current) {
        if (e.source === iframeRef.current.contentWindow) {
          // Height must NEVER clip content. Use the iframe's reported value
          // with a generous max cap. If content exceeds this, the chat
          // scroll container handles the overflow (outer), not the iframe
          // (inner) — so no content is hidden.
          setHeight(Math.min(Math.max(e.data.height, 20), 2000));
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const srcdoc = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${IFRAME_BASE_STYLES}
</head><body>
${html}
${IFRAME_BRIDGE_SCRIPT}
</body></html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      title={`Interactive content ${id}`}
      className={`my-0.5 w-full border-0 ${className ?? ""}`}
      style={{
        height: `${height}px`,
        background: "transparent",
        overflow: "hidden",
        display: "block",
        borderRadius: "8px",
      }}
    />
  );
}
