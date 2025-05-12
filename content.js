/**
 * @typedef {Object} WordData
 * @property {string[]} highlightWords
 */
/** @type {string[]} */
let highlightWords = []
const messages = {
    it: {
        wordFound: word => `🔨 Parola bannata "${word}" trovata nel messaggio.`,
        loadingWords: "📂 Parole evidenziate caricate da words.json",
        loadingError: err => `❌ Errore nel caricamento di words.json: ${err}`,
        chatNotFound: "❌ Impossibile trovare il documento della chat.",
        containerNotFound: "❌ Contenitore della chat non trovato. Riprovo...",
        chatReady: "✅ Chat iframe e contenitore trovati, avvio script...",
        deletedProcessed: msg => `🔨 Processo ${msg}`
    },
    en: {
        wordFound: word => `🔨 Banned word "${word}" found in the message.`,
        loadingWords: "📂 Highlight words loaded from words.json",
        loadingError: err => `❌ Error loading words.json: ${err}`,
        chatNotFound: "❌ Unable to find chat document.",
        containerNotFound: "❌ Chat container not found. Retrying...",
        chatReady: "✅ Chat iframe and container found. Starting script...",
        deletedProcessed: msg => `🔨 Processing ${msg}`
    }
};
const userLang = navigator.language.startsWith("it") ? "it" : "en";
const log = messages[userLang];

function customLog(msg) {
    try {
        console.log(`[YT Highlighter] ${msg}`);
        chrome.storage.local.get({logEntries: []}, (data) => {
            const logs = data.logEntries;
            logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
            if (logs.length > 50) logs.shift(); // mantieni max 50 log
            chrome.storage.local.set({logEntries: logs}).then();
        })
    } catch (e) {
        console.log(e)
        // silenzia il log se il contesto è invalidato
    }
}

async function loadHighlightWords() {
    try {
        const response = await fetch(chrome.runtime.getURL("words.json"));
        /** @type {WordData} */
        const data = await response.json();
        highlightWords = data.highlightWords ? data.highlightWords : [];
        customLog(log.loadingWords);
    } catch (error) {
        customLog(log.loadingError(error));
    }
}

function getChatFrameDocument() {
    const iframe = document.querySelector("iframe#chatframe");
    return iframe ? iframe.contentDocument || iframe.contentWindow.document : null;
}

function getChatContainer(chatDoc) {
    return chatDoc?.querySelector("yt-live-chat-item-list-renderer #items") || null;
}

function boxStyle(element, backround, border) {
    element.style.backgroundColor = backround;
    element.style.border = '0.3rem solid'
    element.style.borderRadius = '9px'
    element.style.borderColor = border;
}


function highlightMessageWords(messageElement) {
    const messageSpan = messageElement.querySelector("#message");
    let messageHTML = messageSpan.innerHTML;

    if (!highlightWords || highlightWords.length === 0) return;
    // remove escape character
    const escapedWords = highlightWords.map(word =>
        word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');

    // Replace and highlight
    const newMessageHTML = messageHTML.replace(regex, match => {
        customLog(log.wordFound(match));
        return `<span style="color: #ffa500; font-weight: bold; text-decoration: underline;">${match}</span>`;
    });

    if (newMessageHTML !== messageHTML) {
        boxStyle(messageElement, "rgb(81,81,81)", "rgb(255,165,0)");
        messageSpan.innerHTML = newMessageHTML;
    }
}

/*
function hilightMention(message) {
    const messageSpan = message.querySelector("#message");
    if (messageSpan && messageSpan.querySelector(".mention")) {
        console.log("✅ Trovata una mention dentro #message");
        boxStyle(message, "rgba(68,198,17,0.58)", "rgb(33,159,29)");
        return true;
    } else {
        return false;
    }
}
*/

function processDeletedMessages(message) {
    if (message.hasAttribute("is-deleted")) {
        message.removeAttribute("is-deleted");
        message.removeAttribute("show-bar");

        let messageSpan = message.querySelector("#message");
        let deletedSpan = message.querySelector("#deleted-state");

        if (messageSpan && deletedSpan) {
            boxStyle(message, "rgb(139,0,0)", "rgb(228,67,67)");
            let deletedText = deletedSpan.innerText.trim();

            console.log(log.deletedProcessed(deletedSpan.innerText));
            customLog(log.deletedProcessed(deletedSpan.innerText));
            messageSpan.innerHTML += ` (${deletedText})`;
            deletedSpan.innerText = "";

            const showOriginal = message.querySelector("#show-original");
            if (showOriginal) {
                showOriginal.remove();
            }
            //messageSpan.style.textDecoration = "underline";
        }
    }
}

function updateDeletedMessages() {
    const chatDoc = getChatFrameDocument();
    if (!chatDoc) {
        customLog(log.chatNotFound);
        return;
    }

    const messages = chatDoc.querySelectorAll("yt-live-chat-text-message-renderer");
    messages.forEach((message) => {
        let mod = message?.getAttribute('author-type') === 'moderator'
        if (!message.dataset.highlighted) {
            message.dataset.highlighted = "true";
            //const mention = hilightMention(message);
            if (mod) {
                boxStyle(message, 'rgba(45,163,163,0.5)', "rgb(45,163,163)");
            } else {
                highlightMessageWords(message);
            }
        }
        processDeletedMessages(message);
    });
}

function startObserver() {
    const chatDoc = getChatFrameDocument();
    if (!chatDoc) return;
    const chatContainer = getChatContainer(chatDoc);
    if (!chatContainer) {
        customLog(log.containerNotFound);
        return;
    }
    const observer = new MutationObserver(updateDeletedMessages);
    observer.observe(chatContainer, {childList: true, subtree: true});
    console.log("✅ content.js caricato");
    console.log("chrome:", typeof chrome);
    console.log("chrome.storage:", chrome?.storage);
    updateDeletedMessages();
}

const checkInterval = setInterval(async () => {
    const chatDoc = getChatFrameDocument();
    const chatContainer = chatDoc ? getChatContainer(chatDoc) : null;
    if (chatDoc && chatContainer) {
        customLog(log.chatReady);
        clearInterval(checkInterval);
        await loadHighlightWords();
        startObserver();
        setInterval(updateDeletedMessages, 1000);
    }
}, 1000);
