const socket = io("/");
const videoGrid = document.getElementById("vgrid");
const myPeer = new Peer();
const myVideo = document.createElement("video");
myVideo.muted = true;
const peers = {};

let isAdmin = false;
let modalShown = false;
let confirmationResult = false;

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

async function handleUserConnected(userId, stream) {
  if (isAdmin && !modalShown) {
    const confirmationResult = await confirmUserConnect();
    
    if (confirmationResult) {
      connectToNewUser(userId, stream);
      console.log('Accepted '+userId);
      socket.emit("accept-user", userId, ROOM_ID);
    } else {
      rejectNewUser(userId, stream);
      console.log('Rejected ' +userId);
      socket.emit('reject-user', userId, ROOM_ID);
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

function rejectNewUser(userId) {
  if (userId === myPeer.id) {
    console.log("You are rejected by the admin.");
    alert("You are rejected by the admin.");
    // Stop the stream and remove the video
    myVideo.srcObject.getTracks().forEach((track) => track.stop());
    myVideo.remove();
    socket.disconnect();
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

socket.on('user-rejected', userId => {
  rejectNewUser(userId);
})

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

function confirmUserConnect() {
  return new Promise((resolve) => {
    const result = window.confirm("Do you want to allow the user to connect?");
    resolve(result);
  });
}
