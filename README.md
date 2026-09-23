# YouTube CMS Auto-Filter & Linkifier

A unified Google Chrome Extension (Manifest V3) designed for YouTube Content Managers and Rights Operations teams. It automates applying search/sorting filters, manages custom filter presets, and linkifies YouTube Video IDs into copyable watch links within **YouTube Studio (CMS / Rights Manager / Manual Claims)**.

---

## 🚀 Key Features

### ⚡ 1. Auto-Filters & Preset Manager
- **Automated Default Filters**: Automatically select and apply default search and sorting parameters whenever you visit YouTube Studio Manual Claims.
- **Custom Presets**: Create, save, and switch between custom filter combinations tailored to your workflow.
- **Floating Quick Bar**: Injects a sleek, non-intrusive floating pill bar into YouTube Studio for 1-click preset switching.

### 🔗 2. Video ID Linkifier & Copy Button
- **Plain-Text Linkification**: Automatically turns plain 11-character Video IDs (`span.video-id`) and `Media ID: <ID>` text into clickable watch URLs (`https://www.youtube.com/watch?v=...`).
- **Interactive Copy Button**: Appends an elegant copy button next to converted links. Clicking it copies the full watch URL to your clipboard with visual checkmark & tooltip feedback.
- **Shadow DOM & SPA Support**: Seamlessly traverses Polymer Web Component Shadow DOM roots and listens for dynamic page updates using debounced `MutationObserver` instances.

---

## 🛠️ Installation (Developer Mode)

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
│   ├── popup.html        # Extension popup UI (Toggles, Presets, JSON Editor)
│   ├── popup.css         # Styling for popup UI
│   └── popup.js          # Popup state & chrome.storage management
├── content/
│   ├── content.js        # Content script (Auto-Filter, Floating Bar, Video ID Linkifier)
│   └── content.css       # Unified styles (Floating Bar, Links, Copy Buttons, Tooltips)
├── scripts/
│   ├── generate-icons.js # Helper script for generating icon assets
│   └── generate-icons.py # Python alternative for icon generation
├── service-worker.js     # Background service worker
└── icons/                # Extension icons (16px, 48px, 128px)
```

---

## 🔑 Permissions & Security

- `storage`: Saves user presets and automation toggles locally in Chrome via `chrome.storage.sync`.
- `tabs`: Enables updating and applying presets to active YouTube Studio tabs.
- `host_permissions`: Restricted strictly to `https://studio.youtube.com/*` and `https://www.youtube.com/*`.

---

## 📄 License

MIT License. Feel free to modify and distribute.
