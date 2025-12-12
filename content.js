// YouTube Focus - Content Script

// State Management (Per Tab)
let state = {
    hideComments: false,
    hideRecommendations: false,
    hideAds: false,
    playbackSpeed: 1.0,
    overlayOpacity: 0.4,
    enableOverlay: false
};

let isBraveBrowser = false;
let styleElement = document.createElement('style');
document.documentElement.appendChild(styleElement);

let adFrameId = null; // Replaces interval for smoother RAF loop
let ignoreNextRateChange = false; // Flag to prevent loops when we set speed
let overlayRefs = {}; // Store references to overlay elements for updating UI

// Initialize
async function initialize() {
    // Check for Brave Browser
    if (navigator.brave && await navigator.brave.isBrave()) {
        isBraveBrowser = true;
    }

    // Load DEFAULTS from storage, but do not listen for updates (Per-tab isolation)
    chrome.storage.local.get(['hideComments', 'hideRecommendations', 'hideAds', 'playbackSpeed', 'enableOverlay', 'overlayOpacity'], (result) => {
        state.hideComments = result.hideComments || false;
        state.hideRecommendations = result.hideRecommendations || false;
        state.hideAds = result.hideAds || false; // This is user preference. Actual logic checks Brave too.
        state.playbackSpeed = result.playbackSpeed ? parseFloat(result.playbackSpeed) : 1.0;
        // Default Overlay to TRUE if not set
        state.enableOverlay = (result.enableOverlay !== undefined) ? result.enableOverlay : true;
        state.overlayOpacity = result.overlayOpacity || 0.4;

        applyState(); // Apply the blocking and speed

        if (state.enableOverlay) {
            updateOverlayVisibility(true);
        }
    });
}

initialize();

// Apply all blocking logic based on detection and state
function applyState() {
    const effectiveHideAds = isBraveBrowser ? false : state.hideAds;

    // 1. CSS Injection
    let css = '';
    if (state.hideComments) {
        css += `
            #comments,
            ytd-comments,
            ytd-comment-simplebox-renderer,
            ytd-comment-renderer {
                display: none !important;
            }
        `;
    }
    if (state.hideRecommendations) {
        css += `
            #secondary,
            #related,
            ytd-watch-next-secondary-results-renderer {
                display: none !important;
            }
        `;
    }
    if (effectiveHideAds) {
        // PROFESSIONAL STEALTH MODE (Camouflage)
        // We do NOT use display: none, as YouTube detects that.
        // Instead, we make them 1x1 pixels, transparent, and push them off-screen.
        // Valid for static banners.
        css += `
            ytd-ad-slot-renderer,
            .ytd-action-companion-ad-renderer,
            div#root.style-scope.ytd-display-ad-renderer,
            ytd-promoted-sparkles-web-renderer,
            ytd-player-legacy-desktop-watch-ads-renderer {
                opacity: 0.01 !important;
                height: 1px !important;
                width: 1px !important;
                position: absolute !important;
                left: -9999px !important;
                z-index: -1000 !important;
                pointer-events: none !important;
            }
        `;
    }
    styleElement.textContent = css;

    // 2. Ad Skipping (Active)
    if (effectiveHideAds) {
        startStealthSkipper();
    } else {
        stopAdSkipper();
    }

    // 3. Speed
    applySpeed(state.playbackSpeed);
}

// --- Messaging (Popup Communication) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_STATUS") {
        sendResponse({
            ...state,
            isBrave: isBraveBrowser
        });
    } else if (request.action === "UPDATE_STATUS") {
        // Update local state with changes from Popup
        if (request.updates) {
            Object.keys(request.updates).forEach(key => {
                state[key] = request.updates[key];
            });
            applyState();

            // Start/Stop Overlay if changed
            if (request.updates.enableOverlay !== undefined) {
                updateOverlayVisibility(state.enableOverlay);
            }

            // Sync Overlay UI if it exists (e.g. if popup changed speed, overlay slider should wait)
            syncOverlayUI();
        }
    }
});


// --- Speed Control & Sync ---

function applySpeed(speed) {
    const video = document.querySelector('video');
    if (video) {
        // We are setting it, so ignore the next event
        if (Math.abs(video.playbackRate - speed) > 0.01) {
            ignoreNextRateChange = true;
            video.playbackRate = speed;
        }
    }
}

// Native Sync Listener
const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        if (mutation.addedNodes.length) {
            const video = document.querySelector('video');
            if (video && !video.dataset.tvAttached) {
                video.dataset.tvAttached = "true";
                attachVideoListeners(video);
                // Apply initial speed
                if (state.playbackSpeed !== 1.0) {
                    video.playbackRate = state.playbackSpeed;
                }
            }
        }
    });
});
observer.observe(document.body, { childList: true, subtree: true });

