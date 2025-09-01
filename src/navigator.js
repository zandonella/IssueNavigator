console.log("Script loaded.");

let lastPathname = null;
let observer = null;

let SETTINGS;
let getSettings;

URL_REGEX = /\/([^\/]+)\/([^\/]+)\/(issues|pull|discussions)\/(\d+)/;

(async () => {
    // dynamic import
    ({ getSettings, captureKeyCombo } = await import(chrome.runtime.getURL("src/settings.js")));

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

// api helpers

function parseRepoPath(path) {
    const match = path.match(URL_REGEX);
    if (!match) return null;
    console.log("Parsed path:", match);
    return {
        owner: match[1],
        repo: match[2],
        type: match[3],
        number: parseInt(match[4])
    };
}

// async function fetchIssueOrPR(owner, repo, number) {
//     const url = `https://api.github.com/repos/${owner}/${repo}/issues`;
//     const response = await fetch(url);
//     if (!response.ok) {
//         console.error("Failed to fetch issues:", response.statusText);
//         return null;
//     }
//     const data = await response.json();
//     console.log("Fetched issue/PR data:", data);
//     return data;
// }

// fetchIssueOrPR("openstreetmap", "iD", 11369);

// navigation

function goToIssue(owner, repo, number) {
    const url = `https://github.com/${owner}/${repo}/issues/${number}`;
    window.location.href = url;
}

function navigate(direction) {
    if (!isValidPath(location.pathname)) {
        console.log("Invalid path");
        return;
    }
    const { owner, repo, number } = parseRepoPath(location.pathname);
    if (direction === "next") {
        console.log("Navigating to next issue...");
        console.log(owner, repo, number);
        goToIssue(owner, repo, number + 1);
    } else if (direction === "prev") {
        console.log("Navigating to previous issue...");
        goToIssue(owner, repo, number - 1);
    }
}

function isValidPath(string) {
    return URL_REGEX.test(string);
}


// add keybind listener
window.addEventListener("keyup", function (e) {
    if (isTypingTarget(document.activeElement)) return;
    const keyCombo = captureKeyCombo(e);

    if (keyCombo === SETTINGS.nextKey) {
        e.preventDefault();
        navigate("next");
    } else if (keyCombo === SETTINGS.prevKey) {
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