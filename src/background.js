import { CLIENT_ID } from "./settings.js";

async function pollForToken(device_code) {
    while (true) {
        const res = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
            body: `client_id=${CLIENT_ID}&device_code=${device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code`
        });
        const data = await res.json();
        if (data.access_token) {
            return data.access_token;
        }
        if (data.error === "authorization_pending") {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        } else {
            throw new Error(data.error);
        }
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("Background received message:", msg);
    if (msg.type === "start_poll") {
        pollForToken(msg.device_code)
            .then(token => {
                chrome.storage.local.set({ github_token: token });
                chrome.runtime.sendMessage({ type: "auth_success", token });
            })
            .catch(error => {
                chrome.runtime.sendMessage({ type: "auth_error", error: error.message });
            });
    }
});

chrome.storage.session.setAccessLevel({
    accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS"
});