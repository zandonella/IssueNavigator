console.log("Script loaded.");

let lastPathname = null;
let lastSearch = null
let observer = null;

let SETTINGS;
let getSettings;
const SESSION = chrome.storage.session;
let ISSUE_LIST = [];
let STATES = [];
let TYPES = []

URL_REGEX = /\/([^\/]+)\/([^\/]+)\/(issues|pull|discussions)\/(\d+)/;

(async () => {
    // dynamic import
    ({ getSettings, saveSettings, captureKeyCombo, getToken } = await import(chrome.runtime.getURL("src/settings.js")));

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
        getURLParams();
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
        console.log("Decoded q param:", decoded);
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
    } else {
        URL = buildRepoURL(owner, repo, "issues", {
            state: "all",
            per_page: 100,
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

// TODO remove?     
function filterAPIData(data, type, status) {
    // if (type === "issues" && SETTINGS.type === "current") {
    //     data = data.filter(item => !item.pull_request);
    // }
    // if (status === "open") {
    //     data = data.filter(item => item.state === "open");
    // } else if (status === "closed") {
    //     data = data.filter(item => item.state === "closed");
    // }

    return data;
}

// navigation

function goToIssue(owner, repo, number) {
    if (!number) {
        const url = `https://github.com/${owner}/${repo}/issues/`;
        window.location.href = url;
        return
    }
    const url = `https://github.com/${owner}/${repo}/issues/${number}`;
    window.location.href = url;
    return;
}

async function fetchPageofNums(owner, repo, type, pageURL = null) {
    const { apiData, next, prev } = await getAPIData(
        owner,
        repo,
        type,
        pageURL
    );

    const fetchedNumbers = apiData.map(item => item.number);
    const fetchedStates = apiData.map(item => item.state);
    const fetchedTypes = apiData.map(item => item.pull_request ? "pull" : "issues");


    console.log("Fetched numbers:", fetchedNumbers);
    console.log("Fetched states:", fetchedStates);
    console.log("Fetched types:", fetchedTypes);

    return { fetchedNumbers, fetchedStates, fetchedTypes, next, prev };
}

async function findNumberInList(owner, repo, type, number, direction) {
    let nextPageURL = null;
    let prevPageURL = null;
    let numbers = [];
    let states = [];
    let types = [];
    let i = 0;
    while (i < 10) {
        console.log("Current number not in fetched data, fetching new page...");

        const pageURL = nextPageURL;
        const { fetchedNumbers, fetchedStates, fetchedTypes, next, prev } = await fetchPageofNums(
            owner,
            repo,
            type,
            pageURL
        );

        numbers.push(...fetchedNumbers);
        states.push(...fetchedStates);
        types.push(...fetchedTypes);
        nextPageURL = next;
        prevPageURL = prev;

        console.log("Fetched numbers:", fetchedNumbers);
        if (fetchedNumbers.length === 0) {
            console.log("No more data available.");
            break;
        }

        if (fetchedNumbers.includes(number)) {
            console.log("Found current number in fetched data.");
            break;
        }
        i++;
    }

    return { numbers, states, types, nextPageURL, prevPageURL };
}

async function navigate(direction) {
    if (!isValidPath(location.pathname)) {
        console.log("Invalid path");
        return;
    }
    const { owner, repo, type, number } = parseRepoPath(location.pathname);

    let nextPageURL = null;
    let prevPageURL = null;
    let listChanged = false;

    // load from cache
    let response = await loadIssueList(owner, repo, type);
    if (response) {
        ISSUE_LIST = response.numbers;
        STATES = response.states;
        TYPES = response.types;
        nextPageURL = response.nextPageURL;
        prevPageURL = response.prevPageURL;
    }

    if (!response || !ISSUE_LIST.includes(number)) {
        // fallback to API
        listChanged = true;
        response = await findNumberInList(owner, repo, type, number, direction);
        ISSUE_LIST = response.numbers;
        STATES = response.states;
        TYPES = response.types;
        nextPageURL = response.nextPageURL;
        prevPageURL = response.prevPageURL;
    }

    console.log("Collected numbers:", ISSUE_LIST, "Collected states:", STATES, "Collected types:", TYPES, "Next page URL:", nextPageURL, "Prev page URL:", prevPageURL);
    if (!ISSUE_LIST.includes(number)) {
        console.log("Issue is too far from start of list, navigating to issue board...");
        goToIssue(owner, repo);
        return;
    }
    // navigate to next/previous issue
    const currentIndex = ISSUE_LIST.indexOf(number);
    let targetNumber = getIssueNumber(ISSUE_LIST, currentIndex, direction, type);

    if (targetNumber) {
        // number exists in the current list
        console.log("Navigating to issue/PR number:", targetNumber);
        if (listChanged) {
            await saveIssueList(owner, repo, type, ISSUE_LIST, STATES, TYPES, nextPageURL, prevPageURL);
            console.log("Saved issue list to session storage.");
        }
        goToIssue(owner, repo, targetNumber);
    } else {
        // need to fetch more pages to find valid match
        targetNumber = null;
        let i = 0
        while (i < 10 && ((direction === "next" && nextPageURL) || (direction === "prev" && prevPageURL))) {
            console.log("Current target not found, fetching next page...");
            const pageURL = direction === "next" ? nextPageURL : prevPageURL;
            const { fetchedNumbers, fetchedStates, fetchedTypes, next, prev } = await fetchPageofNums(owner, repo, type, pageURL);

            if (direction === "next") {
                ISSUE_LIST.push(...fetchedNumbers);
                STATES.push(...fetchedStates);
                TYPES.push(...fetchedTypes);
            } else {
                ISSUE_LIST.unshift(...fetchedNumbers);
                STATES.unshift(...fetchedStates);
                TYPES.unshift(...fetchedTypes);
            }
            nextPageURL = next;
            prevPageURL = prev;
            listChanged = true;

            const newTargetNumber = getIssueNumber(ISSUE_LIST, currentIndex, direction, type);

            if (newTargetNumber) {
                targetNumber = newTargetNumber;
                break;
            }
            i++;
        }

        if (!targetNumber) {
            console.log("No valid issue/PR found after fetching new page.");
            return;
        }

        if (listChanged) {
            await saveIssueList(owner, repo, type, ISSUE_LIST, STATES, TYPES, nextPageURL, prevPageURL);
            console.log("Saved issue list to session storage.");
        }

        console.log("Navigating to issue/PR number from new page:", targetNumber);
        goToIssue(owner, repo, targetNumber);
    }
}


function getIssueNumber(numbers, currentIndex, direction, type) {
    let increment = direction === "next" ? 1 : -1;
    let index = currentIndex + increment;
    while (true) {
        let typesMatch = false;
        let statusMatch = false;
        if (index < 0 || index >= numbers.length) {
            return null;
        }
        if (STATES[index] === SETTINGS.status || SETTINGS.status === "all") {
            statusMatch = true;
        }
        if (TYPES[index] === type || SETTINGS.type === "all") {
            typesMatch = true;
        }
        if (statusMatch && typesMatch) {
            return numbers[index];
        }
        index += increment;
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
    return `${owner}/${repo}\:-${SETTINGS.sort}-${SETTINGS.direction}`;
}

async function saveIssueList(owner, repo, type, numbers, states, types, nextPageURL, prevPageURL) {
    const key = makeFilterKey(owner, repo, type);
    await SESSION.set({ [key]: { numbers, states, types, nextPageURL, prevPageURL } });
}

async function loadIssueList(owner, repo, type) {
    const key = makeFilterKey(owner, repo, type);
    const result = await SESSION.get(key);
    console.log("Loaded from session:", result);
    return result[key] ? result[key] : null;
}
