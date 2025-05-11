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

function customLog(message) {
  console.log(message); // continua a loggare in console normale
  chrome.storage.local.get({ logEntries: [] }, (data) => {
    const logs = data.logEntries;
    logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
    if (logs.length > 50) logs.shift(); // mantieni max 50 log
    chrome.storage.local.set({logEntries: logs}).then();
  });
}

async function loadHighlightWords() {
  try {
    const response = await fetch(chrome.runtime.getURL("words.json"));
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

function highlightMessageWords(messageElement) {
  let messageSpan = messageElement.querySelector("#message");
  let messageHTML = messageSpan.innerHTML;

  highlightWords.forEach(word => {
    let regex = new RegExp(`\\b${word}\\b`, 'gi');

    let newMessageHTML = messageHTML.replace(regex, `<span style="color: #ffa500; font-weight: bold; text-decoration: underline;">$&</span>`);
    if (newMessageHTML !== messageHTML) {
      messageElement.style.backgroundColor = "rgb(81,81,81)"; //rgb(152 102 45 / 87%)
      messageElement.style.border = '0.3rem solid'
      messageElement.style.borderColor = "rgb(191,187,187)";
      customLog(log.wordFound(word));
      messageHTML = newMessageHTML;
    }
    });
    messageSpan.innerHTML = messageHTML;
}

function processDeletedMessages(message) {
  if (message.hasAttribute("is-deleted")) {
    message.removeAttribute("is-deleted");
    message.removeAttribute("show-bar");

    let messageSpan = message.querySelector("#message");
    let deletedSpan = message.querySelector("#deleted-state");

    if (messageSpan && deletedSpan) {
      message.style.backgroundColor = "rgb(139,0,0)";
      message.style.border = '0.3rem solid'
      message.style.borderColor = "rgb(202,138,138)";
      let deletedText = deletedSpan.innerText.trim();

      console.log(log.deletedProcessed(deletedSpan.innerText));
      customLog(log.deletedProcessed(deletedSpan.innerText));
      messageSpan.innerHTML += ` (${deletedText})`;
      deletedSpan.innerText = "";

      const showOriginal = message.querySelector("#show-original");
      if (showOriginal) {
        showOriginal.remove();
      }
      messageSpan.style.textDecoration = "underline";
      //messageSpan.style.color = "rgba(255, 255, 255, 0.5)";
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
    if (mod) {
      message.style.backgroundColor = 'rgba(45,163,163,0.43)'
      message.style.border = '0.3rem solid'
      message.style.borderColor = 'rgba(182,218,227,0.43)'
    }
    if (!message.dataset.highlighted && !mod) {
      highlightMessageWords(message);
      message.dataset.highlighted = "true";
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
  observer.observe(chatContainer, { childList: true, subtree: true });
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
