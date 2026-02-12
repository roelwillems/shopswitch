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
    const brandEl =
      document.getElementById("bylineInfo") ||
      document.querySelector("#brand") ||
      document.querySelector('a[id="bylineInfo"]');
    if (brandEl) {
      info.brand = brandEl.textContent
        .replace(/^(Brand:\s*|Bezoek de |Visit the |Merk:\s*)/i, "")
        .replace(/(-?store|-?winkel|-?Shop)$/i, "")
        .trim();
    }

    // --- EAN / ISBN ---
    const detailRows = document.querySelectorAll(
      "#productDetails_techSpec_section_1 tr, #detailBullets_feature_div li, " +
      ".detail-bullet-list span.a-list-item, #productDetails_db_sections tr, " +
      ".prodDetTable tr, #isbn_feature_div .a-list-item"
    );
    detailRows.forEach((row) => {
      const text = row.textContent;
      if (/EAN|ISBN-13|GTIN|ISBN[-\s]?13/i.test(text)) {
        const m = text.match(/(\d{13})/);
        if (m) info.ean = m[1];
      }
      if (!info.ean && /ISBN-10|ISBN[-\s]?10/i.test(text)) {
        const m = text.match(/(\d{9}[\dXx])/);
        if (m) info.isbn10 = m[1];
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

    return info;
  }

  setTimeout(() => {
    const productInfo = extractProductInfo();
    if (!productInfo.title) return;
    chrome.runtime.sendMessage(
      { type: "PRODUCT_DETECTED", product: productInfo },
      () => { if (chrome.runtime.lastError) { /* ignore */ } }
    );
  }, 1500);

  // SPA navigation detection
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      window.__shopSwitchRan = false;
      setTimeout(() => {
        const productInfo = extractProductInfo();
        if (productInfo.title) {
          chrome.runtime.sendMessage(
            { type: "PRODUCT_DETECTED", product: productInfo },
            () => { if (chrome.runtime.lastError) { /* ignore */ } }
          );
        }
      }, 2000);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
