const DEFAULT_SETTINGS = {
    nextKey: "ArrowRight",
    prevKey: "ArrowLeft",
    type: "current",
    status: "open",
    sort: "created",
    direction: "desc"
};

export const CLIENT_ID = "Ov23li1pXJ9BNmqQR6hB";

export async function getSettings() {
    console.log("Loading settings...");
    const saved = await chrome.storage.sync.get("SETTINGS");
    console.log("Settings loaded:", { ...DEFAULT_SETTINGS, ...saved.SETTINGS });
    return { ...DEFAULT_SETTINGS, ...saved.SETTINGS };
}

export async function saveSettings(settingsToSave) {
    console.log("Saving settings:", settingsToSave);
    const currentSettings = await getSettings();
    const settings = { ...currentSettings, ...settingsToSave };
    await chrome.storage.sync.set({ SETTINGS: settings });
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

export async function hasToken() {
    const github_token = await getToken();
    return !!github_token;
}

export async function logout() {
    await chrome.storage.local.remove("github_token");
}

export async function getToken() {
    const { github_token } = await chrome.storage.local.get("github_token");
    return github_token;
}
