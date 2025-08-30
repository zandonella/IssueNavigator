console.log("Script loaded.");
console.log(location.pathname);

let lastPathname = null;
let observer = null;


// setup functions 

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

document.addEventListener("turbo:load", onRouteChange);
document.addEventListener("turbo:render", onRouteChange);
window.addEventListener("popstate", onRouteChange);

attachObserver();
onRouteChange();


// navigation

function navigate(direction) {
    if (direction === "next") {
        console.log("Navigating to next issue...");
    } else if (direction === "prev") {
        console.log("Navigating to previous issue...");
    }
}



// add keybind listener
window.addEventListener("keyup", function (e) {
    if (isTypingTarget(document.activeElement)) return;

    if (e.key === "ArrowRight") {
        e.preventDefault();
        navigate("next");
    } else if (e.key === "ArrowLeft") {
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