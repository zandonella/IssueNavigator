console.log("Script loaded.");

let lastPathname = null;
let lastSearch = null
let observer = null;

let SETTINGS;
let getSettings;
const SESSION = chrome.storage.session;

URL_REGEX = /\/([^\/]+)\/([^\/]+)\/(issues|pull|discussions)\/(\d+)/;

(async () => {
    // dynamic import
    ({ getSettings, captureKeyCombo, getToken } = await import(chrome.runtime.getURL("src/settings.js")));

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

// calls api and returns the response
async function callAPI(URL) {
    const token = await getToken();
    const headers = { ...(token && { 'Authorization': `Bearer ${token}` }) };

    const response = await fetch(URL, { headers });
    if (!response.ok) {
        console.error("Failed to fetch issues/PRs:", response.statusText);
        return null;
    }
    return response;
}

async function getAPIData(owner, repo, type, pageURL = null) {
    let URL;
    if (pageURL) {
        URL = pageURL;
    } else if (type === "pull" && SETTINGS.type === "current") {
        URL = buildRepoURL(owner, repo, "pulls", {
            state: SETTINGS.status,
            per_page: 50,
            sort: SETTINGS.sort,
            direction: SETTINGS.direction
        });
    } else {
        URL = buildRepoURL(owner, repo, "issues", {
            state: SETTINGS.status,
            per_page: 50,
            sort: SETTINGS.sort,
            direction: SETTINGS.direction
        });
    }

    console.log("Fetching from URL:", URL.toString());
    let response = await callAPI(URL);
    let data = await response.json();
    const linkHeader = response.headers.get("Link");
    console.log("linkHeader info:", linkHeader);
    const { next, prev } = parseHeaderLinks(linkHeader);

    return { apiData: data, ...{ next, prev } };
}

function parseHeaderLinks(header) {
    let links = { next: null, prev: null };
    if (!header) return links;

    const linkHeader = header.split(", ");
    linkHeader.forEach(link => {
        const match = link.match(/<(.*?)>; rel="(.*?)"/);
        if (match) {
            const url = match[1];
            const rel = match[2];
            if (rel === "next") links.next = url;
            if (rel === "prev") links.prev = url;
        }
    });

    return links;
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

    const { owner, repo, type, number } = parseRepoPath(location.pathname);
    console.log("Navigating in:", owner, repo, type);

    let nextPageURL = null;
    let prevPageURL = null;
    let numbers = [];
    let fetchedNumbers = [];
    let firstFetch = true;
    while (!fetchedNumbers.includes(number)) {
        console.log("Current number not in fetched data, fetching more...");
        numbers = numbers.concat(fetchedNumbers);

        const { apiData, next, prev } = await getAPIData(
            owner,
            repo,
            type,
            firstFetch ? null : direction === "next" ? nextPageURL : prevPageURL
        );

        fetchedNumbers = filterAPIData(apiData, type, SETTINGS.status).map(item => item.number);
        console.log("Fetched numbers:", fetchedNumbers);

        if (fetchedNumbers.length === 0) {
            console.log("No more data available.");
            break;
        }

        nextPageURL = next;
        prevPageURL = prev;
        firstFetch = false;

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    numbers = numbers.concat(fetchedNumbers);
    console.log("Collected numbers:", numbers);

    console.log(
        direction === "next" ? "Fetching next issues..." : "Fetching previous issues..."
    );

    const currentIndex = numbers.indexOf(number);
}

function getIssueNumber(numbers, currentIndex, direction) {
    const nextIndex = currentIndex + 1;
    const prevIndex = currentIndex - 1;
    if (direction === "next" && nextIndex < numbers.length) {
        return numbers[nextIndex] || null;
    } else if (direction === "prev" && prevIndex >= 0) {
        return numbers[prevIndex] || null;
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

// cache helpers

function makeFilterKey(owner, repo, type) {
    return `${owner}/${repo}/${type}:-${SETTINGS.status}-${SETTINGS.sort}-${SETTINGS.direction}`;
}

async function saveIssueList(owner, repo, type, numbers) {
    const key = makeFilterKey(owner, repo, type);
    await SESSION.set({ [key]: { numbers } });
}