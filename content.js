/**
 * @typedef {Object} WordData
 * @property {string[]} highlightWords
 */
/** @type {string[]} */
let highlightWords = []
let highlightEnabled = true
let highlightMods = true;
let highlightMentions = true;
let deletedEnabled = true;
let newUserEnabled = true;
let globalEnabled = true;

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

async function loadSettings() {
    chrome.storage.sync.get({
        highlightEnabled: true,
        highlightMods: true,
        deletedEnabled: true,
        newUserEnabled: true,
        highlightMentions: true
    }, prefs => {
        highlightEnabled = prefs.highlightEnabled;
        deletedEnabled = prefs.deletedEnabled;
        newUserEnabled = prefs.newUserEnabled;
        highlightMods = prefs.highlightMods;
        highlightMentions = prefs.highlightMentions;
    });
}

function loadGlobalEnabled() {
    return new Promise(resolve => {
        chrome.storage.local.get({ globalEnabled: true }, data => {
            globalEnabled = data.globalEnabled;
            resolve();
        });
    });
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
    const walker = document.createTreeWalker(messageSpan, NodeFilter.SHOW_TEXT);

    let found = false;

    const escapedWords = highlightWords.map(w =>
        w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');

    let node;
    while ((node = walker.nextNode())) {
        const original = node.nodeValue;
        if (!regex.test(original)) continue;

        found = true;
        customLog(log.wordFound(original));

        const fragment = document.createDocumentFragment();
        const parts = original.split(regex);

        parts.forEach((part, i) => {
            if (i % 2 === 1) {
                const span = document.createElement("span");
                span.style.color = "#ffa500";
                span.style.fontWeight = "bold";
                span.style.textDecoration = "underline";
                span.textContent = part;
                fragment.appendChild(span);
            } else {
                fragment.appendChild(document.createTextNode(part));
            }
        });

        node.replaceWith(fragment);
    }

    if (found) {
        boxStyle(messageElement, "rgb(81,81,81)", "rgb(255,165,0)");
    }

    return found;
}

/*function highlightMessageWords(messageElement) {
    const messageSpan = messageElement.querySelector("#message");
    let messageHTML = messageSpan.innerHTML;

    if (!highlightWords || highlightWords.length === 0) return false;
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
        return true;
    }
    return false;
}
*/

function hilightMention(message) {
    const messageSpan = message.querySelector("#message");
    if (messageSpan?.querySelector(".mention")) {
        boxStyle(message, "rgba(65,113,46,0.5)", "rgb(7,101,4)");
        return true;
    }
    return false;
}

function hilightNewUser(message) {
    const messageSpan = message.querySelector("#author-name");
    if (!messageSpan) return false;
    const username = messageSpan.textContent.trim();
    let knownUsers = JSON.parse(localStorage.getItem("knownUsers")) || [];
    if (!knownUsers.includes(username)) {
        boxStyle(message, "rgba(129,76,188,0.5)", "rgb(174,11,236)");
        knownUsers.push(username);
        localStorage.setItem("knownUsers", JSON.stringify(knownUsers));
        return true;
    }
    return false;
}


function highlightDeletedMessages(message) {
    message.removeAttribute("is-deleted");
    message.removeAttribute("show-bar");

    let messageSpan = message.querySelector("#message");
    let deletedSpan = message.querySelector("#deleted-state");

    if (messageSpan && deletedSpan) {
        boxStyle(message, "rgb(139,0,0)", "rgb(228,67,67)");
        let deletedText = deletedSpan.innerText.trim();

        console.log(log.deletedProcessed(deletedSpan.innerText));
        customLog(log.deletedProcessed(deletedSpan.innerText));
        //messageSpan.innerHTML += ` (${deletedText})`;
        const extra = document.createElement("span");
        extra.textContent = ` (${deletedText})`;
        extra.style.fontWeight = "bold";
        messageSpan.appendChild(extra);
        deletedSpan.innerText = "";

        const showOriginal = message.querySelector("#show-original");
        if (showOriginal) {
            showOriginal.remove();
        }
        return true
    }
    return false;
}

function updateToggleButton(toggle, enabled) {
    toggle.textContent = enabled ? 'ON' : 'OFF';
    toggle.style.background = enabled ? '#4CAF50' : '#f44336';
}

function injectToggleButton(chatDoc) {
    if (chatDoc.getElementById('yt-highlighter-toggle')) return;

    const header = chatDoc.querySelector('yt-live-chat-header-renderer');
    if (!header) return;

    const overflowButton = header.querySelector('#overflow-button');
    if (!overflowButton) return;

    const toggle = chatDoc.createElement('button');
    toggle.id = 'yt-highlighter-toggle';
    toggle.textContent = globalEnabled ? 'ON' : 'OFF';
    toggle.style.cssText = `
        background: ${globalEnabled ? '#4CAF50' : '#f44336'};
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        margin-right: 4px;
        align-self: center;
    `;

    toggle.addEventListener('click', () => {
        globalEnabled = !globalEnabled;
        chrome.storage.local.set({ globalEnabled });
        updateToggleButton(toggle, globalEnabled);
    });

    overflowButton.parentNode.insertBefore(toggle, overflowButton);
}

function processMessage(message) {
    if (!globalEnabled) return;
}

function processMessage(message) {
    const isModerator = message?.getAttribute('author-type') === 'moderator';
    const isOwner = message?.getAttribute('author-type') === 'owner';
    if(isOwner) return;

    const isDeleted = message.hasAttribute("is-deleted");

    if (!isModerator && newUserEnabled && hilightNewUser(message)) {
        console.log("New user")
    }
    // Esegui sempre il controllo sui messaggi cancellati
    if (isDeleted && deletedEnabled && highlightDeletedMessages(message)) {
        console.log("New delated")
        return;
    }
    if (message.dataset.highlighted) return;
    message.dataset.highlighted = "true";
    // Highlight messaggi dei moderatori
    if (isModerator && highlightMods) {
        boxStyle(message, 'rgba(45,163,163,0.5)', "rgb(45,163,163)");
        console.log("New Mod message")
        return;
    }
    // Highlight messaggi con alcune word
    if (!isModerator && highlightEnabled && highlightMessageWords(message)) {
        console.log("New sus message")
        return;
    }
    // Highlight menzioni
    if (!isModerator && highlightMentions && hilightMention(message)) {
        console.log("New Menton")
    }
}


function updateDeletedMessages() {
    const chatDoc = getChatFrameDocument();
    if (!chatDoc) {
        customLog(log.chatNotFound);
        return;
    }

    const messages = chatDoc.querySelectorAll("yt-live-chat-text-message-renderer");
    messages.forEach(message => {
        processMessage(message)
    });
}

function startObserver() {
    const chatDoc = getChatFrameDocument();
    if (!chatDoc) return;
    const chatContainer = chatDoc.querySelector("yt-live-chat-item-list-renderer");
    if (!chatContainer) {
        customLog(log.containerNotFound);
        return;
    }
    injectToggleButton(chatDoc);
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1 && node.matches("yt-live-chat-text-message-renderer")) {
                    processMessage(node);
                }
            }
        }
    });
    observer.observe(chatContainer, {
        childList: true,
        subtree: true   // NECESSARIO per vedere i renderer
    });
    updateDeletedMessages();
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.globalEnabled !== undefined) {
        globalEnabled = changes.globalEnabled.newValue;
        const chatDoc = getChatFrameDocument();
        if (chatDoc) {
            const toggle = chatDoc.getElementById('yt-highlighter-toggle');
            if (toggle) updateToggleButton(toggle, globalEnabled);
        }
    }
});

const checkInterval = setInterval(async () => {
    const chatDoc = getChatFrameDocument();
    const chatContainer = chatDoc ? getChatContainer(chatDoc) : null;
    if (chatDoc && chatContainer) {
        customLog(log.chatReady);
        clearInterval(checkInterval);
        await loadGlobalEnabled();
        await loadSettings();
        await loadHighlightWords();
        console.log("highlightMentions: ", highlightMentions)
        console.log("highlightMods: ", highlightMods)
        console.log("deletedEnabled: ", deletedEnabled)
        console.log("highlightEnabled: ", highlightEnabled)
        console.log("highlightMentions: ", highlightMentions)
        console.log("newUserEnabled: ", newUserEnabled)
        console.log("globalEnabled: ", globalEnabled)
        startObserver();
        setInterval(updateDeletedMessages, 1000);
    }
}, 1000);
