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
    });

    document.addEventListener("turbo:render", onRouteChange);
    window.addEventListener("popstate", onRouteChange);
    attachObserver();
    onRouteChange();
}

/**
 * Handles route changes by checking the current pathname and search parameters.
 * If they differ from the last known values, it updates them and calls relevant functions.
 */
function onRouteChange() {
    const currentPathname = location.pathname;
    const currentSearch = location.search;

    if (currentSearch !== lastSearch) {
        lastSearch = currentSearch;
        getURLParams();
    }
    if (currentPathname !== lastPathname) {
        lastPathname = currentPathname;
        attachObserver();
        getURLParams();
    }
}

/**
 * Extracts URL parameters from the current page and updates settings if they differ
 * from the stored settings.
 */
async function getURLParams() {
    issuesPageRegex = /\/([^\/]+)\/([^\/]+)\/(issues|pulls)$/;
    if (!issuesPageRegex.test(location.pathname)) {
        return;
    }

    const queryString = window.location.search;
    const params = new URLSearchParams(queryString);
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
    }
}

/**
 * Attaches a mutation observer to the document body to listen for changes.
 */
function attachObserver() {
    const container = document.body;
    if (!container) return;

    if (observer) observer.disconnect();
    observer = new MutationObserver(onRouteChange);
    observer.observe(container, { childList: true, subtree: true });
}

// api helpers
/**
 * Parses the repository path from a given URL path.
 * @param {string} path - The URL path to parse.
 * @returns {Object|null} The parsed repository information or null if not found. Includes owner, repo, type, and issue number.
 */
function parseRepoPath(path) {
    const match = path.match(URL_REGEX);
    if (!match) return null;
    return {
        owner: match[1],
        repo: match[2],
        type: match[3],
        number: parseInt(match[4])
    };
}

/**
 * Builds the API URL for a specific repository.
 * @param {string} owner - The repository owner's username.
 * @param {string} repo - The repository name.
 * @param {string} type - The type of resource (issues, pull).
 * @param {Object} params - Additional query parameters for the API request.
 * @returns {URL} The constructed API URL.
 */
function buildRepoURL(owner, repo, type, params = {}) {
    const baseURL = `https://api.github.com/repos/${owner}/${repo}/${type}`;
    const url = new URL(baseURL);

    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });

    return url
}

/**
 * Calls the GitHub API and returns the response.
 * @param {URL} URL - The API URL to call.
 * @returns {Promise<Response|null>} The API response or null if the request failed.
 */
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

/**
 * Builds the API URL for a specific repository.
 * @param {string} owner - The repository owner's username.
 * @param {string} repo - The repository name.
 * @param {string} pageURL - The URL of the specific page to fetch.
 * @returns {URL} The constructed API URL.
 */
async function getAPIData(owner, repo, pageURL = null) {
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

    let response = await callAPI(URL);
    let data = await response.json();
    const linkHeader = response.headers.get("Link");
    const { next, prev } = parseHeaderLinks(linkHeader);

    return { apiData: data, ...{ next, prev } };
}

/**
 * Parses the Link header from the API response.
 * @param {string} header - The Link header string.
 * @returns {Object} An object containing the next and prev page URLs.
 */
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

// navigation
/**
 * Navigates to a specific issue in a GitHub repository.
 * @param {string} owner - The repository owner's username.
 * @param {string} repo - The repository name.
 * @param {number} number - The issue number.
 */
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

/**
 * Fetches a page of issue or pull request numbers from the GitHub API.
 * @param {string} owner - The repository owner's username.
 * @param {string} repo - The repository name.
 * @param {string} pageURL - The URL of the specific page to fetch.
 * @returns {Promise<Object>} The fetched data containing issue/pull request numbers and their states.
 */
async function fetchPageOfNums(owner, repo, pageURL = null) {
    const { apiData, next, prev } = await getAPIData(
        owner,
        repo,
        pageURL
    );

    const fetchedNumbers = apiData.map(item => item.number);
    const fetchedStates = apiData.map(item => item.state);
    const fetchedTypes = apiData.map(item => item.pull_request ? "pull" : "issues");

    return { fetchedNumbers, fetchedStates, fetchedTypes, next, prev };
}

/**
 * Fetches pages of issue or pull request numbers until the specified number is found or no more pages are available.
 * @param {string} owner - The repository owner's username.
 * @param {string} repo - The repository name.
 * @param {number} number - The issue or pull request number.
 * @returns {Promise<Object>} The fetched data containing issue/pull request numbers and their states.
 */
