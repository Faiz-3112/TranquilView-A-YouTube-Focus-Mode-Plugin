# TranquilView: A YouTube Focus Mode Plugin

TranquilView is a Chrome extension designed to help you reclaim your attention while watching YouTube. It eliminates distractions like comments, recommendations, and ads, providing a serene and focused viewing experience.

<img src="icons/icon128.png" alt="TranquilView Icon" width="64"/>

## Disclaimer
This project is developed strictly for educational and learning purposes. Its primary objective is to demonstrate the architecture and development lifecycle of a modern browser extension. It serves as a practical case study in DOM manipulation and state management within a Chromium environment.

## Features

-   **Ad Blocking**: Automatically skips video ads and hides banner ads for an uninterrupted experience.
-   **Hide Comments**: Remove the comments section to avoid toxic discussions and spoilers.
-   **Hide Recommendations**: Hide the sidebar and end-screen video recommendations to prevent "doom-scrolling."
-   **Enhanced Video Speed**: Control playback speed with precision (up to 4.0x) using a custom slider.
-   **Floating Overlay**: A beautiful, draggable "water-drop" style bubble in the bottom-left corner gives you quick access to toggles and speed controls.
-   **Glassmorphism UI**: A premium, modern Apple-style interface with transparency effects.

## Installation

Since this extension is manually installed (unpacked), follow these steps:

1.  **Clone or Download** this repository:
    ```bash
    git clone https://github.com/Faiz-3112/TranquilView-A-YouTube-Focus-Mode-Plugin.git
    ```
    Or download the ZIP and extract it.

2.  Open **Google Chrome** (or any Chromium-based browser like Brave or Edge).

3.  Navigate to the Extensions page:
    -   Type `chrome://extensions` in the address bar and hit Enter.

4.  **Enable Developer Mode**:
    -   Toggle the switch in the top-right corner of the page.

5.  **Load Unpacked**:
    -   Click the "Load unpacked" button that appears in the top-left.
    -   Select the folder where you cloned/extracted `TranquilView`.

6.  **Pin the Extension**:
    -   Click the puzzle piece icon in your browser toolbar and pin **TranquilView** for easy access.

## Usage

### The Popup Menu
Click the TranquilView icon in your toolbar to open the main menu:
-   **Toggle Switches**: Turn specific features (Comments, Recommendations, Ads, Overlay) on or off globally.
-   **Speed Slider**: Set your preferred default playback speed.

### The Floating Overlay
When watching a video, a small lightning bolt bubble appears in the bottom-left corner.
-   **Click to Expand**: reveals quick controls.
-   **Speed Control**: Adjust speed slightly for specific videos without saving it as the global default.
-   **Opacity Slider**: Adjust the transparency of the overlay to blend perfectly with your video.

## Credits

Developed by **ZamiTech**.

**Repository**: [https://github.com/Faiz-3112/TranquilView-A-YouTube-Focus-Mode-Plugin](https://github.com/Faiz-3112/TranquilView-A-YouTube-Focus-Mode-Plugin)
