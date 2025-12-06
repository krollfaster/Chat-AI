/**
 * AI Chat Hub - Main Application
 */

// ===========================================
// Available AI Models
// ===========================================
const AI_MODELS = [
    { id: 'gemini', name: 'Gemini Pro', icon: 'G', iconClass: 'gemini' },
    { id: 'gpt', name: 'GPT-4', icon: 'G', iconClass: 'gpt' },
    { id: 'claude', name: 'Claude 3', icon: 'C', iconClass: 'claude' }
];

// ===========================================
// State Management
// ===========================================
const state = {
    currentUser: null,
    chats: [],
    activeChat: null,
    currentModel: AI_MODELS[0]
};

// ===========================================
// DOM Elements
// ===========================================
const elements = {
    newChatBtn: document.getElementById('newChatBtn'),
    chatsList: document.getElementById('chatsList'),
    contentArea: document.getElementById('contentArea')
};

// ===========================================
// Chat Management
// ===========================================

/**
 * Create a new chat
 */
function createNewChat() {
    // If we are already in "new chat" mode (activeChat is null), do nothing or reset input
    if (state.activeChat === null) {
        const welcomeInput = document.getElementById('welcomeInput');
        if (welcomeInput) welcomeInput.focus();
        return;
    }

    state.activeChat = null;
    renderChatsList();
    renderContentArea();
    updateNewChatButtonState();
}

/**
 * Start a new chat from the welcome input
 */
async function startNewChatFromInput(text) {
    if (!text.trim() || !state.currentUser) return;

    // Create a temporary chat object to show immediately
    const tempChatId = 'temp_' + Date.now();
    const now = new Date();

    const tempChat = {
        id: tempChatId,
        title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
        createdAt: now,
        model: state.currentModel,
        messages: [{
            id: Date.now(),
            role: 'user',
            content: text,
            timestamp: now
        }]
    };

    // Add temporary chat to state and activate it
    state.chats.unshift(tempChat);
    state.activeChat = tempChatId;

    // Render UI immediately so user sees their message
    renderChatsList();
    renderContentArea();
    updateNewChatButtonState();

    // Show typing indicator
    const messagesArea = document.getElementById('messagesArea');
    if (messagesArea) {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'message assistant';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="message-bubble">
                    <div class="typing-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        `;
        messagesArea.appendChild(typingDiv);
        scrollToBottom();
    }

    // Now send to API
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                userId: state.currentUser.id,
                model: state.currentModel.name
            })
        });

        const data = await response.json();

        // Remove typing indicator
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) typingIndicator.remove();

        if (data.error) throw new Error(data.error);

        // Reload chats to get the real chat ID from server
        const chatsRes = await fetch(`/api/chats?userId=${state.currentUser.id}`);
        const chats = await chatsRes.json();

        state.chats = chats.map(c => ({
            ...c,
            createdAt: new Date(c.created_at || c.createdAt),
            messages: []
        }));

        // Set the new real chat active and load its messages
        await setActiveChat(data.chatId);

    } catch (error) {
        console.error('Error creating chat:', error);

        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) typingIndicator.remove();

        // Show error in temp chat
        const tempChatInState = state.chats.find(c => c.id === tempChatId);
        if (tempChatInState) {
            tempChatInState.messages.push({
                id: Date.now(),
                role: 'model',
                content: '⚠️ Ошибка при создании чата. Попробуйте снова.',
                timestamp: new Date()
            });
            renderMessages();
        }
    }
}

/**
 * Delete a chat
 */
async function deleteChat(chatId, event) {
    event.stopPropagation();

    // Normalize chatId type
    if (typeof chatId === 'string' && !chatId.startsWith('temp_') && !isNaN(chatId)) {
        chatId = Number(chatId);
    }

    if (!confirm('Вы уверены, что хотите удалить этот чат?')) return;

    try {
        await fetch(`/api/chat/${chatId}`, { method: 'DELETE' });

        const index = state.chats.findIndex(c => c.id === chatId);
        if (index !== -1) {
            state.chats.splice(index, 1);

            if (state.activeChat === chatId) {
                state.activeChat = null; // Go back to welcome screen
            }

            renderChatsList();
            renderContentArea();
            updateNewChatButtonState();
        }
    } catch (error) {
        console.error('Error deleting chat:', error);
    }
}

/**
 * Set active chat
 */
/**
 * Set active chat
 */
