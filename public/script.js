// script.js

const socket = io('/');
const videoGrid = document.getElementById('vgrid');
const myPeer = new Peer();
const myVideo = document.createElement('video');
myVideo.muted = true;
const peers = {};

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  addVideoStream(myVideo, stream);

  myPeer.on('call', call => {
    showIncomingCallAlert(call, stream);
  });

  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream);
  });
});

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close();
});

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id);
});

function showIncomingCallAlert(call, stream) {
  const isAccepted = confirm('Incoming call! Do you want to accept the call?');

  if (isAccepted) {
    acceptCall(call, stream);
  } else {
    // Optionally handle rejection
    console.log('Call rejected');
  }
}

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream);
  const video = document.createElement('video');
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream);
  });
  call.on('close', () => {
    video.remove();
  });

  peers[userId] = call;
}

function acceptCall(call, stream) {
  const video = document.createElement('video');
  call.answer(stream);
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream);
  });
  call.on('close', () => {
    video.remove();
  });

  videoGrid.append(video);
  peers[call.peer] = call;
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
  videoGrid.append(video);
}
