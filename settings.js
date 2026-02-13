// settings.js — ShopSwitch v1.0.0

const badgePrice = document.getElementById("badgePrice");
const savedMsg = document.getElementById("savedMsg");

// Load saved settings
chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
  if (chrome.runtime.lastError) return;
  badgePrice.checked = settings.badgeStyle === "price";
});

// Auto-save on any toggle change
function saveSettings() {
  const settings = {
    badgeStyle: badgePrice.checked ? "price" : "neutral",
  };
  chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings }, () => {
    savedMsg.classList.add("show");
    setTimeout(() => savedMsg.classList.remove("show"), 2000);
  });
}

badgePrice.addEventListener("change", saveSettings);
