const fs = require('fs');
const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
};
const express = require('express')
const app = express()
const server = require('https').Server(options, app)
const io = require('socket.io')(server, {
  cors: {
    origin: '*'
  },
  perMessageDeflate: false
})
const { v4: uuidV4 } = require('uuid')
const { PeerServer } = require('peer')
const peerServer = PeerServer({
  port: 443,
	ssl: {
		key: fs.readFileSync("server.key"),
		cert: fs.readFileSync("server.crt"),
	}
});

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.use('/peerjs', peerServer)

app.get('/', (req, res) => {
  res.redirect(`/${uuidV4()}`)
})

app.get('/:room', (req, res) => {
  res.render('room', { roomId: req.params.room })
})

io.on('connection', socket => {
  var socketId = socket.id;
  var clientIp = socket.request.connection.remoteAddress;

  console.log(clientIp, socketId);
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId)
    socket.to(roomId).broadcast.emit('user-connected', userId)

    socket.on('disconnect', () => {
      socket.to(roomId).broadcast.emit('user-disconnected', userId)
    })
  })
})

server.listen(443, '0.0.0.0')