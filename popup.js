// popup.js — ShopSwitch v1.0.0

const $ = (id) => document.getElementById(id);
const content = $("content");
const VERSION = "1.0.0";

const SHOPS = {
  bol:    { name: "bol.",   color: "#0000A4" },
  libris: { name: "Libris", color: "#E84E0F" },
};

$("settingsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function formatPrice(price) {
  if (price == null) return "–";
  return `€${price.toFixed(2).replace(".", ",")}`;
}

function matchPctClass(score) {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function priceDiffHtml(bolPrice, amazonPrice) {
  if (bolPrice == null || amazonPrice == null) return "";
  const diff = bolPrice - amazonPrice;
  const pct = ((diff / amazonPrice) * 100).toFixed(0);
  if (Math.abs(diff) < 0.01) return "";

  if (diff < 0) {
    return `<span class="price-diff save">Save €${Math.abs(diff).toFixed(2)} (${Math.abs(pct)}%)</span>`;
  }
  return `<span class="price-diff more">+€${diff.toFixed(2)} (+${pct}%)</span>`;
}

function priceColorClass(bolPrice, amazonPrice) {
  if (bolPrice == null || amazonPrice == null) return "neutral";
  if (bolPrice < amazonPrice) return "cheaper";
  if (bolPrice > amazonPrice) return "pricier";
  return "neutral";
}

function specDiffHtml(specDiffs, shopName) {
  if (!specDiffs || !specDiffs.length) return "";
  const sn = shopName || "bol.";
  const items = specDiffs.map(d =>
    `<div class="spec-diff-item">
      <span class="spec-name">${d.label}:</span>
      <span class="spec-values">Amazon ${d.amazon} → ${escHtml(sn)} ${d.bol}</span>
    </div>`
  ).join("");
  return `<div class="spec-diff-banner">
    <div class="label">⚠ Spec difference detected</div>
    ${items}
  </div>`;
}

function statusBarHtml(statusClass, text) {
  return `<div class="status-bar ${statusClass}"><span class="status-dot"></span>${text}</div>`;
}

function renderMatch(result, amazonPrice, shop, searchUrl) {
  const shopName = shop?.name || "bol.";
  const shopColor = shop?.color || "#0000A4";

  const matchClass = result.matchType === "approximate" ? "approx" : matchPctClass(result.matchScore);
  const matchLabel = result.matchType === "approximate"
    ? `≈ ${result.matchScore}%`
    : `${result.matchScore}% match`;

  const linkUrl = result.url;
  const isUnavailable = result.available === false;
  const cardClass = isUnavailable ? "match-card unavailable" : "match-card";

  const priceStr = formatPrice(result.price);
  const colorClass = priceColorClass(result.price, amazonPrice);
  const diffStr = isUnavailable ? "" : priceDiffHtml(result.price, amazonPrice);
  const unavailBadge = isUnavailable ? `<span class="unavailable-badge">Not available</span>` : "";

  return `
    <div class="${cardClass}" data-url="${escAttr(linkUrl)}">
      <div class="card-header">
        <span class="store-badge" style="background:${shopColor}">${escHtml(shopName)}</span>
        ${unavailBadge}
        <span class="match-pct ${matchClass}">${matchLabel}</span>
      </div>
      <div class="product-title">${escHtml(result.title)}</div>
      <div class="price-row">
        <span class="bol-price ${colorClass}">${priceStr}</span>
        ${diffStr}
      </div>
      ${specDiffHtml(result.specDiffs, shopName)}
      ${searchUrl ? `<a href="${escAttr(searchUrl)}" target="_blank" class="card-search-link">More options on ${escHtml(shopName)} →</a>` : ""}
      <span class="arrow-icon">›</span>
    </div>`;
}

function renderAlternative(alt, amazonPrice, shop) {
  if (!alt) return "";
  const shopName = shop?.name || "bol.";
  const linkUrl = alt.url;
  const diffStr = priceDiffHtml(alt.price, amazonPrice);
  return `
    <div class="alternative" data-url="${escAttr(linkUrl)}">
      <div class="alt-header">Also found on ${escHtml(shopName)}</div>
      <div class="alt-title">${escHtml(alt.title)}</div>
      <div class="alt-meta">
        <span class="alt-price">${formatPrice(alt.price)}</span>
        ${diffStr}
        <span class="alt-match">${alt.matchScore}% match</span>
      </div>
    </div>`;
}

function escHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escAttr(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Attach click handlers to all elements with data-url attributes.
 * This is required because Manifest V3 CSP blocks inline onclick handlers.
 */
function attachClickHandlers() {
  content.querySelectorAll("[data-url]").forEach((el) => {
    el.addEventListener("click", () => {
      const url = el.getAttribute("data-url");
      if (url && url !== "#") chrome.tabs.create({ url });
    });
  });

  // Also handle footer links and in-card search links (regular <a> tags with target="_blank")
  content.querySelectorAll('a[target="_blank"]').forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = el.getAttribute("href");
      if (url && url !== "#") chrome.tabs.create({ url });
    });
  });
}

