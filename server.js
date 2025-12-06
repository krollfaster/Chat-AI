/**
 * AI Chat Hub - Backend Server
 * Express server with Gemini AI API integration
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();
// ... (imports)
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database');

const app = express();
const PORT = 3000;

// ===========================================
// Configuration
// ===========================================

// ВАЖНО: Замените YOUR_API_KEY на ваш ключ от Google AI Studio
// Получить ключ: https://aistudio.google.com/apikey
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY';

// Initialize Gemini AI
let genAI;
let model;

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_API_KEY') {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

// ===========================================
// Middleware
// ===========================================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ===========================================
// API Routes
// ===========================================

/**
/**
 * POST /api/auth/register
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });

        const existing = await db.getUserByEmail(email);
        if (existing) return res.status(400).json({ error: 'Email already in use' });

        const userId = await db.createUser(name, email, password);
        const user = await db.getUserById(userId);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.getUserByEmail(email);

        // Simple plain text password check for demo
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/user
 * Get current user by ID
 */
app.get('/api/user', async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(401).json({ error: 'No user ID provided' });
        }
        const user = await db.getUserById(id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/chats
 * Get user chats
 */
app.get('/api/chats', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const chats = await db.getUserChats(userId);
        res.json(chats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/chat/:id
 * Get chat messages
 */
app.get('/api/chat/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const messages = await db.getChatMessages(id);
        const chat = await db.getChatById(id);

        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        res.json({
            ...chat,
            messages: messages
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/chat/new
 * Create a new chat manually (optional, usually created on first message)
 */
app.post('/api/chat/new', async (req, res) => {
    try {
        const { userId, title, model } = req.body;
        const chatId = await db.createChat(userId, title || 'New Chat', model);

        // Return the full chat object
        const chat = await db.getChatById(chatId);
        res.json(chat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/chat
 * Send a message to Gemini AI and get a response
 */
app.post('/api/chat', async (req, res) => {
    try {
        // userId is needed to create a new chat if chatId provided is temporary/new
        let { message, chatId, history, userId, model: modelName } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!genAI) {
            return res.status(500).json({
                error: 'API ключ не настроен.'
            });
        }

        // Check if chat exists, if not create it
        if (!chatId || typeof chatId !== 'number') { // Assuming temporary IDs might be different or null
            // If chatId is not provided or invalid, we must have userId to create one
            if (!userId) {
                return res.status(400).json({ error: 'User ID required for new chat' });
            }
            chatId = await db.createChat(userId, message.slice(0, 30) + '...', modelName || 'Gemini 2.0 Flash');
        }

        // Save User Message
        await db.addMessage(chatId, 'user', message);

        // Get History for Context
        const dbMessages = await db.getChatMessages(chatId);
        // Transform DB messages to Gemini format
        const geminiHistory = dbMessages.slice(0, -1).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        // Configure Model (using default or selected)
        // Note: In a real app we might instantiate model based on request
        const currentModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const chatSession = currentModel.startChat({
            history: geminiHistory,
            generationConfig: {
                maxOutputTokens: 2048,
            },
        });

        // Send message
        const result = await chatSession.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        // Save Model Response
        await db.addMessage(chatId, 'model', text);

        res.json({
            response: text,
            chatId: chatId
        });

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({
            error: 'Ошибка при обращении к Gemini API',
            details: error.message
        });
    }
});

/**
 * DELETE /api/chat/:chatId
 * Delete chat
 */
app.delete('/api/chat/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        await db.deleteChat(chatId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===========================================
// Start Server
// ===========================================

app.listen(PORT, () => {
    console.log(`\n🚀 AI Chat Hub Server запущен!`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log('');
    if (genAI) {
        console.log('✅ Gemini API подключен');
    } else {
        console.log('⚠️ API ключ не настроен');
    }
});
