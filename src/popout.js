import { getSettings, captureKeyCombo, CLIENT_ID } from "./settings.js";

async function loadSettings() {
    const settings = await getSettings();

    document.querySelector("#nextKey").value = settings.nextKey;
    document.querySelector("#prevKey").value = settings.prevKey;

    document.querySelectorAll(".toggle-button").forEach(btn => {
        btn.classList.remove("active");
    });

    document.querySelector(`#restrict-${settings.type}`).classList.add("active");
    document.querySelector(`#filter-${settings.status}`).classList.add("active");
}

function setStatusMessage(message) {
    const statusMessage = document.querySelector("#status-message");
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

    const SETTINGS = {
        nextKey,
        prevKey,
        type,
        status,
    };

    console.log("Saving settings:", SETTINGS);

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

// auth

// 

async function getDeviceCode() {
    const res = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: { "Content-Type": "application/x-www-form-urlencoded", 'Accept': 'application/json' },
        body: `client_id=${CLIENT_ID}&scope=repo`
    });
    return await res.json();
}


document.getElementById('authenticate').onclick = async () => {
    const deviceData = await getDeviceCode();
    console.log("Device data:", deviceData);

    chrome.runtime.sendMessage({ type: "start_poll", device_code: deviceData.device_code });

    chrome.tabs.create({
        url: chrome.runtime.getURL(
            `src/deviceAuth.html?verification_uri=${encodeURIComponent(deviceData.verification_uri)}&user_code=${encodeURIComponent(deviceData.user_code)}`
        )
    });
};


// attach event listeners
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
