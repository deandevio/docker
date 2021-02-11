const path = require("path");
const http = require("http");
const os = require("os");
const express = require("express");
const socketio = require("socket.io");
const Filter = require("bad-words");
const { generateMessage } = require("../src/utils/messages");
const { generateLocationMessage } = require("../src/utils/messages");
const { getUser, removeUser, addUser, getUsersInRoom } = require("./utils/users");
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// app.get("/", (req, res) => {
//  res.send(`Processed by container ID: ${os.hostname}`);
// });

const publicDirectoryPath = path.join(__dirname, "../public");
app.use(express.static(publicDirectoryPath));

app.set("view engine", "hbs");
app.get("", (req, res) => {
  res.render("index", {
    containerId: os.hostname(),
  });
});

io.on("connection", (socket) => {
  console.log("new websocket connection");

  socket.on("join", ({ username, room }, callback) => {
    const { error, user } = addUser({
      id: socket.id,
      username,
      room,
    });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);

    socket.emit("message", generateMessage("Admin", "Welcome!"));
    socket.broadcast.to(user.room).emit("message", generateMessage("Admin", `${user.username} has joined the chat`));

    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);
    const filter = new Filter();

    if (filter.isProfane(message)) {
      return callback("Profanity is not allowed");
    }
    io.to(user.room).emit("message", generateMessage(user.username, message));
    callback();
  });

  socket.on("sendLocation", (coords, callback) => {
    const user = getUser(socket.id);
    io.to(user.room).emit(
      "locationMessage",
      generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`)
    );
    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("message", generateMessage("Admin", `${user.username} has left the room`));
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