// Attach to existing
const existingVideo = document.querySelector('video');
if (existingVideo) {
    attachVideoListeners(existingVideo);
}

function attachVideoListeners(video) {
    video.addEventListener('ratechange', () => {
        if (ignoreNextRateChange) {
            ignoreNextRateChange = false;
            return;
        }

        // If we are here, it's a native change (IDM, YouTube Menu, Keyboard Shortcut)
        // Check if it's an ad
        const adShowing = document.querySelector('.ad-showing, .ad-interrupting');
        if (adShowing) return;

        // Update our state to match native
        const newSpeed = video.playbackRate;
        if (Math.abs(newSpeed - state.playbackSpeed) > 0.01) {
            state.playbackSpeed = newSpeed;
            // console.log("TranquilView: Native speed change detected:", newSpeed);
            syncOverlayUI();
        }
    });
}


// --- Ad Skipper (Time Warp Engine) ---
function startStealthSkipper() {
    if (adFrameId) return; // Already running

    // Helper to simulate native user click (Robust)
    function triggerClick(element) {
        if (!element) return;

        // Standard click
        try { element.click(); } catch (e) { }

        // Mouse events (for stubborn listeners)
        ['mousedown', 'mouseup', 'click'].forEach(evtType => {
            const mouseEvent = new MouseEvent(evtType, {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: 0,
                clientY: 0
            });
            element.dispatchEvent(mouseEvent);
        });
    }

    function loop() {
        const video = document.querySelector('video');

        // 1. Precise Skip Button Targeting
        // YouTube constantly changes these classes. We cast a wide net.
        const possibleSkipSelectors = [
            '.ytp-ad-skip-button',
            '.ytp-ad-skip-button-modern',
            '.videoAdUiSkipButton',
            '.ytp-ad-overlay-close-button',
            '.ytp-skip-ad-button',         // New variation
            'button[id^="skip-button"]',   // ID based
            '.ytp-ad-text.ytp-ad-skip-button-text' // Text container (parent might be button)
        ];

        // Find and click
        possibleSkipSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (el && el.offsetParent !== null) { // Check visibility
                    triggerClick(el);
                    // Also try clicking parent if the element is just text
                    if (el.tagName === 'SPAN' || el.tagName === 'DIV') {
                        triggerClick(el.parentElement);
                    }
                }
            });
        });

        // 2. Video Ad "Time Warp"
        const adShowing = document.querySelector('.ad-showing, .ad-interrupting');
        if (adShowing && video) {
            // Force Mute immediately
            video.muted = true;
            video.volume = 0;

            // Warp to End (Forces 'ended' event)
            if (Number.isFinite(video.duration) && video.duration > 0) {
                if (video.currentTime < video.duration - 0.1) {
                    video.currentTime = video.duration;
                }
            }

            // Speed Override (Fallback if warp fails)
            video.playbackRate = 16.0;
        }

        // High-speed loop using RAF for minimal latency (every screen refresh)
        adFrameId = requestAnimationFrame(loop);
    }

    loop();
}

function stopAdSkipper() {
    if (adFrameId) {
        cancelAnimationFrame(adFrameId);
        adFrameId = null;
    }
}


// --- Overlay UI ---

let overlayContainer = null;

function updateOverlayVisibility(enable) {
    if (enable) {
        if (!overlayContainer) createOverlay();
        overlayContainer.style.display = 'block';
    } else {
        if (overlayContainer) overlayContainer.style.display = 'none';
    }
}

