const API_ENDPOINT = '/api/chat';

const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const emptyState = document.querySelector('.empty-state');
const clearButton = document.getElementById('clear-chat');
const sendButton = document.getElementById('send-btn');
const useCaseSelect = document.getElementById('use-case');
const styleSelect = document.getElementById('style');
const domainInput = document.getElementById('domain');
const temperatureRange = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperature-value');
const memoryToggle = document.getElementById('use-memory');
const recommendationsToggle = document.getElementById('recommendations');
const promptButtons = document.querySelectorAll('.prompt-btn');

const state = {
  conversation: [],
  isLoading: false,
};

const setEmptyStateVisible = (isVisible) => {
  if (!emptyState) return;
  emptyState.style.display = isVisible ? 'block' : 'none';
};

const updateTemperatureLabel = () => {
  if (!temperatureRange || !temperatureValue) return;
  temperatureValue.textContent = Number(temperatureRange.value).toFixed(1);
};

const setLoading = (isLoading) => {
  state.isLoading = isLoading;
  sendButton.disabled = isLoading;
  input.disabled = isLoading;
  clearButton.disabled = isLoading;
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
  useCase: useCaseSelect.value,
  style: styleSelect.value,
  domain: domainInput.value.trim(),
  temperature: Number(temperatureRange.value),
  useMemory: memoryToggle.checked,
  includeRecommendations: recommendationsToggle.checked,
});

const sendMessage = async (userMessage) => {
  const userEntry = { role: 'user', text: userMessage };
  state.conversation.push(userEntry);

  const typingMessage = appendMessage('bot', 'Sedang mengetik...', { isTyping: true });
  setLoading(true);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation: state.conversation,
        options: getOptions(),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || 'Permintaan gagal diproses.');
    }

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
    setLoading(false);
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.isLoading) return;

  const userMessage = input.value.trim();
  if (!userMessage) return;

  appendMessage('user', userMessage);
  input.value = '';
  await sendMessage(userMessage);
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

temperatureRange.addEventListener('input', updateTemperatureLabel);
updateTemperatureLabel();
setEmptyStateVisible(true);
