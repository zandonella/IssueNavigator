const DEFAULT_SETTINGS = {
    nextKey: "ArrowRight",
    prevKey: "ArrowLeft",
    type: "Current",
    status: "All"
};

export async function getSettings() {
    console.log("Loading settings...");
    const saved = await chrome.storage.sync.get("SETTINGS");
    console.log("Settings loaded:", { ...DEFAULT_SETTINGS, ...saved.SETTINGS });
    return { ...DEFAULT_SETTINGS, ...saved.SETTINGS };
}