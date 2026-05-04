const API_ENDPOINT = '/api/chat';

const form = document.getElementById('composer-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const emptyState = document.querySelector('.empty-state');
const clearButton = document.getElementById('clear-chat');
const sendButton = document.getElementById('send-btn');
const styleSelect = document.getElementById('style');
const domainInput = document.getElementById('domain');
const temperatureRange = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperature-value');
const memoryToggle = document.getElementById('use-memory');
const recommendationsToggle = document.getElementById('recommendations');
const promptButtons = document.querySelectorAll('.prompt-btn');
const quickPrompts = document.querySelector('.quick-prompts');
const modeButtons = document.querySelectorAll('.mode-btn');
const fileFields = document.querySelectorAll('.file-field');
const toolResult = document.getElementById('tool-result');
const imageFileInput = document.getElementById('image-file');
const documentFileInput = document.getElementById('document-file');
const audioFileInput = document.getElementById('audio-file');

const FIXED_USE_CASE = 'customer service bot';

const MODE_CONFIG = {
  chat: {
    placeholder: 'Ketik pesan kamu di sini...',
    promptRequired: true,
    resultHint: 'Pilih mode text/image/doc/audio untuk output generator.',
  },
  text: {
    placeholder: 'Tulis prompt teks di sini...',
    promptRequired: true,
    endpoint: '/generate-text',
    resultHint: 'Output generator akan tampil di sini.',
  },
  image: {
    placeholder: 'Contoh: jelaskan isi gambar ini',
    promptRequired: true,
    endpoint: '/generate-image',
    fileKey: 'image',
    resultHint: 'Output generator akan tampil di sini.',
  },
  document: {
    placeholder: 'Opsional: ringkas atau cari poin penting',
    promptRequired: false,
    endpoint: '/generate-from-document',
    fileKey: 'document',
    resultHint: 'Output generator akan tampil di sini.',
  },
  audio: {
    placeholder: 'Opsional: transkrip atau ringkas audio',
    promptRequired: false,
    endpoint: '/generate-from-audio',
    fileKey: 'audio',
    resultHint: 'Output generator akan tampil di sini.',
  },
};

const fileInputs = {
  image: imageFileInput,
  document: documentFileInput,
  audio: audioFileInput,
};

const state = {
  conversation: [],
  isLoading: false,
  activeMode: 'chat',
};

const requestJson = async (url, options) => {
  const response = await fetch(url, options);
  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.message || 'Permintaan gagal diproses.');
  }

  return payload;
};

const updateResult = (element, message, status = 'default') => {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('loading', 'error');
  if (status === 'loading') element.classList.add('loading');
  if (status === 'error') element.classList.add('error');
};

const setComposerLoading = (isLoading) => {
  state.isLoading = isLoading;
  sendButton.disabled = isLoading;
  input.disabled = isLoading;
  clearButton.disabled = isLoading;
  modeButtons.forEach((button) => {
    button.disabled = isLoading;
  });
  promptButtons.forEach((button) => {
    button.disabled = isLoading;
  });
  Object.values(fileInputs).forEach((element) => {
    if (element) element.disabled = isLoading;
  });
};

const setEmptyStateVisible = (isVisible) => {
  if (!emptyState) return;
  emptyState.style.display = isVisible ? 'block' : 'none';
};

const updateTemperatureLabel = () => {
  if (!temperatureRange || !temperatureValue) return;
  temperatureValue.textContent = Number(temperatureRange.value).toFixed(1);
};

const appendMessage = (sender, text, options = {}) => {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  if (options.isTyping) msg.classList.add('typing');
  if (options.isError) msg.classList.add('error');
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  setEmptyStateVisible(false);
  return msg;
};

const getOptions = () => ({
  useCase: FIXED_USE_CASE,
  style: styleSelect.value,
  domain: domainInput.value.trim(),
  temperature: Number(temperatureRange.value),
  useMemory: memoryToggle.checked,
  includeRecommendations: recommendationsToggle.checked,
});

