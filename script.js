const form = document.getElementById("chatForm");
const input = document.getElementById("userInput");
const chatLog = document.getElementById("chatLog");
const template = document.getElementById("chatBubbleTemplate");
const apiKeyForm = document.getElementById("apiKeyForm");
const apiKeyInput = document.getElementById("apiKeyInput");
const apiKeyStatus = document.getElementById("apiKeyStatus");
const clearKeyButton = document.getElementById("clearApiKey");

const GEMINI_MODEL = "gemini-pro";
const API_KEY_STORAGE_KEY = "geminiApiKey";

const safeFallback =
  "I couldn't reach Gemini right now. Double-check your API key and internet connection, then try again.";

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function createBubble({ text, owner }) {
  const clone = template.content.cloneNode(true);
  const bubble = clone.querySelector(".bubble");
  const name = clone.querySelector(".bubble-name");
  const time = clone.querySelector(".bubble-time");
  const body = clone.querySelector(".bubble-text");

  bubble.classList.add(owner);
  name.textContent = owner === "user" ? "You" : "AA";
  time.textContent = formatTime(new Date());
  body.textContent = text;
  return bubble;
}

function appendMessage(payload) {
  const bubble = createBubble(payload);
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setApiKeyStatus(message, variant = "info") {
  if (!apiKeyStatus) return;
  apiKeyStatus.textContent = message;
  apiKeyStatus.dataset.variant = variant;
  apiKeyStatus.hidden = !message;
}

function persistApiKey(value, { silent = false } = {}) {
  try {
    if (value) {
      localStorage.setItem(API_KEY_STORAGE_KEY, value);
      if (!silent) {
        setApiKeyStatus("Key saved locally in this browser.", "success");
      }
      return;
    }

    localStorage.removeItem(API_KEY_STORAGE_KEY);
    if (!silent) {
      setApiKeyStatus("Key cleared from local storage.", "muted");
    }
  } catch (error) {
    console.warn("Unable to access localStorage", error);
    if (!silent) {
      setApiKeyStatus("Unable to use local storage in this browser.", "error");
    }
  }
}

function loadSavedApiKey() {
  try {
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored && apiKeyInput) {
      apiKeyInput.value = stored;
      setApiKeyStatus("Loaded saved key from this browser.", "muted");
    }
  } catch (error) {
    console.warn("Unable to read localStorage", error);
  }
}

async function getAiResponse({ message, apiKey }) {
  if (!apiKey) {
    throw new Error("Missing Gemini API key");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: message }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const detail = errorBody?.error?.message || response.statusText;
    throw new Error(detail || "Gemini request failed");
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || null;

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}

function showTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "typing-indicator bubble";
  indicator.innerHTML = `
    <div class="avatar" aria-hidden="true"></div>
    <div class="bubble-body">
      <div class="bubble-meta">
        <span class="bubble-name">AA</span>
        <time class="bubble-time">${formatTime(new Date())}</time>
      </div>
      <p class="bubble-text">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </p>
    </div>
  `;
  chatLog.appendChild(indicator);
  chatLog.scrollTop = chatLog.scrollHeight;
  return indicator;
}

apiKeyForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = apiKeyInput?.value.trim();
  if (!value) {
    setApiKeyStatus("Enter a Gemini API key before saving.", "error");
    apiKeyInput?.focus();
    return;
  }

  persistApiKey(value);
});

clearKeyButton?.addEventListener("click", () => {
  if (!apiKeyInput) return;
  apiKeyInput.value = "";
  persistApiKey("");
  apiKeyInput.focus();
});

loadSavedApiKey();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  appendMessage({ text: message, owner: "user" });
  input.value = "";
  input.focus();

  const indicator = showTypingIndicator();

  try {
    const apiKey = apiKeyInput?.value.trim();
    if (!apiKey) {
      indicator.remove();
      setApiKeyStatus("Add your Gemini API key before chatting.", "error");
      appendMessage({
        text: "Please add your Gemini API key above so I can reach Gemini.",
        owner: "assistant",
      });
      apiKeyInput?.focus();
      return;
    }

    persistApiKey(apiKey, { silent: true });
    const reply = await getAiResponse({ message, apiKey });
    indicator.remove();
    appendMessage({ text: reply, owner: "assistant" });
  } catch (error) {
    indicator.remove();
    console.error("Gemini error:", error);
    appendMessage({ text: safeFallback, owner: "assistant" });
  }
});

