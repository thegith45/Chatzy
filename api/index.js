const express = require('express');
require('dotenv').config();
const mongoose = require("mongoose");
const User = require('./models/User.js');
const Message = require('./models/Message.js');
const jwt = require('jsonwebtoken');
var cookieParser = require('cookie-parser');
var cors = require('cors');
var bcrypt = require('bcryptjs');
const ws = require('ws');
const fs = require('fs');
const path = require('path');

mongoose.connect(process.env.MONGO_URL).then(() => console.log("database connected"));

const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

const app = express();

app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
}));

async function getUserData(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies?.token;
        if (token) {
            jwt.verify(token, jwtSecret, {}, (err, userdata) => {
                if (err) reject(err);
                resolve(userdata);
            });
        } else {
            reject('no token');
        }
    });
}

app.get('/test', (req, res) => {
    res.json("test: ok");
});

app.get('/', (req, res) => {
    res.json({
        message: "Chat App API is running!",
        endpoints: {
            test: "/test",
            register: "/register",
            login: "/login",
            profile: "/profile",
            people: "/people",
            messages: "/messages/:userId"
        }
    });
});

app.get('/messages/:userId', async (req, res) => {
    const { userId } = req.params;
    const userData = await getUserData(req);
    const ourUserId = userData.userId;
    const messages = await Message.find({
        sender: { $in: [userId, ourUserId] },
        recipient: { $in: [userId, ourUserId] },
    }).sort({ createdAt: 1 });
    res.json(messages);
});

app.get('/people', async (req, res) => {
    const users = await User.find({}, { '_id': 1, username: 1 });
    res.json(users);
});

app.get('/profile', (req, res) => {
    const token = req.cookies?.token;
    if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userdata) => {
            if (err) throw err;
            res.json(userdata);
        });
    } else {
        res.status(401).json('no token');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username });
    if (foundUser) {
        const passOk = bcrypt.compareSync(password, foundUser.password);
        if (passOk) {
            jwt.sign({ userId: foundUser._id, username }, jwtSecret, {}, (err, token) => {
                if (err) throw err;
                res.cookie('token', token, { sameSite: 'none', secure: 'true' }).json({
                    id: foundUser._id,
                });
            });
        }
    }
});

app.post('/logout', (req, res) => {
    res.cookie('token', '', { sameSite: 'none', secure: true }).json('ok');
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
        const createdUser = await User.create({
            username: username,
            password: hashedPassword
        });
        jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token, { sameSite: "none", secure: true }).status(201).json({
                id: createdUser._id,
            });
        });
    } catch (err) {
        res.status(500).json('error');
    }
});

// DELETE message route
app.delete('/messages/:id', async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const userData = await getUserData(req);

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (message.sender.toString() !== userData.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (message.file) {
            const filePath = path.join(__dirname, 'uploads', message.file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await Message.findByIdAndDelete(messageId);

        // Notify all WebSocket clients
        wss.clients.forEach(client => {
            client.send(JSON.stringify({
                type: 'messageDeleted',
                messageId,
            }));
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting message:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// WebSocket setup
const server = app.listen(4040);
const wss = new ws.WebSocketServer({ server });

wss.on('connection', (connection, req) => {
    function notifyAboutOnlinePeople() {
        [...wss.clients].forEach(client => {
            client.send(JSON.stringify({
                online: [...wss.clients].map(c => ({ userId: c.userId, username: c.username })),
            }));
        });
    }

    connection.isAlive = true;

    connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() => {
            connection.isAlive = false;
            clearInterval(connection.timer);
            connection.terminate();
            notifyAboutOnlinePeople();
        }, 1000);
    }, 5000);

    connection.on('pong', () => {
        clearTimeout(connection.deathTimer);
    });

    // read username and id from cookie
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenCookieString = cookies.split(';').find(str => str.startsWith('token='));
        if (tokenCookieString) {
            const token = tokenCookieString.split('=')[1];
            if (token) {
                jwt.verify(token, jwtSecret, {}, (err, userData) => {
                    if (err) throw err;
                    const { userId, username } = userData;
                    connection.userId = userId;
                    connection.username = username;
                });
            }
        }
    }

    connection.on('message', async (message) => {
        const messageData = JSON.parse(message.toString());
        const { recipient, text, file } = messageData;
        let filename = null;

        if (file) {
            const parts = file.name.split('.');
            const ext = parts[parts.length - 1];
            filename = Date.now() + '.' + ext;
            const path = __dirname + '/uploads/' + filename;
            const bufferData = new Buffer(file.data.split(',')[1], 'base64');
            fs.writeFile(path, bufferData, () => {
                console.log('file saved:' + path);
            });
        }

        if (recipient && (text || file)) {
            const messageDoc = await Message.create({
                sender: connection.userId,
                recipient,
                text,
                file: file ? filename : null,
            });

            [...wss.clients]
                .filter(c => c.userId === recipient)
                .forEach(c => c.send(JSON.stringify({
                    text,
                    sender: connection.userId,
                    recipient,
                    file: file ? filename : null,
                    _id: messageDoc._id,
                    createdAt: messageDoc.createdAt,
                })));
        }
    });

    notifyAboutOnlinePeople();
});