const setActiveMode = (mode) => {
  if (!MODE_CONFIG[mode]) return;
  state.activeMode = mode;
  updateModeUI();
};

const updateModeUI = () => {
  const config = MODE_CONFIG[state.activeMode];

  modeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === state.activeMode);
  });

  fileFields.forEach((field) => {
    field.classList.toggle('is-visible', field.dataset.mode === state.activeMode);
  });

  Object.values(fileInputs).forEach((element) => {
    if (element) element.value = '';
  });

  input.placeholder = config.placeholder;
  input.required = config.promptRequired;
  sendButton.textContent = state.activeMode === 'chat' ? 'Kirim' : 'Proses';

  if (quickPrompts) {
    quickPrompts.style.display = state.activeMode === 'chat' ? 'flex' : 'none';
  }

  updateResult(toolResult, config.resultHint || 'Output generator akan tampil di sini.');
};

const sendChatMessage = async (userMessage) => {
  const userEntry = { role: 'user', text: userMessage };
  state.conversation.push(userEntry);

  const typingMessage = appendMessage('bot', 'Sedang mengetik...', { isTyping: true });
  setComposerLoading(true);

  try {
    const payload = await requestJson(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation: state.conversation,
        options: getOptions(),
      }),
    });

    const resultText = (payload.result || '').trim();
    typingMessage.remove();

    if (!resultText) {
      appendMessage('bot', 'Maaf, belum ada jawaban yang bisa ditampilkan.', { isError: true });
      return;
    }

    appendMessage('bot', resultText);
    state.conversation.push({ role: 'model', text: resultText });
  } catch (error) {
    typingMessage.remove();
    appendMessage('bot', `Maaf, terjadi kendala: ${error.message}`, { isError: true });
  } finally {
    setComposerLoading(false);
  }
};

const runGenerator = async (prompt) => {
  const config = MODE_CONFIG[state.activeMode];

  if (config.promptRequired && !prompt) {
    updateResult(toolResult, 'Prompt tidak boleh kosong.', 'error');
    return;
  }

  let requestOptions = {
    method: 'POST',
  };

  if (config.fileKey) {
    const fileInput = fileInputs[state.activeMode];
    const file = fileInput?.files?.[0];

    if (!file) {
      updateResult(toolResult, 'Pilih file terlebih dahulu.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append(config.fileKey, file);
    if (prompt) formData.append('prompt', prompt);
    requestOptions.body = formData;
  } else {
    requestOptions.headers = { 'Content-Type': 'application/json' };
    requestOptions.body = JSON.stringify({ prompt });
  }

  updateResult(toolResult, 'Memproses...', 'loading');
  setComposerLoading(true);

  try {
    const payload = await requestJson(config.endpoint, requestOptions);
    const resultText = (payload.result || '').trim();
    updateResult(toolResult, resultText || 'Tidak ada output.');

    if (config.fileKey) {
      const fileInput = fileInputs[state.activeMode];
      if (fileInput) fileInput.value = '';
    }

    input.value = '';
  } catch (error) {
    updateResult(toolResult, `Gagal: ${error.message}`, 'error');
  } finally {
    setComposerLoading(false);
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.isLoading) return;

  const userMessage = input.value.trim();

  if (state.activeMode === 'chat') {
    if (!userMessage) return;
    appendMessage('user', userMessage);
    input.value = '';
    await sendChatMessage(userMessage);
    return;
  }

  await runGenerator(userMessage);
});

clearButton.addEventListener('click', () => {
  state.conversation = [];
  chatBox.innerHTML = '';
  if (emptyState) {
    chatBox.appendChild(emptyState);
  }
  setEmptyStateVisible(true);
  input.focus();
});

promptButtons.forEach((button) => {
  button.addEventListener('click', () => {
    input.value = button.dataset.prompt || '';
    input.focus();
  });
});

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveMode(button.dataset.mode);
  });
});

temperatureRange.addEventListener('input', updateTemperatureLabel);
updateTemperatureLabel();
setEmptyStateVisible(true);
updateModeUI();
