// YouTube Focus - Content Script

let styleElement = document.createElement('style');
document.documentElement.appendChild(styleElement);

let currentSpeed = 1.0;
let speedInterval = null;
let adInterval = null;

// Initialize
chrome.storage.local.get(['hideComments', 'hideRecommendations', 'hideAds', 'playbackSpeed'], (result) => {
    applyBlocking(result.hideComments, result.hideRecommendations, result.hideAds);
    if (result.hideAds) {
        startAdSkipper();
    }
    if (result.playbackSpeed) {
        currentSpeed = parseFloat(result.playbackSpeed);
        applySpeed(currentSpeed);
    }
});

// Listen for changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.hideComments || changes.hideRecommendations || changes.hideAds) {
            chrome.storage.local.get(['hideComments', 'hideRecommendations', 'hideAds'], (result) => {
                applyBlocking(result.hideComments, result.hideRecommendations, result.hideAds);
                if (result.hideAds) {
                    startAdSkipper();
                } else {
                    stopAdSkipper();
                }
            });
        }
        if (changes.playbackSpeed) {
            currentSpeed = parseFloat(changes.playbackSpeed.newValue);
            applySpeed(currentSpeed);
        }
    }
});

function applyBlocking(hideComments, hideRecommendations, hideAds) {
    let css = '';

    if (hideComments) {
        css += `
            #comments,
            ytd-comments,
            ytd-comment-simplebox-renderer,
            ytd-comment-renderer {
                display: none !important;
            }
        `;
    }

    if (hideRecommendations) {
        css += `
            #secondary,
            #related,
            ytd-watch-next-secondary-results-renderer {
                display: none !important;
            }
        `;
    }

    if (hideAds) {
        css += `
            ytd-ad-slot-renderer,
            .video-ads,
            .ytp-ad-module,
            .ytd-action-companion-ad-renderer,
            div#root.style-scope.ytd-display-ad-renderer {
                display: none !important;
            }
        `;
    }

    styleElement.textContent = css;
}

function startAdSkipper() {
    if (adInterval) return;
    adInterval = setInterval(() => {
        // Click "Skip Ad" buttons
        const skipButtons = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
        skipButtons.forEach(btn => btn.click());

        // Click "Overlay Close" buttons
        const overlayCloseButtons = document.querySelectorAll('.ytp-ad-overlay-close-button');
        overlayCloseButtons.forEach(btn => btn.click());

        // Fast forward video ads if they are unskippable or just to be sure
        const video = document.querySelector('video');
        const adShowing = document.querySelector('.ad-showing');
        if (video && adShowing) {
            video.playbackRate = 16.0; // Speed up to max
            if (Number.isFinite(video.duration)) {
                video.currentTime = video.duration; // Jump to end if possible
            }
        }
    }, 500);
}

function stopAdSkipper() {
    if (adInterval) {
        clearInterval(adInterval);
        adInterval = null;
    }
}


// --- Overlay Implementation ---

let overlayContainer = null;

function updateOverlayVisibility(enableOverlay) {
    if (enableOverlay) {
        if (!overlayContainer) {
            createOverlay();
        }
        overlayContainer.style.display = 'block';
    } else {
        if (overlayContainer) {
            overlayContainer.style.display = 'none';
        }
    }
}

