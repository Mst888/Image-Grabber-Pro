# Photo-Grab 📸

**Photo-Grab** is a professional, high-performance web extension designed for power users who need to select, organize, and download images from the web with precision and speed.

---

## 🌟 Key Features

### 🎯 Precision Selection
- **Area Selection**: Drag a rectangle over the webpage to select multiple images at once.
- **Smart Filters**: Instantly find high-resolution images (800x600+) or specific formats.
- **Same Size Mode**: Select one image and automatically find all other images on the page with matching dimensions.
- **Visual Feedback**: Real-time blue outlines and index badges keep you informed of your selection.

### 📦 Power Downloads (v1.6+)
- **ZIP Bundling**: Pack your entire selection into a single `.zip` archive for a cleaner download experience.
- **Smart Naming Templates**: Use dynamic variables like `{site}`, `{title}`, and `{index}` to automatically name your files.
- **Subfolder Support**: Organize downloads into custom subfolders directly from the popup.

### 🎨 Premium UI/UX
- **Compact Popup**: A streamlined **300x500** interface that stays out of your way.
- **Modern Themes**: Choose from several premium themes, including **Onyx Gray**, **Spotify Green**, and **Classic Blue**.
- **Floating Toolbar**: A non-intrusive on-page toolbar for quick actions without opening the popup.

---

## 🛠️ Build Instructions

This repository contains the source code for **Photo-Grab**. Follow these steps to build the extension from source:

### 1. Environment Requirements
- **Node.js**: v18.x or higher.
- **npm**: v9.x or higher.

### 2. Installation
```bash
npm install
```

### 3. Packaging
To generate a distributable `.zip` file:
```bash
npm run build
```
The resulting package will be in the `web-ext-artifacts/` directory.

---

## 📄 Source Code Policy
- **Vanilla JS**: No transpilation, minification, or obfuscation is applied.
- **Human Readable**: The code is provided in its original form for full transparency.

**Author**: Mst888 
**Version**: 1.6.5
