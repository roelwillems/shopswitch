// settings.js — ShopSwitch v1.0.0

const affiliateEnabled = document.getElementById("affiliateEnabled");
const saveBtn = document.getElementById("saveBtn");
const savedMsg = document.getElementById("savedMsg");

// Load saved settings
chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
  if (chrome.runtime.lastError) return;
  affiliateEnabled.checked = settings.affiliateEnabled || false;
});

// Save
saveBtn.addEventListener("click", () => {
  const settings = {
    affiliateEnabled: affiliateEnabled.checked,
  };
  chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings }, () => {
    savedMsg.classList.add("show");
    setTimeout(() => savedMsg.classList.remove("show"), 2000);
  });
});
