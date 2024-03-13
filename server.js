const fs = require("fs"); //module is imported to read the SSL key and certificate files.
const options = {
  //object is created with SSL key and certificate paths.
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.crt"),
};
const express = require("express"); //module is imported to set up the Express web application.
const app = express(); //is initialized as an Express application.
const server = require("https").Server(options, app); //HTTPS server is created using https.Server with provided options and Express app.
const io = require("socket.io")(server, {
  //Socket.IO is initialized with the HTTPS server and some configuration options including CORS settings and message compression.
  cors: {
    origin: "*",
  },
  perMessageDeflate: false,
});
const { v4: uuidV4 } = require("uuid");
const { PeerServer } = require("peer");
const peerServer = PeerServer({
  //PeerServer class is imported from the peer module for WebRTC communication.
  port: 443, //peerServer is initialized with port 443 and SSL configuration using the same SSL key and certificate as the HTTPS server.
  ssl: {
    key: fs.readFileSync("server.key"),
    cert: fs.readFileSync("server.crt"),
  },
});

app.set("view engine", "ejs");
app.use(express.static("public"));

app.use("/peerjs", peerServer);

app.get("/", (req, res) => {
  res.redirect(`/${uuidV4()}`);
});

app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

// Listens for 'connection' event from Socket.IO.
// Upon connection, retrieves the socket ID and client IP address.
// Listens for 'join-room' event and handles various events related to room joining and user connections and disconnections.

io.on("connection", (socket) => {
  var socketId = socket.id;
  var clientIp = socket.request.connection.remoteAddress;

  console.log(clientIp, socketId);

  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);

    // Check if there are any clients in the room
    const clientsInRoom = io.sockets.adapter.rooms[roomId];
    const numClients = clientsInRoom
      ? Object.keys(clientsInRoom.sockets).length
      : 0;

    const isAdmin = numClients === 1;
    const isMember = numClients > 1;

    socket.emit("member-status", isMember); // The first user who joins becomes the admin
    socket.emit("admin-status", isAdmin); // Emit the admin status back to the client

    socket.to(roomId).broadcast.emit("user-connected", userId);

    socket.on("disconnect", () => {
      socket.to(roomId).broadcast.emit("user-disconnected", userId);
    });

    socket.on("accept-user", (userId, room) => {
      io.in(roomId).emit("user-accepted", userId);
    });
  });
});

// Starts the HTTPS server to listen on port 443, allowing incoming connections from any IP address.
server.listen(443, "0.0.0.0");
