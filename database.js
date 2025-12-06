const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'chat_hub.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database ' + DB_PATH, err);
    } else {
        console.log('Connected to SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Create Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT,
            avatar TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (!err) {
                // Seed default user
                db.get("SELECT * FROM users WHERE email = ?", ['rickbacardin@gmail.com'], (err, row) => {
                    if (!row) {
                        db.run(`INSERT INTO users (name, email, password, avatar) VALUES (?, ?, ?, ?)`,
                            ['Bacardin', 'rickbacardin@gmail.com', '123456', 'logo.jpg'],
                            (err) => {
                                if (err) console.error("Error creating seed user:", err);
                                else console.log("Default user created.");
                            }
                        );
                    }
                });
            }
        });

        // Create Chats table
        db.run(`CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT,
            model TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Create Messages table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
        )`);
    });
}

// Database API
const dbApi = {
    // Users
    getUser: (email) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    getUserById: (id) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    getUserByEmail: (email) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    createUser: (name, email, password) => {
        return new Promise((resolve, reject) => {
            db.run("INSERT INTO users (name, email, password, avatar) VALUES (?, ?, ?, ?)",
                [name, email, password, null],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    // Chats
    getUserChats: (userId) => {
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM chats WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    createChat: (userId, title, model) => {
        return new Promise((resolve, reject) => {
            db.run("INSERT INTO chats (user_id, title, model) VALUES (?, ?, ?)",
                [userId, title, model],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    deleteChat: (chatId) => {
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM chats WHERE id = ?", [chatId], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },

    getChatById: (chatId) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM chats WHERE id = ?", [chatId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // Messages
    addMessage: (chatId, role, content) => {
        return new Promise((resolve, reject) => {
            db.run("INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)",
                [chatId, role, content],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    getChatMessages: (chatId) => {
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC", [chatId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

module.exports = dbApi;
