// settings.js — ShopSwitch v1.0.0

const badgePrice = document.getElementById("badgePrice");
const bolEnabled = document.getElementById("bolEnabled");
const librisEnabled = document.getElementById("librisEnabled");
const storesWarning = document.getElementById("storesWarning");
const savedMsg = document.getElementById("savedMsg");

// Load saved settings
chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
  if (chrome.runtime.lastError) return;
  badgePrice.checked = settings.badgeStyle === "price";
  bolEnabled.checked = settings.bolEnabled !== false;
  librisEnabled.checked = settings.librisEnabled !== false;
  updateStoresWarning();
});

function updateStoresWarning() {
  storesWarning.style.display = (!bolEnabled.checked && !librisEnabled.checked) ? "block" : "none";
}

// Auto-save on any toggle change
function saveSettings() {
  updateStoresWarning();
  const settings = {
    badgeStyle: badgePrice.checked ? "price" : "neutral",
    bolEnabled: bolEnabled.checked,
    librisEnabled: librisEnabled.checked,
  };
  chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings }, () => {
    savedMsg.classList.add("show");
    setTimeout(() => savedMsg.classList.remove("show"), 2000);
  });
}

badgePrice.addEventListener("change", saveSettings);
bolEnabled.addEventListener("change", saveSettings);
librisEnabled.addEventListener("change", saveSettings);
