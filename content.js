let highlightWords = []
function customLog(message) {
  console.log(message); // continua a loggare in console normale
  chrome.storage.local.get({ logEntries: [] }, (data) => {
    const logs = data.logEntries;
    logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
    if (logs.length > 50) logs.shift(); // mantieni max 50 log
    chrome.storage.local.set({ logEntries: logs });
  });
}

async function loadHighlightWords() {
  try {
    const response = await fetch(chrome.runtime.getURL("words.json"));
    const data = await response.json();
    highlightWords = data.highlightWords || [];
    customLog("📂 Parole evidenziate caricate da words.json");
  } catch (error) {
    customLog("❌ Errore nel caricamento di words.json: " + error);
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

    let newMessageHTML = messageHTML.replace(regex, `<span style="color: red; font-weight: bold; text-decoration: underline;">$&</span>`);
    if (newMessageHTML !== messageHTML) {
      messageElement.style.backgroundColor = "rgba(180,159,23,0.87)";
      customLog(`🔨 Parola bannata "${word}" trovata nel messaggio: ${messageHTML}`);
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
      message.style.backgroundColor = "rgba(139, 0, 0, 0.6)";
      let deletedText = deletedSpan.innerText.trim();

      console.log(`🔨 Processo messaggio eliminato: ${messageSpan.innerHTML}`);
      customLog(`🔨 Processo ${deletedSpan.innerText}`)

      messageSpan.innerHTML += ` (${deletedText})`;
      deletedSpan.innerText = "";

      const showOriginal = message.querySelector("#show-original");
      if (showOriginal) {
        showOriginal.remove();
      }
      messageSpan.style.textDecoration = "underline";
      messageSpan.style.color = "rgba(255, 255, 255, 0.5)";
    }
  }
}

function updateDeletedMessages() {
  const chatDoc = getChatFrameDocument();
  if (!chatDoc) {
    customLog("❌ Impossibile trovare il documento della chat.");
    return;
  }

  const messages = chatDoc.querySelectorAll("yt-live-chat-text-message-renderer");
  messages.forEach((message) => {
    let mod = message?.getAttribute('author-type') === 'moderator'
    if (mod) {
      message.style.backgroundColor = 'rgba(79,221,221,0.43)'
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
    customLog("❌ Contenitore della chat non trovato. Riprovo...");
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
    customLog("✅ Chat iframe e contenitore trovati, avvio script...");
    clearInterval(checkInterval);
    await loadHighlightWords();
    startObserver();
    setInterval(updateDeletedMessages, 1000);
  }
}, 1000);
