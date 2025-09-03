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

function buildURL(owner, repo, type, params = {}) {
    const baseURL = `https://api.github.com/repos/${owner}/${repo}/${type}`;
    const url = new URL(baseURL);

    Object.keys(params).forEach(key => {
        console.log("Appending param:", key, params[key]);
        url.searchParams.append(key, params[key]);
    });

    return url
}

async function callAPI(URL) {
    const response = await fetch(URL);
    if (!response.ok) {
        console.error("Failed to fetch issues/PRs:", response.statusText);
        return null;
    }
    const data = await response.json();
    return data;
}

async function getAPIData(owner, repo, type) {
    if (type === "pull" && SETTINGS.type === "current") {
        let URL = buildURL(owner, repo, "pulls", {
            state: SETTINGS.status,
            per_page: 5
        });
        return await callAPI(URL);
    } else if (type === "issues" && SETTINGS.type === "current") {
        let URL = buildURL(owner, repo, "issues", {
            state: SETTINGS.status,
            per_page: 5
        });
        let data = await callAPI(URL)
        return data.filter(item => !item.pull_request);
    } else {
        let URL = buildURL(owner, repo, "issues", {
            state: SETTINGS.status,
            per_page: 5
        });
        return await callAPI(URL);
    }
}

// navigation

function goToIssue(owner, repo, number) {
    const url = `https://github.com/${owner}/${repo}/issues/${number}`;
    window.location.href = url;
}

async function navigate(direction) {
    if (!isValidPath(location.pathname)) {
        console.log("Invalid path");
        return;
    }

    const { owner, repo, type } = parseRepoPath(location.pathname);
    console.log("Navigating in:", owner, repo, type);
    let apiData = await getAPIData(owner, repo, type);
    console.log("API Data:", apiData);

    if (direction === "next") {
        console.log("Fetching issues with settings:", SETTINGS);
    } else if (direction === "prev") {
        console.log("Navigating to previous issue...");
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