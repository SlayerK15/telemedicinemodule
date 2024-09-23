const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

const options = {
  key: fs.readFileSync(path.join(__dirname, '..', 'localhost+1-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '..', 'localhost+1.pem'))
};

const server = https.createServer(options, app);
const io = socketIo(server, {
  cors: {
    origin: ['https://localhost:3000', 'https://192.168.248.9:3000'],
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  socket.on('join-room', ({ roomId, email }) => {
    console.log(`User ${email} joining room ${roomId}`);
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', { id: socket.id, email });
  });

  socket.on('offer', (payload) => {
    io.to(payload.target).emit('offer', payload);
  });

  socket.on('answer', (payload) => {
    io.to(payload.target).emit('answer', payload);
  });

  socket.on('ice-candidate', (payload) => {
    io.to(payload.target).emit('ice-candidate', payload);
  });

  socket.on('chat-message', ({ roomId, message, sender }) => {
    console.log(`Chat message from ${sender} in room ${roomId}: ${message}`);
    io.to(roomId).emit('chat-message', { sender, message });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    io.emit('user-disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on https://0.0.0.0:${PORT}`);
});