function render(data) {
  if (!data || data.status === "no_data") {
    content.innerHTML = `
      <div class="empty-state">
        <div class="icon">🛍️</div>
        <h3>No product detected</h3>
        <p>Browse to a product page on Amazon to see alternatives on bol.</p>
      </div>
      <div class="footer">
        <span class="version">ShopSwitch v${VERSION}</span>
      </div>`;
    return;
  }

  if (data.status === "loading") {
    content.innerHTML = `
      ${statusBarHtml("loading", "Searching bol. for this product…")}
      ${amazonBar(data.amazonProduct)}
      <div class="empty-state">
        <div class="icon" style="animation: pulse 1.2s infinite">🔍</div>
        <p>Checking EAN databases and bol. catalogue…</p>
      </div>`;
    return;
  }

  if (data.status === "error") {
    content.innerHTML = `
      ${statusBarHtml("error", "Something went wrong")}
      ${amazonBar(data.amazonProduct)}
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h3>Search failed</h3>
        <p>${escHtml(data.error || "Please try refreshing the page.")}</p>
      </div>`;
    return;
  }

  if (data.status === "not_found") {
    const shopResults = data.shopResults || {};
    const searchedShopIds = Object.keys(shopResults);
    const shopNames = searchedShopIds.map(id => SHOPS[id]?.name || id);
    const notFoundText = shopNames.length > 1
      ? `Not found on ${shopNames.join(" or ")}`
      : `Not found on ${shopNames[0] || "bol."}`;
    const footerLinks = searchedShopIds.length > 0
      ? searchedShopIds.map(shopId => {
          const shop = SHOPS[shopId] || { name: shopId };
          const url = shopResults[shopId]?.searchUrl || "#";
          return `<a href="${escAttr(url)}" target="_blank">Search ${escHtml(shop.name)} →</a>`;
        }).join(" · ")
      : `<a href="${escAttr(data.bolResults?.searchUrl || "#")}" target="_blank">Search bol. manually →</a>`;
    content.innerHTML = `
      ${statusBarHtml("not-found", notFoundText)}
      ${amazonBar(data.amazonProduct)}
      <div class="empty-state">
        <div class="icon">🔎</div>
        <h3>No match found</h3>
        <p>This product doesn't appear to be available, or it may be listed under a different name.</p>
      </div>
      <div class="footer">
        <div>${footerLinks}</div>
        <span class="version">v${VERSION}</span>
      </div>`;
    attachClickHandlers();
    return;
  }

  // Found — render results from all shops
  const ap = data.amazonProduct.price;
  const shopResults = data.shopResults || {};

  // Collect shops that have results
  const shopsWithResults = Object.entries(shopResults)
    .filter(([_, r]) => r?.results?.length > 0);
  const shopCount = shopsWithResults.length;

  // Find best result across all shops for status bar
  let bestResult = null;
  let bestShopId = null;
  for (const [shopId, r] of shopsWithResults) {
    const candidate = r.results[0];
    if (!bestResult || (candidate.rankScore || 0) > (bestResult.rankScore || 0)) {
      bestResult = candidate;
      bestShopId = shopId;
    }
  }

  const bp = bestResult?.price;
  const mt = bestResult?.matchType || "exact";
  const bestShopName = SHOPS[bestShopId]?.name || bestShopId;

  let statusClass, statusText;
  if (shopCount > 1) {
    statusClass = "found-neutral";
    statusText = `Found on ${shopCount} shops`;
  } else if (bestResult?.available === false) {
    statusClass = "found-unavailable";
    statusText = `Found on ${bestShopName} — currently unavailable`;
  } else if (mt === "approximate") {
    statusClass = "found-approx";
    statusText = "Similar product found — specs may differ";
  } else if (bp != null && ap != null) {
    if (bp < ap) { statusClass = "found-cheaper"; statusText = `Cheaper on ${bestShopName}!`; }
    else if (bp > ap) { statusClass = "found-pricier"; statusText = `Found on ${bestShopName} — but pricier`; }
    else { statusClass = "found-neutral"; statusText = `Same price on ${bestShopName}`; }
  } else {
    statusClass = "found-neutral";
    statusText = `Found on ${bestShopName}`;
  }

  // Method note from first shop with a product-code method
  const allMethods = shopsWithResults.map(([_, r]) => r.searchMethod || "").filter(Boolean);
  const codeMethod = allMethods.find(m => m.includes("EAN") || m.includes("ISBN"));
  const methodNote = codeMethod
    ? `<span style="font-size:10px;color:var(--ss-text-dim);margin-left:auto">via ${escHtml(codeMethod)}</span>` : "";

  // Render shop cards
  const shopCards = shopsWithResults.map(([shopId, shopData]) => {
    const shop = SHOPS[shopId] || { name: shopId, color: "#666" };
    return renderMatch(shopData.results[0], ap, shop, shopData.searchUrl);
  }).join("");

  // Show alternative only for the first shop (to keep it clean)
  const firstShopData = shopsWithResults[0]?.[1];
  const firstShopId = shopsWithResults[0]?.[0];
  const alt = firstShopData?.alternative;
  const altShop = SHOPS[firstShopId];
  const altHtml = alt ? renderAlternative(alt, ap, altShop) : "";

  content.innerHTML = `
    ${statusBarHtml(statusClass, statusText + methodNote)}
    ${amazonBar(data.amazonProduct)}
    ${shopCards}
    ${altHtml}
    <div class="footer">
      <span class="version">ShopSwitch v${VERSION}</span>
    </div>`;

  attachClickHandlers();
}

function amazonBar(product) {
  if (!product) return "";
  return `
    <div class="amazon-bar">
      <div class="label">Amazon product</div>
      <div class="title">${escHtml(product.title)}</div>
      ${product.price != null ? `<div class="price">${product.currency || "€"}${product.price.toFixed(2).replace(".", ",")}</div>` : ""}
    </div>`;
}


// Load results
chrome.runtime.sendMessage({ type: "GET_RESULTS" }, (response) => {
  if (chrome.runtime.lastError) {
    render(null);
    return;
  }
  render(response);
});
