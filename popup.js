document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const hideComments = document.getElementById('hideComments');
    const hideRecommendations = document.getElementById('hideRecommendations');
    const hideAds = document.getElementById('hideAds');
    const enableOverlay = document.getElementById('enableOverlay');
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');

    // Helper to get active tab
    function getActiveTab(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
                callback(tabs[0]);
            }
        });
    }

    // Initialize UI from Active Tab State
    getActiveTab((tab) => {
        // Send message to content script to get current state
        chrome.tabs.sendMessage(tab.id, { action: "GET_STATUS" }, (response) => {
            if (chrome.runtime.lastError) {
                // Content script might not be injected (e.g., restricted page or new tab)
                console.log("TranquilView: Could not connect to content script.");
                // Optionally disable controls or show message
                return;
            }

            if (response) {
                // Update UI based on response
                hideComments.checked = response.hideComments;
                hideRecommendations.checked = response.hideRecommendations;
                hideAds.checked = response.hideAds;
                enableOverlay.checked = response.enableOverlay;

                speedSlider.value = response.playbackSpeed;
                speedValue.textContent = response.playbackSpeed + 'x';

                // Brave Handling in Popup
                if (response.isBrave) {
                    hideAds.disabled = true;
                    hideAds.checked = false; // Visual only
                    // Optionally append text to label
                    hideAds.parentElement.previousElementSibling.querySelector('.label-desc').textContent = "Managed by Brave Browser";
                }
            }
        });
    });

    // Listeners for UI Changes
    function sendUpdate(updates) {
        getActiveTab((tab) => {
            chrome.tabs.sendMessage(tab.id, {
                action: "UPDATE_STATUS",
                updates: updates
            });
        });
    }

    hideComments.addEventListener('change', (e) => {
        sendUpdate({ hideComments: e.target.checked });
    });

    hideRecommendations.addEventListener('change', (e) => {
        sendUpdate({ hideRecommendations: e.target.checked });
    });

    hideAds.addEventListener('change', (e) => {
        sendUpdate({ hideAds: e.target.checked });
    });

    enableOverlay.addEventListener('change', (e) => {
        sendUpdate({ enableOverlay: e.target.checked });
    });

    speedSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        speedValue.textContent = val + 'x';
        sendUpdate({ playbackSpeed: val });
    });

});
