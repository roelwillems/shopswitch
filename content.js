// content.js — ShopSwitch v1.0.0
// Extracts product details from Amazon pages

(function () {
  "use strict";
  if (window.__shopSwitchRan) return;
  window.__shopSwitchRan = true;

  function extractProductInfo() {
    const info = {
      title: null, price: null, currency: null,
      asin: null, ean: null, isbn10: null, brand: null,
      url: window.location.href,
    };

    // --- Title ---
    const titleEl =
      document.getElementById("productTitle") ||
      document.getElementById("title") ||
      document.querySelector("#centerCol h1 span") ||
      document.querySelector("h1.product-title-word-break span");
    if (titleEl) info.title = titleEl.textContent.trim();

    // --- ASIN ---
    const asinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
    if (asinMatch) {
      info.asin = asinMatch[1];
    } else {
      const asinInput = document.querySelector('input[name="ASIN"]');
      if (asinInput) info.asin = asinInput.value;
    }

    // --- Price ---
    const priceWhole = document.querySelector(".a-price .a-price-whole");
    const priceFraction = document.querySelector(".a-price .a-price-fraction");
    const priceSymbol = document.querySelector(".a-price .a-price-symbol");

    if (priceWhole) {
      const whole = priceWhole.textContent.replace(/[^0-9]/g, "");
      const fraction = priceFraction ? priceFraction.textContent.replace(/[^0-9]/g, "") : "00";
      info.price = parseFloat(`${whole}.${fraction}`);
    }

    if (priceSymbol) {
      info.currency = priceSymbol.textContent.trim();
    } else {
      const priceEl = document.querySelector(".a-price");
      if (priceEl) {
        const text = priceEl.textContent;
        if (text.includes("€")) info.currency = "€";
        else if (text.includes("$")) info.currency = "$";
        else if (text.includes("£")) info.currency = "£";
      }
    }

    // --- Brand ---
    // Amazon NL shows various patterns: "Bezoek de X Store", "De X Store openen",
    // "Brand: X", "Merk: X", "Visit the X Store", etc.
    const brandEl =
      document.getElementById("bylineInfo") ||
      document.querySelector("#brand") ||
      document.querySelector('a[id="bylineInfo"]');
    if (brandEl) {
      info.brand = brandEl.textContent
        // Dutch patterns
        .replace(/^(Bezoek de |De )/i, "")
        .replace(/\s*(Store|Winkel|Shop)\s*(openen|bezoeken|pagina)?\s*$/i, "")
        // English patterns
        .replace(/^(Brand:\s*|Visit the |Merk:\s*)/i, "")
        .replace(/\s*(Store|Shop|Brand)\s*(Page)?\s*$/i, "")
        .trim();
    }

    // --- EAN / ISBN ---
    const detailRows = document.querySelectorAll(
      "#productDetails_techSpec_section_1 tr, #detailBullets_feature_div li, " +
      ".detail-bullet-list span.a-list-item, #productDetails_db_sections tr, " +
      ".prodDetTable tr, #isbn_feature_div .a-list-item"
    );
    let hasIsbnField = false;
    detailRows.forEach((row) => {
      const text = row.textContent;
      if (/EAN|ISBN-13|GTIN|ISBN[-\s]?13/i.test(text)) {
        const m = text.match(/(\d{13})/);
        if (m) info.ean = m[1];
        if (/ISBN/i.test(text)) hasIsbnField = true;
      }
      if (!info.ean && /ISBN-10|ISBN[-\s]?10/i.test(text)) {
        const m = text.match(/(\d{9}[\dXx])/);
        if (m) info.isbn10 = m[1];
        hasIsbnField = true;
      }
    });

    if (!info.ean) {
      const metaIsbn = document.querySelector('meta[name="isbn"], meta[property="book:isbn"]');
      if (metaIsbn) {
        const val = metaIsbn.content?.replace(/[-\s]/g, "");
        if (val?.length === 13) info.ean = val;
        else if (val?.length === 10) info.isbn10 = val;
      }
    }

    // Detect books: ISBN fields, isbn_feature_div, or book:isbn meta tag
    info.isBook = !!(info.isbn10 || hasIsbnField || document.querySelector('#isbn_feature_div, meta[property="book:isbn"]'));

    return info;
  }

  function getAsinFromUrl(url) {
    const m = (url || location.href).match(/\/dp\/([A-Z0-9]{10})/i);
    return m ? m[1] : null;
  }

  function sendProduct(productInfo) {
    chrome.runtime.sendMessage(
      { type: "PRODUCT_DETECTED", product: productInfo },
      () => { if (chrome.runtime.lastError) { /* ignore */ } }
    );
  }

  // Wait for the title element to appear/update, then extract and send
  function waitForTitleAndSend(previousTitle, timeout) {
    const deadline = Date.now() + (timeout || 5000);
    const interval = 200;
    function poll() {
      const info = extractProductInfo();
      if (info.title && info.title !== previousTitle) {
        sendProduct(info);
        return;
      }
      if (Date.now() < deadline) {
        setTimeout(poll, interval);
      } else if (info.title) {
        // Timed out but we have a title — send what we have
        sendProduct(info);
      }
    }
    poll();
  }

  // --- Initial detection ---
  let lastAsin = getAsinFromUrl();
  waitForTitleAndSend(null, 5000);

  // --- SPA navigation detection ---
  let debounceTimer = null;

  function handleNavigation() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const newAsin = getAsinFromUrl();
      if (newAsin && newAsin === lastAsin) return;
      const previousTitle = newAsin !== lastAsin
        ? (document.getElementById("productTitle") || {}).textContent?.trim()
        : null;
      lastAsin = newAsin;
      waitForTitleAndSend(previousTitle, 5000);
    }, 300);
  }

  // Intercept History API for SPA navigations
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  history.pushState = function () {
    origPushState.apply(this, arguments);
    handleNavigation();
  };
  history.replaceState = function () {
    origReplaceState.apply(this, arguments);
    handleNavigation();
  };
  window.addEventListener("popstate", handleNavigation);

  // Keep MutationObserver as a fallback for edge cases
  const observer = new MutationObserver(handleNavigation);
  observer.observe(document.body, { childList: true, subtree: true });
})();
