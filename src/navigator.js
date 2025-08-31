console.log("Script loaded.");
console.log(location.pathname);

let lastPathname = null;
let observer = null;

let SETTINGS;
let getSettings;

(async () => {
    // dynamic import
    ({ getSettings } = await import(chrome.runtime.getURL("src/settings.js")));
    SETTINGS = await getSettings();

    await init();
})();

// setup functions
async function init() {
    chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area !== "sync") return;
        SETTINGS = await getSettings();
        console.log("Settings updated:", SETTINGS);
    });

    document.addEventListener("turbo:render", onRouteChange);
    window.addEventListener("popstate", onRouteChange);
    attachObserver();
    onRouteChange();
}

// update when the SPA route changes
function onRouteChange() {
    const currentPathname = location.pathname;
    if (currentPathname !== lastPathname) {
        lastPathname = currentPathname;
        console.log("Route changed to:", currentPathname);
        attachObserver();
    }
}
// attach the observer to the container
function attachObserver() {
    const container = document.body;
    if (!container) return;

    if (observer) observer.disconnect();
    observer = new MutationObserver(onRouteChange);
    observer.observe(container, { childList: true, subtree: true });
}


// navigation

function navigate(direction) {
    if (!isValidPath(location.pathname)) {
        console.log("Invalid path");
        return;
    }
    if (direction === "next") {
        console.log("Navigating to next issue...");
    } else if (direction === "prev") {
        console.log("Navigating to previous issue...");
    }
}

function isValidPath(string) {
    return /[^\/]+\/[^\/]+\/(issues|pull)\/\d+/.test(string);
}


// add keybind listener
window.addEventListener("keyup", function (e) {
    if (isTypingTarget(document.activeElement)) return;

    if (e.key === SETTINGS.nextKey) {
        e.preventDefault();
        navigate("next");
    } else if (e.key === SETTINGS.prevKey) {
        e.preventDefault();
        navigate("prev");
    }
});

// helpers

function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return true;
    if (el.isContentEditable) return true;
    var role = el.getAttribute ? el.getAttribute("role") : null;
    if (role === "textbox" || role === "searchbox" || role === "combobox") return true;
    return false;
}