document.addEventListener('DOMContentLoaded', () => {
    const hideCommentsCheckbox = document.getElementById('hideComments');
    const hideRecommendationsCheckbox = document.getElementById('hideRecommendations');
    const hideAdsCheckbox = document.getElementById('hideAds');
    const enableOverlayCheckbox = document.getElementById('enableOverlay');
    const speedSlider = document.getElementById('speedSlider');
    const speedValueDisplay = document.getElementById('speedValue');

    // Load saved settings
    chrome.storage.local.get(['hideComments', 'hideRecommendations', 'hideAds', 'enableOverlay', 'playbackSpeed'], (result) => {
        if (result.hideComments !== undefined) {
            hideCommentsCheckbox.checked = result.hideComments;
        }
        if (result.hideRecommendations !== undefined) {
            hideRecommendationsCheckbox.checked = result.hideRecommendations;
        }
        if (result.hideAds !== undefined) {
            hideAdsCheckbox.checked = result.hideAds;
        }
        if (result.enableOverlay !== undefined) {
            enableOverlayCheckbox.checked = result.enableOverlay;
        }
        if (result.playbackSpeed !== undefined) {
            speedSlider.value = result.playbackSpeed;
            speedValueDisplay.textContent = `${result.playbackSpeed}x`;
        }
    });

    // Save settings on change
    hideCommentsCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ hideComments: hideCommentsCheckbox.checked });
    });

    hideRecommendationsCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ hideRecommendations: hideRecommendationsCheckbox.checked });
    });

    hideAdsCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ hideAds: hideAdsCheckbox.checked });
    });

    enableOverlayCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ enableOverlay: enableOverlayCheckbox.checked });
    });

    speedSlider.addEventListener('input', () => {
        const speed = speedSlider.value;
        speedValueDisplay.textContent = `${speed}x`;
        chrome.storage.local.set({ playbackSpeed: speed });
    });
});
