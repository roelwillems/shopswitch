# ShopSwitch — Find it locally, buy it smarter

**Version 1.0.0**

ShopSwitch is a Chrome extension that automatically finds equivalent products on bol.com when you browse Amazon. Compare prices instantly, see match quality, and switch to local EU stores with one click.

## Features

- **Automatic product detection** on Amazon (.nl, .de, .com, .co.uk, .fr, .es, .it)
- **Smart matching** using EAN barcodes, UPCitemdb lookup, and weighted title similarity
- **Bilingual search** — searches bol.com in both English and Dutch for best results
- **Match quality indicator** — see how confident the match is (0–100%)
- **Price comparison** with savings/premium display in € and %
- **Spec difference detection** — highlights when quantities, sizes, or pack counts differ
- **Alternative matches** — shows a secondary match when available
- **Affiliate support** — possibly added in the future, optional referral links that support development at no cost to you

## How it works

ShopSwitch uses a cascading search strategy:

1. **EAN barcode** extracted from the Amazon page (most precise)
2. **ISBN-10** for books
3. **UPCitemdb API** — resolves product EAN from a 495M+ product database (free tier, 100/day)
4. **Text search (English)** — brand + product title on bol.com, validated by weighted similarity
5. **Text search (Dutch)** — translated query for products listed in Dutch on bol.com

Results are validated against the Amazon product using weighted scoring that prioritizes brand names, model identifiers, and differentiating specs (quantities, storage sizes, etc.) over generic terms.

## Installation

1. Download and unzip `shopswitch.zip`
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `shopswitch` folder
5. Browse to any Amazon product page — ShopSwitch activates automatically

## Badge indicators

| Badge | Meaning |
|-------|---------|
| ✓ (green) | Found on bol.com, same or cheaper price |
| ✓ (red) | Found on bol.com, but more expensive |
| ≈ (purple) | Similar product found, specs may differ |
| ✗ (grey) | Not found on bol.com |
| … (blue) | Searching... |

## Settings

Click the ⚙ icon in the popup to configure:

- Disabled currently **Affiliate support** — Enable referral links to support ShopSwitch development (costs you nothing)
- **Stores** — Currently bol.com; more EU stores coming soon

## Roadmap

ShopSwitch is built to expand across the EU. Future plans include:

- 🏪 Expand with other Dutch and EU shop integration
- 🇪🇺 Multi-country support via shopswitch.eu
- 📊 Price history tracking
- 🔔 Price drop notifications

## Technical notes

- Manifest V3 Chrome extension
- No backend required — all searches happen client-side
- UPCitemdb free tier: 100 requests/day (graceful fallback to text search)
- Uses `chrome.storage.session` for tab persistence and `chrome.storage.sync` for settings
- Bol.com has no public API — the extension parses HTML search results

## Links

- Website: [shopswitch.eu](https://shopswitch.eu)
- Website: [shopswitch.nl](https://shopswitch.nl)

---

*ShopSwitch v1.0.0 — Find it locally, buy it smarter*
