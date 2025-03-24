const highlightWords = ["schifo", "merda", "dio", "madonna", "fascista", "razzista","face", "faccia", "stronza", "chiami", "fidanzato", "fidanzata"]

// Funzione per ottenere il documento dentro l'iframe della chat
function insertSpaces(str) {
  let result = "";
  let temp = "";
  let i = 0;
  const length = str.length;

  while (i < length) {
    if (str.startsWith("<img", i)) {
      const closingIndex = str.indexOf(">", i);
      if (closingIndex !== -1) {
        result += str.slice(i, closingIndex + 1);
        i = closingIndex + 1;
        continue;
      }
    }

    const char = str[i];

    if (char !== " ") {
      temp += char;
      while (temp.length >= 45) {
        result += temp.slice(0, 40) + " ";
        temp = temp.slice(40);
      }
    } else {
      result += temp + " ";
      temp = "";
    }
    i++;
  }
  result += temp;
  return result;
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
  const deletedSpan = messageElement.querySelector("#deleted-state");

  // Solo se NON è eliminato
  if (messageSpan && !deletedSpan) {
    let messageHTML = messageSpan.innerHTML;
    highlightWords.forEach(word => {
      let regex = new RegExp(`(${word})`, 'gi');
      messageHTML = messageHTML.replace(regex, `<span style="color:red; text-decoration:underline;">$1</span>`);
    });
    messageSpan.innerHTML = messageHTML;
  }
}

function updateDeletedMessages() {
  const chatDoc = getChatFrameDocument();
  if (!chatDoc) {
    console.log("❌ Impossibile trovare il documento della chat.");
    return;
  }

  const messages = chatDoc.querySelectorAll("yt-live-chat-text-message-renderer");
  messages.forEach((message) => {
    const prevSibling = message.querySelector("#message");
    const deletedSpan = message.querySelector("#deleted-state");

    // Evidenzia solo i messaggi non eliminati
    if (!message.dataset.highlighted) {
      highlightMessageWords(message);
      message.dataset.highlighted = "true";
    }

    if (prevSibling && deletedSpan) {
      const deletedText = deletedSpan.innerText;
      if (deletedText.includes("Messaggio eliminato da") || deletedText.includes("[messaggio")) {
        if (!deletedSpan.dataset.processed) {
          console.log("Processo messaggio eliminato:", prevSibling.innerHTML);
          const messageEdited = `${prevSibling.innerHTML} ( ${deletedSpan.innerHTML} )`;
          const results = insertSpaces(messageEdited);

          if (results.length < 200) {
            deletedSpan.innerHTML = messageEdited;
          } else {
            deletedSpan.innerHTML = results;
          }

          message.style.backgroundColor = "rgba(139, 0, 0, 0.6)";
          deletedSpan.style.color = ""; // Reset colore
          deletedSpan.style.textDecoration = "underline";
          deletedSpan.dataset.processed = "true";
        }
        const showOriginal = message.querySelector("#show-original");
        if (showOriginal) {
          showOriginal.remove();
        }
      }
    }
  });
  resizeEmojis(chatDoc);
}

function resizeEmojis(chatDoc) {
  const emojis = chatDoc.querySelectorAll("img.style-scope.yt-live-chat-text-message-renderer");
  emojis.forEach((emoji) => {
    emoji.style.width = "24px";
    emoji.style.height = "24px";
  });
}

function startObserver() {
  const chatDoc = getChatFrameDocument();
  if (!chatDoc) return;
  const chatContainer = getChatContainer(chatDoc);
  if (!chatContainer) {
    console.log("❌ Contenitore della chat non trovato. Riprovo...");
    return;
  }
  const observer = new MutationObserver(updateDeletedMessages);
  observer.observe(chatContainer, { childList: true, subtree: true });
  updateDeletedMessages();
}

const checkInterval = setInterval(() => {
  const chatDoc = getChatFrameDocument();
  const chatContainer = chatDoc ? getChatContainer(chatDoc) : null;
  if (chatDoc && chatContainer) {
    console.log("✅ Chat iframe e contenitore trovati, avvio script...");
    clearInterval(checkInterval);
    startObserver();
    setInterval(updateDeletedMessages, 1000);
  }
}, 1000);
