// Parse device code data from query params
const params = new URLSearchParams(window.location.search);
document.getElementById('verification_uri').href = params.get('verification_uri');
document.getElementById('verification_uri').textContent = params.get('verification_uri');
document.getElementById('user_code').textContent = params.get('user_code');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("Received message:", msg);
    if (msg.type === "auth_success") {
        document.getElementById('result').textContent = "Authenticated! Token: " + msg.token;
    } else if (msg.type === "auth_error") {
        document.getElementById('result').textContent = "Error: " + msg.error;
    }
});