function createOverlay() {
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'yt-focus-overlay';

    // Shadow DOM to isolate styles
    const shadow = overlayContainer.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        :host {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 2147483647; /* Max z-index */
            font-family: 'Roboto', sans-serif;
        }
        .overlay-box {
            background: rgba(20, 20, 20, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-top: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 20px;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            color: #fff;
            width: 200px;
            overflow: hidden;
            transform-origin: bottom left;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy spring */
            transform: scale(1) translateY(0);
            opacity: 1;
        }
        .overlay-box.minimized {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            cursor: pointer;
            padding: 0;
            background: rgba(20, 20, 20, 0.6) !important; /* Force obscured bg when minimized */
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .overlay-box.minimized .header,
        .overlay-box.minimized .content {
            display: none;
        }
        .minimized-icon {
            display: none;
            font-size: 20px;
        }
        .overlay-box.minimized .minimized-icon {
            display: block;
            animation: popIn 0.3s ease;
        }

        @keyframes popIn {
            0% { transform: scale(0); }
            80% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }

        .header {
            padding: 12px 14px;
            background: linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(255,255,255,0)); /* Subtle gloss */
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .title {
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.3px;
        }
        .minimize-btn {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.1);
            color: #eee;
            cursor: pointer;
            font-size: 12px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        .minimize-btn:hover { background: rgba(255,255,255,0.25); }

        .content {
            padding: 14px;
        }
        .control-row {
            margin-bottom: 14px;
        }
        .control-row:last-child { margin-bottom: 0; }
        
        label {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            cursor: pointer;
            font-weight: 400;
            color: rgba(255,255,255,0.9);
        }
        
        /* Custom Checkbox - Apple style toggle */
        input[type="checkbox"] {
            appearance: none;
            width: 36px;
            height: 20px;
            background: rgba(255,255,255,0.2);
            border-radius: 20px;
            position: relative;
            cursor: pointer;
            transition: background 0.3s;
        }
        input[type="checkbox"]::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 16px;
            height: 16px;
            background: #fff;
            border-radius: 50%;
            transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        input[type="checkbox"]:checked {
            background: #34c759; /* Apple green */
        }
        input[type="checkbox"]:checked::after {
            transform: translateX(16px);
        }

        /* Slider */
        .speed-control {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .speed-header {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: rgba(255,255,255,0.7);
            font-weight: 500;
        }
        input[type="range"] {
            width: 100%;
            appearance: none;
            background: rgba(255,255,255,0.2);
            height: 4px;
            border-radius: 2px;
            outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            background: #fff;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        /* Minimized Icon */
        .minimized-icon {
            display: none;
            font-size: 20px;
            pointer-events: none;
        }
        .overlay-box.minimized .minimized-icon {
            display: block;
        }
        .overlay-box.minimized .header,
        .overlay-box.minimized .content {
            display: none;
        }
    `;

    const wrapper = document.createElement('div');
    // Start minimized by default
    wrapper.className = 'overlay-box minimized';
    wrapper.innerHTML = `
        <div class="header">
            <span class="title">Focus</span>
            <button class="minimize-btn">_</button>
        </div>
        <div class="content">
            <div class="control-row">
                <label>
                    Block Ads
                    <input type="checkbox" id="overlay-ads">
                </label>
            </div>
            <div class="control-row speed-control">
                <div class="speed-header">
                    <span>Speed</span>
                    <span id="overlay-speed-val">1.0x</span>
                </div>
                <input type="range" id="overlay-speed" min="1.0" max="4.0" step="0.1">
            </div>
            <div class="control-row speed-control">
                <div class="speed-header">
                    <span>Opacity</span>
                    <span id="overlay-opacity-val">40%</span>
                </div>
                <input type="range" id="overlay-opacity" min="0.1" max="1.0" step="0.05">
            </div>
        </div>
        <div class="minimized-icon">⚡</div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(wrapper);
    // Use documentElement to ensure it exists and isn't replaced by SPA body changes easily
    // Also ensures it's above body content if z-index fights occur
    document.documentElement.appendChild(overlayContainer);

    // Elements
    const adCheckbox = wrapper.querySelector('#overlay-ads');
    const speedSlider = wrapper.querySelector('#overlay-speed');
    const speedVal = wrapper.querySelector('#overlay-speed-val');
    const opacitySlider = wrapper.querySelector('#overlay-opacity');
    const opacityVal = wrapper.querySelector('#overlay-opacity-val');
    const minimizeBtn = wrapper.querySelector('.minimize-btn');
    const header = wrapper.querySelector('.header');

    // Sync Initial State
    chrome.storage.local.get(['hideAds', 'playbackSpeed', 'overlayOpacity'], (res) => {
        if (res.hideAds !== undefined) adCheckbox.checked = res.hideAds;
        if (res.playbackSpeed !== undefined) {
            speedSlider.value = res.playbackSpeed;
            speedVal.textContent = res.playbackSpeed + 'x';
        }
        const op = res.overlayOpacity !== undefined ? res.overlayOpacity : 0.4;
        opacitySlider.value = op;
        opacityVal.textContent = Math.round(op * 100) + '%';
        // Only apply opacity background if NOT minimized, handled in toggle logic or CSS if possible
        // But for transparency slider we need inline style
        if (!wrapper.classList.contains('minimized')) {
            wrapper.style.background = `rgba(20, 20, 20, ${op})`;
        }
    });

    // Listeners
    adCheckbox.addEventListener('change', (e) => {
        chrome.storage.local.set({ hideAds: e.target.checked });
    });

    speedSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        speedVal.textContent = val + 'x';
        chrome.storage.local.set({ playbackSpeed: val });
        currentSpeed = parseFloat(val);
        applySpeed(currentSpeed);
    });

    opacitySlider.addEventListener('input', (e) => {
        const val = e.target.value;
        opacityVal.textContent = Math.round(val * 100) + '%';
        wrapper.style.background = `rgba(20, 20, 20, ${val})`;
        chrome.storage.local.set({ overlayOpacity: val });
    });

    // Toggle Expansion Logic
    // If minimized, any click expands it.
    // If expanded, click on header or minimize btn collapses it. (or outside? user didn't ask)

    wrapper.addEventListener('click', (e) => {
        // If clicking slider or checkbox, don't collapse unless it's the header/minimize
        if (wrapper.classList.contains('minimized')) {
            wrapper.classList.remove('minimized');
            // Re-apply background opacity
            const currentOp = opacitySlider.value;
            wrapper.style.background = `rgba(20, 20, 20, ${currentOp})`;
        }
    });

    minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        wrapper.classList.add('minimized');
        wrapper.style.background = ''; // Reset to CSS default for minimized
    });

    header.addEventListener('click', (e) => {
        if (!wrapper.classList.contains('minimized')) {
            e.stopPropagation();
            wrapper.classList.add('minimized');
            wrapper.style.background = '';
        }
    });

    // External changes sync
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.hideAds && changes.hideAds.newValue !== adCheckbox.checked) {
            adCheckbox.checked = changes.hideAds.newValue;
        }
        if (changes.playbackSpeed && changes.playbackSpeed.newValue !== speedSlider.value) {
            speedSlider.value = changes.playbackSpeed.newValue;
            speedVal.textContent = changes.playbackSpeed.newValue + 'x';
        }
        if (changes.overlayOpacity && changes.overlayOpacity.newValue !== opacitySlider.value) {
            const val = changes.overlayOpacity.newValue;
            opacitySlider.value = val;
            opacityVal.textContent = Math.round(val * 100) + '%';
            if (!wrapper.classList.contains('minimized')) {
                wrapper.style.background = `rgba(20, 20, 20, ${val})`;
            }
        }
    });
}