async function setActiveChat(chatId) {
    // Normalize chatId type
    if (typeof chatId === 'string' && !chatId.startsWith('temp_') && !isNaN(chatId)) {
        chatId = Number(chatId);
    }

    if (state.activeChat === chatId) return;

    state.activeChat = chatId;

    // Fetch full chat details including messages
    try {
        const response = await fetch(`/api/chat/${chatId}`);
        const chatData = await response.json();

        // Update chat in state with full details
        const index = state.chats.findIndex(c => c.id === chatId);
        if (index !== -1) {
            state.chats[index] = {
                ...state.chats[index],
                messages: chatData.messages.map(msg => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp) // Ensure Date object
                }))
            };
        }
    } catch (error) {
        console.error('Error loading chat:', error);
    }

    renderChatsList();
    renderContentArea();
    updateNewChatButtonState();
}

/**
 * Get active chat object
 */
function getActiveChat() {
    return state.chats.find(c => c.id === state.activeChat);
}

/**
 * Format relative time
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;

    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short'
    });
}

/**
 * Format message time
 */
function formatMessageTime(date) {
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ===========================================
// Message Handling
// ===========================================

/**
 * Send a message
 */
function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text || !state.activeChat) return;

    const chat = getActiveChat();
    if (!chat) return;

    // Add user message optimistically
    const userMessage = {
        id: Date.now(),
        role: 'user',
        content: text,
        timestamp: new Date()
    };

    chat.messages.push(userMessage);

    // Clear input
    input.value = '';
    autoResizeTextarea(input);

    // Re-render messages
    renderMessages();

    // Trigger AI response
    getAIResponse(chat.id, text, false);
}

/**
 * Handle welcome input keydown
 */
function handleWelcomeInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const input = event.target;
        startNewChatFromInput(input.value);
    }
}

/**
 * Get AI response from Gemini API
 */
async function getAIResponse(chatId, messageText, isNewChat = false) {
    // Show typing indicator
    const messagesArea = document.getElementById('messagesArea');
    // Only show typing indicator if we are in the chat view (not needed for new chat initial loading if we rely on setActiveChat)
    if (!isNewChat && messagesArea) {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'message assistant';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="message-bubble">
                    <div class="typing-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        `;
        messagesArea.appendChild(typingDiv);
        scrollToBottom();
    }

    try {
        const payload = {
            message: messageText,
            userId: state.currentUser.id,
            model: state.currentModel.name
        };

        if (!isNewChat) {
            payload.chatId = chatId;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Remove typing indicator
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) typingIndicator.remove();

        if (data.error) {
            throw new Error(data.error);
        }

        if (isNewChat) {
            // Reload chats list to get the new chat and set it active
            const chatsRes = await fetch(`/api/chats?userId=${state.currentUser.id}`);
            const chats = await chatsRes.json();

            state.chats = chats.map(c => ({
                ...c,
                createdAt: new Date(c.created_at || c.createdAt),
                messages: []
            }));

            await setActiveChat(data.chatId);
        } else {
            // Add assistant response to active chat
            const chat = state.chats.find(c => c.id === chatId);
            if (chat) {
                chat.messages.push({
                    id: Date.now(),
                    role: 'model',
                    content: data.response,
                    timestamp: new Date()
                });
                renderMessages();
            }
        }

    } catch (error) {
        console.error('API Error:', error);

        // Remove typing indicator
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) typingIndicator.remove();

        if (!isNewChat) {
            const chat = state.chats.find(c => c.id === chatId);
            if (chat) {
                chat.messages.push({
                    id: Date.now(),
                    role: 'model',
                    content: '⚠️ Ошибка при получении ответа. Попробуйте обновить страницу.',
                    timestamp: new Date()
                });
                renderMessages();
            }
        }
    }
}

/**
 * Scroll messages to bottom
 */
function scrollToBottom() {
    const messagesArea = document.getElementById('messagesArea');
    if (messagesArea) {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }
}

/**
 * Auto-resize textarea
 */
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

/**
 * Update send button state based on input content
 */
function updateWelcomeSendButtonVisibility(textarea) {
    const sendBtn = document.getElementById('welcomeSendBtn');
    const micBtn = textarea.closest('.welcome-input-card')?.querySelector('[onclick*="handleMicrophoneClick"]');
    const hasText = textarea.value.trim().length > 0;

    if (sendBtn) {
        if (hasText) {
            sendBtn.style.display = 'flex';
            sendBtn.disabled = false;
            sendBtn.classList.add('active');
        } else {
            sendBtn.style.display = 'none';
            sendBtn.disabled = true;
            sendBtn.classList.remove('active');
        }
    }

    if (micBtn) {
        micBtn.style.display = hasText ? 'none' : 'flex';
    }
}

