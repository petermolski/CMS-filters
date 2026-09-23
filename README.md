# YouTube CMS Auto-Filter & Presets

A Google Chrome Extension (Manifest V3) designed for YouTube Content Managers and Rights Operations teams. It automates applying search and sorting filters and provides custom preset management within **YouTube Studio (CMS / Manual Claims)**.

---

## 🚀 Features

- **Automated Default Filters**: Automatically select and apply default search and sorting parameters whenever you open YouTube Studio Manual Claims.
- **Custom Presets**: Create, save, and launch custom filter combinations tailored to your workflow.
- **Modern Extension Popup**: Feature-rich dark UI to configure settings, manage presets, and toggle automated filtering on or off.
- **Fast Performance**: Lightweight Manifest V3 architecture with background service workers and optimized content injection.

---

## 🛠️ Installation (Developer Mode)

Since this extension is in development, you can load it directly into Google Chrome as an unpacked extension:

1. Clone or download this repository:
   ```bash
   git clone <your-repository-url>
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click **Load unpacked**.
5. Select the project directory (`youtube-cms-filter-extension`).

---

## 📁 Project Structure

```
youtube-cms-filter-extension/
├── manifest.json         # Extension Manifest V3 configuration
├── popup/
│   ├── popup.html        # Extension popup interface
│   ├── popup.css         # Styling for popup UI
│   └── popup.js          # Popup UI logic and storage management
├── content/
│   ├── content.js        # Content script injected into studio.youtube.com
│   └── content.css       # Page styling & overlays
├── scripts/
│   ├── generate-icons.js # Helper script for generating icon assets
│   └── generate-icons.py # Python alternative for icon generation
├── service-worker.js     # Background service worker
└── icons/                # Extension icons (16px, 48px, 128px)
```

---

## 🔑 Permissions & Security

- `storage`: Saves user presets and automation settings locally in Chrome.
- `tabs`: Allows interacting with active YouTube Studio tabs to apply filter options.
- `host_permissions`: Strictly restricted to `https://studio.youtube.com/*`.

---

## 📄 License

MIT License. Feel free to modify and distribute.
# CMS-filters
