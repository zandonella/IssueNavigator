import { getSettings, captureKeyCombo, CLIENT_ID, hasToken, logout, getToken } from "./settings.js";

async function loadSettings() {
    const settings = await getSettings();

    document.querySelector("#nextKey").value = settings.nextKey;
    document.querySelector("#prevKey").value = settings.prevKey;

    document.querySelectorAll(".toggle-button").forEach(btn => {
        btn.classList.remove("active");
    });

    document.querySelector(`#restrict-${settings.type}`).classList.add("active");
    document.querySelector(`#filter-${settings.status}`).classList.add("active");
    document.querySelector(`#sort-${settings.sort}`).classList.add("active");
    document.querySelector(`#sort-${settings.direction}`).classList.add("active");
}

function setStatusMessage(message) {
    const statusMessage = document.querySelector("#status-message");
    statusMessage.style.display = message ? "block" : "none";
    statusMessage.textContent = message;
}

async function saveSettings() {
    const nextKey = document.querySelector("#nextKey").value.trim();
    const prevKey = document.querySelector("#prevKey").value.trim();

    let type = null;
    if (document.querySelector("#restrict-all").classList.contains("active")) {
        type = "all";
    }
    if (document.querySelector("#restrict-current").classList.contains("active")) {
        type = "current";
    }


    let status = null;
    if (document.querySelector("#filter-all").classList.contains("active")) {
        status = "all";
    } else if (document.querySelector("#filter-open").classList.contains("active")) {
        status = "open";
    } else if (document.querySelector("#filter-closed").classList.contains("active")) {
        status = "closed";
    }

    let sort = null;
    if (document.querySelector("#sort-created").classList.contains("active")) {
        sort = "created";
    } else if (document.querySelector("#sort-updated").classList.contains("active")) {
        sort = "updated";
    }

    let direction = null;
    if (document.querySelector("#sort-desc").classList.contains("active")) {
        direction = "desc";
    } else if (document.querySelector("#sort-asc").classList.contains("active")) {
        direction = "asc";
    }

    if (!nextKey || !prevKey) {
        setStatusMessage("Both Next and Prev keys must be set.");
        return;
    }

    if (!type) {
        setStatusMessage("Type restriction must be selected.");
        return;
    }

    if (!status) {
        setStatusMessage("Status filter must be selected.");
        return;
    }

    if (!sort) {
        setStatusMessage("Sort option must be selected.");
        return;
    }

    if (!direction) {
        setStatusMessage("Sort direction must be selected.");
        return;
    }

    const SETTINGS = {
        nextKey,
        prevKey,
        type,
        status,
        sort,
        direction
    };

    console.log("Saving settings:", SETTINGS);
    setStatusMessage();

    await chrome.storage.sync.set({ SETTINGS });
}

function handleToggleButtonClick(button) {
    const buttonGroup = button.parentElement;

    // remove active class from all buttons in the buttonGroup
    buttonGroup.querySelectorAll(".toggle-button").forEach(btn => {
        btn.classList.remove("active");
    });

    // add active class to clicked button
    button.classList.add("active");
}

function updateAuthButton(loggedIn) {
    const authButton = document.getElementById('authenticate');
    const text = document.getElementById("button-text");
    const icon = authButton.querySelector("svg");
    const divider = authButton.querySelector(".signup-divider");

    authButton.onclick = null

    if (loggedIn) {
        text.textContent = 'Logout';
        text.classList.remove('signup-text');
        text.classList.add('logout-text');

        authButton.classList.add('logout-github');
        authButton.classList.remove('signup-github');

        icon.classList.add('hidden');
        divider.classList.add('hidden');

        authButton.onclick = async () => {
            await logout();
            setStatusMessage('Signed out.');
            updateAuthButton(false);
        };
    } else {
        text.textContent = 'Login with GitHub';
        text.classList.remove('logout-text');
        text.classList.add('signup-text');

        authButton.classList.remove('logout-github');
        authButton.classList.add('signup-github');

        icon.classList.remove('hidden');
        divider.classList.remove('hidden');

        authButton.onclick = async () => {
            const deviceData = await getDeviceCode();

            chrome.runtime.sendMessage({ type: "start_poll", device_code: deviceData.device_code });

            chrome.tabs.create({
                url: chrome.runtime.getURL(
                    `src/deviceAuth.html?verification_uri=${encodeURIComponent(deviceData.verification_uri)}&user_code=${encodeURIComponent(deviceData.user_code)}`
                )
            });
        };
    }
    getRateLimit();
}

async function getRateLimit() {
    const token = await getToken();

    const headers = { 'Accept': 'application/vnd.github.v3+json', ...(token && { 'Authorization': `Bearer ${token}` }) };

    console.log("Fetching rate limit with headers:", headers);

    const data = await fetch('https://api.github.com/rate_limit', { headers }).then(res => res.json());


    const rateInfo = data.resources.core;
    const remaining = rateInfo.remaining;
    const limit = rateInfo.limit;

    document.getElementById("rateLimit").textContent = `${remaining}`;

    if (remaining > limit * 0.5) {
        document.getElementById("rateLimit").style.color = "green";
    } else if (remaining > limit * 0.2) {
        document.getElementById("rateLimit").style.color = "orange";
    } else {
        document.getElementById("rateLimit").style.color = "red";
    }
}

// auth

async function getDeviceCode() {
    const res = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: { "Content-Type": "application/x-www-form-urlencoded", 'Accept': 'application/json' },
        body: `client_id=${CLIENT_ID}&scope=repo`
    });
    return await res.json();
}

// attach event listeners

chrome.storage.onChanged.addListener(async (changes, area) => {

    hasToken().then(updateAuthButton);
});

const settingsContainer = document.querySelector("#settings");
settingsContainer.addEventListener("click", (event) => {
    const button = event.target;

    if (button.classList.contains("toggle-button")) {
        handleToggleButtonClick(button);
    }
});

let nextKeyInput = document.querySelector("#nextKey");
let prevKeyInput = document.querySelector("#prevKey");

nextKeyInput.addEventListener("keydown", (e) => {
    e.preventDefault();
    nextKeyInput.value = captureKeyCombo(e);
});

prevKeyInput.addEventListener("keydown", (e) => {
    e.preventDefault();
    prevKeyInput.value = captureKeyCombo(e);
});

document.querySelector("#save").addEventListener("click", saveSettings);
document.addEventListener("DOMContentLoaded", loadSettings);
hasToken().then(updateAuthButton);
