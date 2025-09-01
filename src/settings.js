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

export function captureKeyCombo(e) {
    let keyCombo = []

    if (e.ctrlKey) keyCombo.push("Ctrl");
    if (e.shiftKey) keyCombo.push("Shift");
    if (e.altKey) keyCombo.push("Alt");
    if (e.metaKey) keyCombo.push("Meta");

    if (!["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
        keyCombo.push(e.key);
    }

    return keyCombo.join("+");
}