const logContainer = document.getElementById("logContainer");
const clearButton = document.getElementById("clearLog");

chrome.storage.local.get("logEntries", (data) => {
    const logs = data.logEntries || [];
    logs.forEach(entry => {
        const div = document.createElement("div");
        div.className = "log-entry";
        div.textContent = entry;
        logContainer.appendChild(div);
    });
});

clearButton.addEventListener("click", () => {
    chrome.storage.local.set({ logEntries: [] }, () => {
        logContainer.innerHTML = "";
    });
});
