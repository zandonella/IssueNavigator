const DEFAULT_SETTINGS = {
    nextKey: "ArrowRight",
    prevKey: "ArrowLeft",
    type: "current",
    status: "open",
    sort: "created",
    direction: "desc"
};

export const CLIENT_ID = "Ov23li1pXJ9BNmqQR6hB";

/** Retrieves settings from chrome.storage.sync, merging with defaults.
 * @returns {Object} The merged settings object.
 */
export async function getSettings() {
    const saved = await chrome.storage.sync.get("SETTINGS");
    return { ...DEFAULT_SETTINGS, ...saved.SETTINGS };
}

/**
 * Saves settings to chrome.storage.sync.
 * @param {Object} settingsToSave - The settings to save.
 */
export async function saveSettings(settingsToSave) {
    const currentSettings = await getSettings();
    const settings = { ...currentSettings, ...settingsToSave };
    await chrome.storage.sync.set({ SETTINGS: settings });
}

/**
 * Captures a key combination from a keyboard event.
 * @param {KeyboardEvent} e - The keyboard event.
 * @returns {string} The captured key combination as a string.
 */
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

/**
 * Checks if a GitHub token is stored.
 * @returns {boolean} True if a GitHub token is stored, false otherwise.
 */
export async function hasToken() {
    const github_token = await getToken();
    return !!github_token;
}
/**
 * Removes the stored GitHub token.
 */
export async function logout() {
    await chrome.storage.local.remove("github_token");
}

/**
 * Retrieves the stored GitHub token.
 * @returns {string|null} The stored GitHub token, or null if not found.
 */
export async function getToken() {
    const { github_token } = await chrome.storage.local.get("github_token");
    return github_token;
}
