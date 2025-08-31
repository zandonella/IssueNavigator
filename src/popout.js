import { getSettings } from "./settings.js";


async function loadSettings() {
    const settings = await getSettings();

    document.querySelector("#nextKey").value = settings.nextKey;
    document.querySelector("#prevKey").value = settings.prevKey;

    document.querySelectorAll(".toggle-button").forEach(btn => {
        btn.classList.remove("active");
    });

    document.querySelector(`#restrict${settings.type}`).classList.add("active");
    document.querySelector(`#filter${settings.status}`).classList.add("active");
}

function setStatusMessage(message) {
    const statusMessage = document.querySelector("#status-message");
    statusMessage.textContent = message;
}

async function saveSettings() {
    const nextKey = document.querySelector("#nextKey").value.trim();
    const prevKey = document.querySelector("#prevKey").value.trim();

    let type = null;
    if (document.querySelector("#restrictAll").classList.contains("active")) {
        type = "All";
    }
    if (document.querySelector("#restrictCurrent").classList.contains("active")) {
        type = "Current";
    }


    let status = null;
    if (document.querySelector("#filterAll").classList.contains("active")) {
        status = "All";
    } else if (document.querySelector("#filterOpen").classList.contains("active")) {
        status = "Open";
    } else if (document.querySelector("#filterClosed").classList.contains("active")) {
        status = "Closed";
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


// attach event listeners
const settingsContainer = document.querySelector("#settings");
settingsContainer.addEventListener("click", (event) => {
    const button = event.target;

    if (button.classList.contains("toggle-button")) {
        handleToggleButtonClick(button);
    }
});

document.querySelector("#save").addEventListener("click", saveSettings);
document.addEventListener("DOMContentLoaded", loadSettings);