function createOverlay() {
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'yt-focus-overlay';

    const shadow = overlayContainer.attachShadow({ mode: 'open' });

    // Styles (Same as before)
    const style = document.createElement('style');
    style.textContent = `
        :host { position: fixed; bottom: 20px; left: 20px; z-index: 2147483647; font-family: 'Roboto', sans-serif; }
        .overlay-box { background: rgba(20, 20, 20, 0.4); border: 1px solid rgba(255, 255, 255, 0.15); border-top: 1px solid rgba(255, 255, 255, 0.3); border-radius: 20px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); backdrop-filter: blur(16px); width: 200px; overflow: hidden; transform-origin: bottom left; transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); color: #fff; }
        .overlay-box.minimized { width: 44px; height: 44px; border-radius: 50%; cursor: pointer; padding: 0; background: rgba(20, 20, 20, 0.6) !important; display: flex; align-items: center; justify-content: center; }
        .overlay-box.minimized .header, .overlay-box.minimized .content { display: none; }
        .minimized-icon { display: none; font-size: 20px; }
        .overlay-box.minimized .minimized-icon { display: block; animation: popIn 0.3s ease; }
        @keyframes popIn { 0% { transform: scale(0); } 80% { transform: scale(1.2); } 100% { transform: scale(1); } }
        .header { padding: 12px 14px; background: linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(255,255,255,0)); cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .title { font-size: 13px; font-weight: 600; }
        .minimize-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); color: #eee; cursor: pointer; font-size: 12px; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .content { padding: 14px; }
        .control-row { margin-bottom: 14px; } .control-row:last-child { margin-bottom: 0; }
        label { display: flex; align-items: center; justify-content: space-between; font-size: 13px; cursor: pointer; color: rgba(255,255,255,0.9); }
        input[type="checkbox"] { appearance: none; width: 36px; height: 20px; background: rgba(255,255,255,0.2); border-radius: 20px; position: relative; cursor: pointer; transition: background 0.3s; }
        input[type="checkbox"]::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: #fff; border-radius: 50%; transition: transform 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        input[type="checkbox"]:checked { background: #34c759; }
        input[type="checkbox"]:checked::after { transform: translateX(16px); }
        input[type="checkbox"]:disabled { opacity: 0.5; }
        .speed-control { display: flex; flex-direction: column; gap: 8px; }
        .speed-header { display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 500; }
        input[type="range"] { width: 100%; appearance: none; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; outline: none; }
        input[type="range"]::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; background: #fff; border-radius: 50%; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        .brave-msg { font-size: 10px; color: #aaa; margin-top: 4px; display: none; font-style: italic; }
    `;

    const wrapper = document.createElement('div');
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
                <div class="brave-msg" id="brave-msg">Managed by Brave</div>
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
    document.documentElement.appendChild(overlayContainer);

    // Save Refs
    overlayRefs = {
        adCheckbox: wrapper.querySelector('#overlay-ads'),
        speedSlider: wrapper.querySelector('#overlay-speed'),
        speedVal: wrapper.querySelector('#overlay-speed-val'),
        opacitySlider: wrapper.querySelector('#overlay-opacity'),
        opacityVal: wrapper.querySelector('#overlay-opacity-val'),
        wrapper: wrapper,
        braveMsg: wrapper.querySelector('#brave-msg')
    };

    // Initialize UI
    syncOverlayUI();

    // Listeners (Update LOCAL STATE, do NOT save to storage)
    overlayRefs.adCheckbox.addEventListener('change', (e) => {
        if (!isBraveBrowser) {
            state.hideAds = e.target.checked;
            applyState();
        }
    });

    overlayRefs.speedSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        state.playbackSpeed = val; // Update state
        overlayRefs.speedVal.textContent = val + 'x';
        applySpeed(parseFloat(val));
    });

    overlayRefs.opacitySlider.addEventListener('input', (e) => {
        const val = e.target.value;
        state.overlayOpacity = val;
        overlayRefs.opacityVal.textContent = Math.round(val * 100) + '%';
        overlayRefs.wrapper.style.background = `rgba(20, 20, 20, ${val})`;
    });

    // Minimize logic
    overlayRefs.wrapper.addEventListener('click', () => {
        if (overlayRefs.wrapper.classList.contains('minimized')) {
            overlayRefs.wrapper.classList.remove('minimized');
            overlayRefs.wrapper.style.background = `rgba(20, 20, 20, ${state.overlayOpacity})`;
        }
    });

    wrapper.querySelector('.minimize-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        overlayRefs.wrapper.classList.add('minimized');
        overlayRefs.wrapper.style.background = '';
    });

    wrapper.querySelector('.header').addEventListener('click', (e) => {
        if (!overlayRefs.wrapper.classList.contains('minimized')) {
            e.stopPropagation();
            overlayRefs.wrapper.classList.add('minimized');
            overlayRefs.wrapper.style.background = '';
        }
    });
}

function syncOverlayUI() {
    if (!overlayRefs.wrapper) return;

    if (isBraveBrowser) {
        overlayRefs.adCheckbox.disabled = true;
        overlayRefs.adCheckbox.checked = false;
        overlayRefs.braveMsg.style.display = 'block';
    } else {
        overlayRefs.adCheckbox.disabled = false;
        overlayRefs.adCheckbox.checked = state.hideAds;
        overlayRefs.braveMsg.style.display = 'none';
    }

    overlayRefs.speedSlider.value = state.playbackSpeed;
    overlayRefs.speedVal.textContent = state.playbackSpeed + 'x';

    overlayRefs.opacitySlider.value = state.overlayOpacity;
    overlayRefs.opacityVal.textContent = Math.round(state.overlayOpacity * 100) + '%';

    if (!overlayRefs.wrapper.classList.contains('minimized')) {
        overlayRefs.wrapper.style.background = `rgba(20, 20, 20, ${state.overlayOpacity})`;
    }
}
