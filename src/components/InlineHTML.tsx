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

  // Auto-resize iframe to fit content — tight, no blank space
  function notifyHeight() {
    // Use body scrollHeight for tightest fit
    var h = document.body.scrollHeight;
    window.parent.postMessage({ type: 'rtg-iframe-resize', height: h }, '*');
  }

  new MutationObserver(notifyHeight).observe(document.body, {
    childList: true, subtree: true, attributes: true
  });

  window.addEventListener('load', notifyHeight);
  setTimeout(notifyHeight, 10);
  setTimeout(notifyHeight, 100);
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
  body { padding: 2px 0; }

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
    border: 1px solid #E5E5E5;
    border-radius: 12px;
    padding: 12px;
    margin: 4px 0;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .card-title { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
  .card-price { font-weight: 700; color: #1A1A1A; font-size: 16px; }
  .card-tag {
    display: inline-block; padding: 2px 8px; border-radius: 4px;
    font-size: 11px; font-weight: 600; margin-right: 4px;
  }
  .tag-premium { background: #FDF4E7; color: #C9A95C; }
  .tag-value { background: #E8F5E9; color: #2E7D32; }
  .tag-cooling { background: #E3F2FD; color: #1565C0; }

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
}

export function InlineHTML({ html, id }: InlineHTMLProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(40);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "rtg-iframe-resize" && iframeRef.current) {
        if (e.source === iframeRef.current.contentWindow) {
          // Tight fit — add minimal padding
          setHeight(Math.min(Math.max(e.data.height, 20), 500));
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
      className="my-1 w-full border-0"
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