// Hook into existing init logic
chrome.storage.local.get(['enableOverlay'], (result) => {
    if (result.enableOverlay) {
        updateOverlayVisibility(true);
    }
});

// Update the main onChanged listener to also handle enableOverlay
// We do this by adding a specific check in the existing listener or adding a new one.
// Since we can have multiple listeners, adding one here for the overlay specific stuff is fine.
chrome.storage.onChanged.addListener((changes) => {
    if (changes.enableOverlay) {
        updateOverlayVisibility(changes.enableOverlay.newValue);
    }
});


// Enforce speed periodically because YouTube can reset it (ads, navigation, etc.)
// and on 'ratechange' event
function enforceSpeed() {
    const video = document.querySelector('video');
    if (video && !video.paused && video.playbackRate !== currentSpeed) {
        // Only force if significantly different to assume it wasn't a minor drift
        // or if we really want to override user manual changes (which we do, based on the slider)
        video.playbackRate = currentSpeed;
    }
}

// Start enforcement loop
if (speedInterval) clearInterval(speedInterval);
speedInterval = setInterval(enforceSpeed, 1000);

// Also listen for navigation events or new video elements
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            const video = document.querySelector('video');
            if (video) {
                video.playbackRate = currentSpeed;
                video.addEventListener('ratechange', () => {
                    // If the rate changes and it's not our target, set it back?
                    // Careful to avoid loops if setting it triggers the event.
                    // We trust manual enforcement or interval for now to avoid fighting too hard.
                    if (Math.abs(video.playbackRate - currentSpeed) > 0.1) {
                        video.playbackRate = currentSpeed;
                    }
                });
            }
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial attachment
const initialVideo = document.querySelector('video');
if (initialVideo) {
    initialVideo.playbackRate = currentSpeed;
    initialVideo.addEventListener('ratechange', () => {
        if (Math.abs(initialVideo.playbackRate - currentSpeed) > 0.1) {
            initialVideo.playbackRate = currentSpeed;
        }
    });
}

// Helper to apply speed
function applySpeed(speed) {
    const video = document.querySelector('video');
    if (video) {
        video.playbackRate = speed;
    }
}
