# Photo-Grab 📸

Photo-Grab: A professional browser extension for quickly selecting and bulk-downloading high-resolution images from web pages, with smart naming and ZIP packaging — ideal for content creators, researchers, and visual collectors.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg) ![Version: 1.7.1](https://img.shields.io/badge/Version-1.7.1-blue)[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-orange)]((https://www.buymeacoffee.com/mst888))

---

## Contents
- [Quick Overview](#quick-overview)
- [Features](#features)
- [Screenshots — Organized by Feature](#screenshots--organized-by-feature)
- [Installation — Step by Step](#installation---step-by-step)
  - [Manifest Files (View Directly)](#manifest-files-view-directly)
  - [Option A — Ready Package (for users)](#option-a---ready-package-for-users)
  - [Option B — From Source (for developers)](#option-b---from-source-for-developers)
  - [Option C — Manual / Manifest Testing](#option-c---manual--manifest-testing)
- [Quick Usage — 3 Steps](#quick-usage---3-steps)
- [Security & Permissions](#security--permissions)
- [Contributing & Support](#contributing--support)
- [License & Info](#license--info)

---

## Quick Overview
- Target audience: Power users who collect images (editors, researchers, content creators).  
- Value proposition: Scan a page, select desired images, apply smart naming, and download them as organized ZIP archives.

---

## Features
- Area Selection: Draw a rectangle on the page to select multiple images (blue outline + index badges).  
- Same Size Mode & Smart Filters: Select one image to find others with the same dimensions or filter by resolution/file type.  
- ZIP Bundling & Smart Naming: Package selections into a single .zip and use dynamic naming variables like `{site}`, `{title}`, `{index}`; supports subfolders.  
- Compact Popup (300x500) + Floating Toolbar: Fast access and controls without interrupting browsing.  
- Themes: Onyx Gray, Spotify Green, Classic Blue.  
- Developer friendly: Manifest files included in repo; supports unpacked loading and web-ext testing.

---

## Screenshots — Organized by Feature
(Each image includes a short caption so visitors immediately understand what they’re seeing.)

### 1) Area Selection — Draw & Visual Feedback
<img alt="Area selection with badges" src="https://github.com/user-attachments/assets/e9e421f4-110f-4b49-96be-e3d2fa2a4546" />
*Draw a rectangle on the page to select multiple images; blue outline and index badges appear.*

<img alt="Selection badges and overlay" src="https://github.com/user-attachments/assets/d3f288ec-9b25-4a26-b499-880216014cb1" />
*Selected images are indexed and a selection summary is shown.*

---

### 2) Popup UI & Floating Toolbar — Fast Access
<img alt="Compact popup UI" src="https://github.com/user-attachments/assets/298bd574-fff3-4c1f-828c-a926170a702d" />
*Compact popup (300x500) — filters, naming, and download options.*

<img alt="Floating toolbar on page" src="https://github.com/user-attachments/assets/248fb72f-a54e-4928-a654-b2d0ab791865" />
*Floating toolbar for quick on-page actions without opening the popup.*

<img alt="Popup themes and list" src="https://github.com/user-attachments/assets/f14c2416-d366-4b63-9c7a-87a455e60e3c" />
*Popup list view and theme preview.*

---

### 3) Same Size Mode & Smart Filters
<img alt="Same size mode and filters" src="https://github.com/user-attachments/assets/d3f288ec-9b25-4a26-b499-880216014cb1" />
*Select one image to automatically capture all images with the same dimensions; use filters to target high-resolution items.*

---

### 4) Bulk Download, ZIP Bundling & Smart Naming
<img alt="ZIP bundling and download flow" src="https://github.com/user-attachments/assets/a69935cf-dfe0-4671-bd6f-848fa8d653cf" />
*Package your selection into a .zip for a clean bulk download experience.*

<img alt="Naming templates and subfolders" src="https://github.com/user-attachments/assets/9c086134-86b1-432e-9dda-1e6736a417c6" />
*Dynamic naming templates and subfolder support for organized archives.*

---

### 5) Themes & Settings — Customize the Look
<img alt="Theme example 1" src="https://github.com/user-attachments/assets/85b26c08-03de-4520-bc71-0cc83e42ed0b" />
<img alt="Theme example 2" src="https://github.com/user-attachments/assets/68550f78-f1a2-476b-a96c-97e04f42e68f" />
<img alt="Theme example 3" src="https://github.com/user-attachments/assets/81e4a89d-601b-4b78-ac85-a415c3d90517" />
*Theme options and settings screen examples.*

---

### 6) Mobile / Responsive Preview
<img alt="Mobile preview 1" src="https://github.com/user-attachments/assets/bf741b1b-f774-43ee-84f3-bb3a39b33aa8" />
<img alt="Mobile preview 2" src="https://github.com/user-attachments/assets/24fc9f24-b24f-4234-a047-bb9cca9beccb" />
<img alt="Mobile preview 3" src="https://github.com/user-attachments/assets/5573876b-c0fc-43a3-a8da-492bbe7c17ed" />
*Mobile previews — the extension is primarily desktop-focused; these show some responsive cases.*

---

## Installation — Step by Step

Full installation instructions (installation file): https://github.com/Mst888/Photo-Grab/blob/b4b99e8f22b4f8bcaf4828e6ae435761810784f1/kurulum.txt

### Manifest Files (View Directly)
- manifest (repo): https://github.com/Mst888/Photo-Grab/blob/b4b99e8f22b4f8bcaf4828e6ae435761810784f1/manifest.json  
- manifest.chrome (repo): https://github.com/Mst888/Photo-Grab/blob/b4b99e8f22b4f8bcaf4828e6ae435761810784f1/manifest.chrome.json  
- Raw manifest: https://raw.githubusercontent.com/Mst888/Photo-Grab/b4b99e8f22b4f8bcaf4828e6ae435761810784f1/manifest.json  
- Raw manifest.chrome: https://raw.githubusercontent.com/Mst888/Photo-Grab/b4b99e8f22b4f8bcaf4828e6ae435761810784f1/manifest.chrome.json

---

### Option A — Ready Package (for users)
1. Download the latest package from Releases or the `web-ext-artifacts/` folder (.zip).  
2. Chrome:
   - Open chrome://extensions/, enable "Developer mode" in the top-right.  
   - Click "Load unpacked" and select the folder containing the extracted zip contents.  
3. Firefox:
   - Open about:debugging#runtime → "This Firefox" → "Temporary Add-on" → select the `manifest.json` from the extracted folder or install the .xpi.

Note: For Chrome-specific manifest V3 settings, consult `manifest.chrome.json` in the repo. The build script copies the appropriate manifest where needed.

---

### Option B — From Source (for developers)
1. Clone the repo:
```bash
git clone https://github.com/Mst888/Photo-Grab.git
cd Photo-Grab
```
2. Install dependencies:
```bash
npm install
```
3. Build / package:
```bash
npm run build
```
4. Load the output:
- Output folder: use the build produced in `web-ext-artifacts/`.  
- Chrome: chrome://extensions → Load unpacked → select the build folder.  
- Firefox: `npx web-ext run --source-dir=./src` for quick local testing.

Developer tip:
```bash
npx web-ext run --source-dir=./src
```

---

### Option C — Manual / Manifest Testing
1. Download the raw manifest files from the links above.  
2. Create a new folder and place the manifest plus required assets (popup HTML/CSS/JS, icons, content scripts) into it.  
3. chrome://extensions → Load unpacked → select the folder.

Note: A manifest alone is not sufficient — all referenced files must be in the folder.

---

## Quick Usage — 3 Steps
1. Draw a rectangle on the page to select images (Area Selection).  
2. Adjust filters, Same Size, and naming templates in the popup.  
3. Click "Download" to create a ZIP and save your organized archive.

---

## Security & Permissions
- Required permissions: activeTab / host permissions (listed clearly in the manifest).  
- Privacy: The extension does not collect personal data; it only accesses selected image URLs and image data for download purposes. Review the manifest files to verify permissions.

---

## Contributing & Support
- Open an issue for bugs or feature requests.  
- To add a demo GIF or short video to the README, upload the file to the repo and I will place it in the README.

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-orange)]((https://www.buymeacoffee.com/mst888))
---

## License & Info
- License: MIT  
- Author: Mst888  
- Version: 1.7.1