/**
 * Update send button state for active chat input
 */
function updateChatSendButtonVisibility(textarea) {
    const sendBtn = document.getElementById('chatSendBtn');
    if (sendBtn) {
        if (textarea.value.trim().length > 0) {
            sendBtn.disabled = false;
            sendBtn.classList.add('active');
        } else {
            sendBtn.disabled = true;
            sendBtn.classList.remove('active');
        }
    }
}

/**
 * Handle input keydown
 */
function handleInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// ===========================================
// Model Selection
// ===========================================



// ===========================================
// Rendering Functions
// ===========================================

/**
 * Render the chats list
 */
/**
 * Get date label for grouping
 */
function getDateLabel(date) {
    const d = new Date(date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const checkDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (checkDate.getTime() === today.getTime()) return 'Сегодня';
    if (checkDate.getTime() === yesterday.getTime()) return 'Вчера';
    if (checkDate > sevenDaysAgo) return 'Предыдущие 7 дней';
    return 'Ранее';
}

/**
 * Render the chats list
 */
function renderChatsList() {
    const sectionHeader = document.getElementById('chatsSectionHeader');

    if (state.chats.length === 0) {
        elements.chatsList.innerHTML = '';
        if (sectionHeader) sectionHeader.style.display = 'none';
        return;
    }

    if (sectionHeader) sectionHeader.style.display = 'block';

    // Group chats
    const groups = {
        'Сегодня': [],
        'Вчера': [],
        'Предыдущие 7 дней': [],
        'Ранее': []
    };

    state.chats.forEach(chat => {
        const label = getDateLabel(chat.createdAt);
        if (groups[label]) {
            groups[label].push(chat);
        } else {
            groups['Ранее'].push(chat);
        }
    });

    // Render HTML
    let html = '';

    // Group order
    const groupOrder = ['Сегодня', 'Вчера', 'Предыдущие 7 дней', 'Ранее'];

    groupOrder.forEach(label => {
        const groupChats = groups[label];
        if (groupChats.length > 0) {
            const isOpen = label === 'Сегодня' ? 'open' : ''; // Open 'Today' by default

            html += `
                <details class="chat-group" ${isOpen}>
                    <summary class="chat-group-header">
                        <svg class="group-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        ${label}
                    </summary>
                    <div class="chat-group-content">
                        ${groupChats.map(chat => `
                            <div class="chat-item ${chat.id === state.activeChat ? 'active' : ''}" 
                                onclick="setActiveChat('${chat.id}')"
                                data-chat-id="${chat.id}">
                                <div class="chat-info">
                                    <div class="chat-title">${escapeHtml(chat.title)}</div>
                                </div>
                                <div class="chat-actions">
                                    <button class="chat-action-btn delete" onclick="deleteChat('${chat.id}', event)" title="Удалить">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </details>
            `;
        }
    });

    elements.chatsList.innerHTML = html;
}

/**
 * Render content area
 */
function renderContentArea() {
    // If no active chat, show Welcome Input (Instant Chat)
    if (!state.activeChat) {
        elements.contentArea.innerHTML = `
            <div class="welcome-container">
                <div class="welcome-header">
                    <h1 class="welcome-title">Чем могу помочь?</h1>
                    <p class="welcome-subtitle">Я готов ответить на ваши вопросы и помочь с задачами</p>
                </div>
                
                <div class="welcome-input-card">
                    <div class="welcome-input-top">
                        <textarea 
                            id="welcomeInput" 
                            class="welcome-textarea" 
                            placeholder="Задай мне вопрос или задачу" 
                            rows="1"
                            onkeydown="handleWelcomeInputKeydown(event)"
                            oninput="autoResizeTextarea(this); updateWelcomeSendButtonVisibility(this);"
                        ></textarea>
                    </div>
                    
                    <div class="welcome-actions">
                        <div class="welcome-actions-left">
                            <button class="welcome-icon-btn" title="Прикрепить файл">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M21.44 11.05L12.25 20.24C11.1242 21.3658 9.59718 21.9983 8.005 21.9983C6.41282 21.9983 4.88584 21.3658 3.76 20.24C2.63416 19.1142 2.00166 17.5872 2.00166 15.995C2.00166 14.4028 2.63416 12.8758 3.76 11.75L12.33 3.18C13.0806 2.42975 14.0991 2.00874 15.16 2.00874C16.2209 2.00874 17.2394 2.42975 17.99 3.18C18.7403 3.93063 19.1613 4.94905 19.1613 6.01C19.1613 7.07095 18.7403 8.08937 17.99 8.84L9.41 17.41C9.03472 17.7853 8.52559 17.9961 7.995 17.9961C7.46441 17.9961 6.95528 17.7853 6.58 17.41C6.20472 17.0347 5.99389 16.5256 5.99389 15.995C5.99389 15.4644 6.20472 14.9553 6.58 14.58L15.07 6.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </button>
                            
                            <!-- Model Selector -->
                            <div class="model-selector-container">
                                <button class="welcome-icon-btn model-btn" id="modelSelectorBtn" onclick="toggleModelDropdown(event)" title="Выбрать модель">
                                    <span id="currentModelName">Gemini 2.0 Flash</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </button>
                                <div class="model-dropdown" id="modelDropdown">
                                    <button class="model-option active" onclick="selectModel('Gemini 2.0 Flash')">Gemini 2.0 Flash</button>
                                    <button class="model-option" onclick="selectModel('Gemini 1.5 Pro')">Gemini 1.5 Pro</button>
                                    <button class="model-option" onclick="selectModel('Gemini 1.5 Flash')">Gemini 1.5 Flash</button>
                                </div>
                            </div>
                        </div>
                        <div class="welcome-actions-right">
                            <button class="welcome-icon-btn" onclick="handleMicrophoneClick(event)" title="Голосовой ввод">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 1C11.2044 1 10.4413 1.31607 9.87868 1.87868C9.31607 2.44129 9 3.20435 9 4V12C9 12.7956 9.31607 13.5587 9.87868 14.1213C10.4413 14.6839 11.2044 15 12 15C12.7956 15 13.5587 14.6839 14.1213 14.1213C14.6839 13.5587 15 12.7956 15 12V4C15 3.20435 14.6839 2.44129 14.1213 1.87868C13.5587 1.31607 12.7956 1 12 1Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M19 10V12C19 15.866 15.866 19 12 19M5 10V12C5 15.866 8.13401 19 12 19M12 19V23M8 23H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </button>
                            <button id="welcomeSendBtn" class="welcome-pill-btn submit-btn" style="display: none" onclick="startNewChatFromInput(document.getElementById('welcomeInput').value)" disabled>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span>Отправить</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Focus input
        setTimeout(() => {
            const input = document.getElementById('welcomeInput');
            if (input) input.focus();
        }, 0);

        return;
    }

    // Render Active Chat
    const chat = getActiveChat();
    if (!chat) return;

    elements.contentArea.innerHTML = `
        <div class="chat-container">

            
            <!-- Messages Area -->
            <div class="messages-area" id="messagesArea">
                ${renderMessagesHTML(chat)}
            </div>
            
            <!-- Input Area -->
            <div class="input-area">
                <div class="input-container">
                    <div class="input-wrapper">
                        <div class="input-actions-left">
                            <button class="input-action-btn" title="Прикрепить файл">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M21.44 11.05L12.25 20.24C11.1242 21.3658 9.59718 21.9983 8.005 21.9983C6.41282 21.9983 4.88584 21.3658 3.76 20.24C2.63416 19.1142 2.00166 17.5872 2.00166 15.995C2.00166 14.4028 2.63416 12.8758 3.76 11.75L12.33 3.18C13.0806 2.42975 14.0991 2.00874 15.16 2.00874C16.2209 2.00874 17.2394 2.42975 17.99 3.18C18.7403 3.93063 19.1613 4.94905 19.1613 6.01C19.1613 7.07095 18.7403 8.08937 17.99 8.84L9.41 17.41C9.03472 17.7853 8.52559 17.9961 7.995 17.9961C7.46441 17.9961 6.95528 17.7853 6.58 17.41C6.20472 17.0347 5.99389 16.5256 5.99389 15.995C5.99389 15.4644 6.20472 14.9553 6.58 14.58L15.07 6.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </button>
                        </div>
                        <textarea 
                            id="messageInput" 
                            class="message-input" 
                            placeholder="Введите сообщение..." 
                            rows="1"
                            onkeydown="handleInputKeydown(event)"
                            oninput="autoResizeTextarea(this); updateChatSendButtonVisibility(this);"
                        ></textarea>
                        <button id="chatSendBtn" class="send-btn" onclick="sendMessage()" title="Отправить" style="display: none;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Focus input
    const input = document.getElementById('messageInput');
    if (input) input.focus();

    // Scroll to bottom
    scrollToBottom();
}

/**
 * Render messages HTML
 */
function renderMessagesHTML(chat) {
    if (chat.messages.length === 0) {
        return `
            <div class="empty-state" style="margin: auto;">
                <div class="empty-state-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <h2 class="empty-state-title">Начните диалог</h2>
                <p class="empty-state-description">
                    Введите сообщение, чтобы начать общение с ${chat.model.name}
                </p>
            </div>
        `;
    }

    return chat.messages.map(msg => `
        <div class="message ${msg.role}">
            <div class="message-avatar">
                ${msg.role === 'user'
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                       </svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                       </svg>`
        }
            </div>
            <div class="message-content">
                <div class="message-bubble">${marked.parse(msg.content)}</div>
                <div class="message-time">${formatMessageTime(msg.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Re-render just the messages
 */
function renderMessages() {
    const chat = getActiveChat();
    if (!chat) return;

    const messagesArea = document.getElementById('messagesArea');
    if (messagesArea) {
        messagesArea.innerHTML = renderMessagesHTML(chat);
        scrollToBottom();
    }

    // Update header subtitle
    const subtitle = document.querySelector('.chat-header-subtitle');
    if (subtitle) {
        subtitle.textContent = `${chat.messages.length} сообщений`;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===========================================
// Event Listeners
// ===========================================
elements.newChatBtn.addEventListener('click', createNewChat);

// ===========================================
// Model Selection
// ===========================================
function toggleModelDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('modelDropdown');

    // Close other dropdowns
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));

    dropdown.classList.toggle('active');
}

function selectModel(modelName) {
    const btnText = document.querySelector('#modelSelectorBtn span');
    if (btnText) {
        btnText.textContent = modelName;
    }

    // Update active class in dropdown
    document.querySelectorAll('.model-option').forEach(opt => {
        if (opt.textContent === modelName) {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });

    const dropdown = document.getElementById('modelDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('modelDropdown');
    const selectorBtn = document.getElementById('modelSelectorBtn');

    if (dropdown && dropdown.classList.contains('active') &&
        !dropdown.contains(event.target) &&
        !selectorBtn.contains(event.target)) {
        dropdown.classList.remove('active');
    }

    // Close profile popup when clicking outside
    const profilePopup = document.getElementById('profilePopup');
    const userBtn = document.getElementById('userIconBtn');

    if (profilePopup && profilePopup.classList.contains('active') &&
        !profilePopup.contains(event.target) &&
        !userBtn.contains(event.target)) {
        profilePopup.classList.remove('active');
    }
});

// ===========================================
// Profile Popup
// ===========================================
function toggleProfilePopup(event) {
    event.stopPropagation();
    const popup = document.getElementById('profilePopup');
    popup.classList.toggle('active');
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти из аккаунта?')) {
        // Здесь будет логика выхода (очистка токена, кук и т.д.)
        // Пока просто перезагружаем страницу
        window.location.reload();
    }
}

function closeProfilePopup() {
    const popup = document.getElementById('profilePopup');
    popup.classList.remove('active');
}

// ===========================================
// Voice Recording Overlay
// ===========================================
const voiceOverlay = document.getElementById('voiceOverlay');
const voiceCancelBtn = document.getElementById('voiceCancelBtn');
const voiceConfirmBtn = document.getElementById('voiceConfirmBtn');

/**
 * Show voice overlay
 */
function showVoiceOverlay() {
    voiceOverlay.classList.add('active');
}

/**
 * Hide voice overlay
 */
function hideVoiceOverlay() {
    voiceOverlay.classList.remove('active');
}

/**
 * Handle microphone button click
 */
function handleMicrophoneClick(event) {
    event.preventDefault();
    showVoiceOverlay();
}

// Voice overlay event listeners
voiceCancelBtn.addEventListener('click', hideVoiceOverlay);
voiceConfirmBtn.addEventListener('click', () => {
    // In the future, this will insert the transcribed text
    hideVoiceOverlay();
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && voiceOverlay.classList.contains('active')) {
        hideVoiceOverlay();
    }
});

// ===========================================
// Initialize
// ===========================================
/**
 * Initialize app
 */
// Auth State
let currentAuthMode = 'login';

async function init() {
    try {
        // Check for saved user
        const savedUserId = localStorage.getItem('chat_userId');

        if (savedUserId) {
            try {
                const userRes = await fetch(`/api/user?id=${savedUserId}`);
                if (userRes.ok) {
                    state.currentUser = await userRes.json();
                } else {
                    localStorage.removeItem('chat_userId');
                }
            } catch (e) {
                console.error('Auth check error', e);
            }
        }

        updateProfilePopupUI();

        if (state.currentUser) {
            // Load Chats
            const chatsRes = await fetch(`/api/chats?userId=${state.currentUser.id}`);
            const chats = await chatsRes.json();

            state.chats = chats.map(c => ({
                ...c,
                createdAt: new Date(c.created_at || c.createdAt),
                messages: []
            }));
        } else {
            state.chats = [];
        }

    } catch (error) {
        console.error('Initialization error:', error);
    }

    renderChatsList();
    renderContentArea();
    updateNewChatButtonState();
}

/**
 * Update Profile Popup UI based on auth state
 */
function updateProfilePopupUI() {
    const loggedIn = document.getElementById('profileLoggedIn');
    const loggedOut = document.getElementById('profileLoggedOut');
    const logoutBtn = document.getElementById('profileLogoutBtn');
    const avatarImg = document.getElementById('profileAvatarImg');
    const nameEl = document.querySelector('.profile-name');
    const emailEl = document.querySelector('.profile-email');
    const userBtn = document.getElementById('userIconBtn');

    if (state.currentUser) {
        if (loggedIn) loggedIn.style.display = 'flex';
        if (loggedOut) loggedOut.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'flex';

        if (nameEl) nameEl.textContent = state.currentUser.name;
        if (emailEl) emailEl.textContent = state.currentUser.email;

        let avatarHtml = '';
        if (state.currentUser.avatar && state.currentUser.avatar !== 'null') {
            if (avatarImg) avatarImg.src = state.currentUser.avatar;
            avatarHtml = `<img src="${state.currentUser.avatar}" alt="${state.currentUser.name}">`;
        } else {
            if (avatarImg) avatarImg.style.display = 'none'; // simplified
            const initial = state.currentUser.name ? state.currentUser.name.charAt(0).toUpperCase() : 'U';
            avatarHtml = `<span class="user-initial">${initial}</span>`;
        }

        if (userBtn) userBtn.innerHTML = avatarHtml;

    } else {
        if (loggedIn) loggedIn.style.display = 'none';
        if (loggedOut) loggedOut.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';

        if (userBtn) {
            userBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`;
        }
    }
}

// Auth Functions
function openAuthModal(mode) {
    currentAuthMode = mode;
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authTitle');
    const nameField = document.getElementById('nameField');
    const submitBtn = document.getElementById('authSubmitBtn');
    const nameInput = document.getElementById('authName');

    if (mode === 'login') {
        title.textContent = 'Вход';
        nameField.style.display = 'none';
        if (nameInput) nameInput.required = false;
        submitBtn.textContent = 'Войти';
    } else {
        title.textContent = 'Регистрация';
        nameField.style.display = 'flex';
        if (nameInput) nameInput.required = true;
        submitBtn.textContent = 'Зарегистрироваться';
    }

    // Close profile popup
    closeProfilePopup();

    modal.classList.add('active');
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    modal.classList.remove('active');
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value;

    const endpoint = currentAuthMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = currentAuthMode === 'login' ? { email, password } : { name, email, password };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Ошибка авторизации');
            return;
        }

        // Success
        localStorage.setItem('chat_userId', data.id);

        // Reload page to init fresh state
        window.location.reload();

    } catch (error) {
        console.error('Auth error:', error);
        alert('Произошла ошибка сети');
    }
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти из аккаунта?')) {
        localStorage.removeItem('chat_userId');
        window.location.reload();
    }
}

function updateNewChatButtonState() {
    const btn = elements.newChatBtn;
    if (!state.chats || state.chats.length === 0) {
        btn.style.display = 'none';
        return;
    }

    btn.style.display = 'flex';
    if (state.activeChat) {
        btn.disabled = false;
        btn.classList.remove('disabled');
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    } else {
        btn.disabled = true;
        btn.classList.add('disabled');
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
}

// Start the app
init();
