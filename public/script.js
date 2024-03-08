const socket = io("/");
const videoGrid = document.getElementById("vgrid");
const myPeer = new Peer();
const myVideo = document.createElement("video");
myVideo.muted = true;
const peers = {};

let isAdmin = false;
let modalShown = false;
// let isAccept = false;

socket.on("admin-status", (isAdminFromServer) => {
  isAdmin = isAdminFromServer;

  if (isAdmin) {
    console.log("You are the admin.");
  } else {
    console.log("You are a member.");
  }
});

function callProcess(peer, call, stream) {
  call.answer(stream);
  const video = document.createElement('video');

  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream);
  });

  call.on('close', () => {
    video.remove();
  });
}

function handleUserConnected(userId, stream) {
  if (isAdmin && !modalShown) {
    if (window.confirm("Do you want to allow the user to connect?")) {
      // Set to true once alert is shown
      isAccept = true;
      connectToNewUser(userId, stream);
      socket.emit("accept-user", userId, ROOM_ID);
    } else if (isAccept && approvedUsers[userId]) {
      // Other users connect to the new user without alert
      connectToNewUser(userId, stream);
    } else {
      // Reject the call
      socket.emit("reject-call", userId);
      approvedUsers[userId] = false;
    }
  }
}

function handleUserDisconnected(userId, stream) {
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
  }
}

function connectToNewUser(userId, stream) {
  // Check if the user is not the admin (current user)
  if (userId !== myPeer.id) {
    const video = document.createElement('video');

    const call = myPeer.call(userId, stream);

    // Check if call is truthy before setting up event listeners
    if (call) {
      call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
      });

      call.on('close', () => {
        video.remove();
      });

      peers[userId] = call;
    }
  }
}


function addVideoStream(video, stream) {
  video.srcObject = stream;
  
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
  videoGrid.append(video);
}


socket.on("user-accepted", (userId) => {
  // Automatically accept the user on all devices
  connectToNewUser(userId, myVideo.srcObject);
});

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: false,
  })
  .then((stream) => {
    addVideoStream(myVideo, stream);

    myPeer.on("call", (call) => {
      callProcess(myPeer, call, stream);
    });

    socket.on("user-connected", (userId, stream) => {
      handleUserConnected(userId, stream);
    });

    socket.on("user-disconnected", (userId) => {
      handleUserDisconnected(userId);
    });

    myPeer.on("open", (id) => {
      socket.emit("join-room", ROOM_ID, id);
    });
  });
