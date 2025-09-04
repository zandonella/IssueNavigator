console.log("Script loaded.");

let lastPathname = null;
let lastSearch = null
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
    const currentSearch = location.search;

    if (currentSearch !== lastSearch) {
        lastSearch = currentSearch;
        getURLParams();
    }
    if (currentPathname !== lastPathname) {
        lastPathname = currentPathname;
        console.log("Route changed to:", currentPathname);
        attachObserver();
    }
}

// todo find a way to capture when this changes
async function getURLParams() {
    issuesPageRegex = /\/([^\/]+)\/([^\/]+)\/(issues|pulls)$/;
    if (!issuesPageRegex.test(location.pathname)) {
        console.log("Not on issues/pr list page");
        return;
    }

    const queryString = window.location.search;
    const params = new URLSearchParams(queryString);
    console.log("URL params:", params.toString());

    let sortSetting = "created-desc";

    if (params.has("q")) {
        const options = params.get("q");
        const decoded = decodeURIComponent(options);
        const match = decoded.match(/sort:([^\s]+)/);
        if (match) {
            sortSetting = match[1];
        }
    }

    if (sortSetting !== SETTINGS.sort + "-" + SETTINGS.direction) {
        await chrome.storage.sync.set({ SETTINGS: { ...SETTINGS, sort: sortSetting.split("-")[0], direction: sortSetting.split("-")[1] } });
        console.log("Updated sort setting:", sortSetting);
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

function buildRepoURL(owner, repo, type, params = {}) {
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
        let URL = buildRepoURL(owner, repo, "pulls", {
            state: SETTINGS.status,
            per_page: 50,
            sort: SETTINGS.sort,
            direction: SETTINGS.direction
        });
        return await callAPI(URL);
    } else {
        let URL = buildRepoURL(owner, repo, "issues", {
            state: SETTINGS.status,
            per_page: 50,
            sort: SETTINGS.sort,
            direction: SETTINGS.direction
        });
        console.log("Fetching from URL:", URL.toString());
        return await callAPI(URL);
    }
}


function filterAPIData(data, type, status) {
    if (type === "issues" && SETTINGS.type === "current") {
        data = data.filter(item => !item.pull_request);
    }
    if (status === "open") {
        data = data.filter(item => item.state === "open");
    } else if (status === "closed") {
        data = data.filter(item => item.state === "closed");
    }

    return data;
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
    apiData = filterAPIData(apiData, type, SETTINGS.status);
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