async function findNumberInList(owner, repo, number) {
    let nextPageURL = null;
    let prevPageURL = null;
    let numbers = [];
    let states = [];
    let types = [];
    let i = 0;
    while (i < 10) {
        console.log("Current number not in fetched data, fetching new page...");

        const pageURL = nextPageURL;
        const { fetchedNumbers, fetchedStates, fetchedTypes, next, prev } = await fetchPageOfNums(
            owner,
            repo,
            pageURL
        );

        numbers.push(...fetchedNumbers);
        states.push(...fetchedStates);
        types.push(...fetchedTypes);
        nextPageURL = next;
        prevPageURL = prev;

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


/**
 * Navigates to the next or previous issue in the list.
 * @param {string} direction - The direction to navigate (next or prev).
 * @returns {Promise<void>}
 */
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
        response = await findNumberInList(owner, repo, number);
        ISSUE_LIST = response.numbers;
        STATES = response.states;
        TYPES = response.types;
        nextPageURL = response.nextPageURL;
        prevPageURL = response.prevPageURL;
    }

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
            await saveIssueList(owner, repo, ISSUE_LIST, STATES, TYPES, nextPageURL, prevPageURL);
        }
        goToIssue(owner, repo, targetNumber);
    } else {
        // need to fetch more pages to find valid match
        targetNumber = null;
        let i = 0
        while (i < 10 && ((direction === "next" && nextPageURL) || (direction === "prev" && prevPageURL))) {
            console.log("Current target not found, fetching next page...");
            const pageURL = direction === "next" ? nextPageURL : prevPageURL;
            const { fetchedNumbers, fetchedStates, fetchedTypes, next, prev } = await fetchPageOfNums(owner, repo, pageURL);

            // append/prepend to list
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
            console.log("No valid issue/PR found after fetching new page, navigating to issue board.");
            goToIssue(owner, repo);
            return;
        }

        if (listChanged) {
            await saveIssueList(owner, repo, ISSUE_LIST, STATES, TYPES, nextPageURL, prevPageURL);
        }

        console.log("Navigating to issue/PR number from new page:", targetNumber);
        goToIssue(owner, repo, targetNumber);
    }
}

/**
 * Finds the issue that should be navigated to based on the current index, direction, and filters.
 * @param {Array<number>} numbers - The list of issue/pull request numbers.
 * @param {number} currentIndex - Index of the current issue in the list.
 * @param {string} direction - The direction to navigate (next or prev).
 * @param {string} type - The type of issue (issue or pull request).
 * @returns {number|null} The found issue/pull request number or null if not found.
 */
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

/**
 * Checks if a string is a valid URL path.
 * @param {string} string - The string to check.
 * @returns {boolean} True if the string is a valid URL path, false otherwise.
 */
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

/**
 * Checks if the given element is a typing target.
 * @param {HTMLElement} el - The element to check.
 * @returns {boolean} True if the element is a typing target, false otherwise.
 */
function isTypingTarget(el) {
    if (!el) return false;
    let tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return true;
    if (el.isContentEditable) return true;
    let role = el.getAttribute ? el.getAttribute("role") : null;
    if (role === "textbox" || role === "searchbox" || role === "combobox") return true;
    return false;
}

// cache helpers

/**
 * Creates a cache key for the issue list based on the owner, repo, and sort settings.
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @returns {string} The cache key.
 */
function makeFilterKey(owner, repo) {
    return `${owner}/${repo}\:-${SETTINGS.sort}-${SETTINGS.direction}`;
}

/**
 * Saves the issue list and related data to session storage.
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {Array<number>} numbers - The list of issue/pull request numbers.
 * @param {Array<string>} states - The list of issue/pull request states.
 * @param {Array<string>} types - The list of issue/pull request types.
 * @param {string} nextPageURL - The URL for the next page of results.
 * @param {string} prevPageURL - The URL for the previous page of results.
 */
async function saveIssueList(owner, repo, numbers, states, types, nextPageURL, prevPageURL) {
    const key = makeFilterKey(owner, repo);
    await SESSION.set({ [key]: { numbers, states, types, nextPageURL, prevPageURL } });
}

/**
 * Loads the issue list and related data from session storage.
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @returns {Promise<Object|null>} The loaded issue list data or null if not found.
 */
async function loadIssueList(owner, repo) {
    const key = makeFilterKey(owner, repo);
    const result = await SESSION.get(key);
    return result[key] ? result[key] : null;
}
