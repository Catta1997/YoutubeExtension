async function fetchWords() {
    const response = await fetch(chrome.runtime.getURL('words.json'));
    const data = await response.json();
    return data.words;
}

function getChatFrameDocument() {
    let iframe = document.querySelector("iframe#chatframe");
    return iframe ? (iframe.contentDocument || iframe.contentWindow.document) : null;
}

function getChatContainer(chatDoc) {
    return chatDoc?.querySelector("yt-live-chat-item-list-renderer #items") || null;
}

async function updateMessages() {
    let chatDoc = getChatFrameDocument();
    if (!chatDoc) return;

    let words = await fetchWords();
    let messages = chatDoc.querySelectorAll("yt-live-chat-text-message-renderer");

    messages.forEach((message) => {
        let messageSpan = message.querySelector("#message");
        if (messageSpan && !message.dataset.highlighted) {
            let messageHTML = messageSpan.innerHTML;
            words.forEach(word => {
                let regex = new RegExp(`(\\b${word}\\b)`, 'gi');
                messageHTML = messageHTML.replace(regex, '<span style="color:red; text-decoration:underline;">$1</span>');
            });
            messageSpan.innerHTML = messageHTML;
            message.dataset.highlighted = "true";
        }
    });
}

function startObserver() {
    let chatDoc = getChatFrameDocument();
    if (!chatDoc) return;

    let chatContainer = getChatContainer(chatDoc);
    if (!chatContainer) return;

    const observer = new MutationObserver(updateMessages);
    observer.observe(chatContainer, { childList: true, subtree: true });

    updateMessages();
}

let checkInterval = setInterval(() => {
    let chatDoc = getChatFrameDocument();
    let chatContainer = chatDoc ? getChatContainer(chatDoc) : null;

    if (chatDoc && chatContainer) {
        clearInterval(checkInterval);
        startObserver();
    }
}, 1000);