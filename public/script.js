const socket = io("/");
const videoGrid = document.getElementById("vgrid");
const myPeer = new Peer();
const myVideo = document.createElement("video");
myVideo.muted = true;
const peers = {};
let isAdmin = false;
const joinRequestModals = []; // Array to store join request modals
let acceptedByAdmin = false; // Track if the current user has been accepted by the admin
let otherUserAccepted = false; // Track if the other user has been accepted by the admin
let otherUserId = null; // Track the ID of the other user
let myStream = null; // Track the current user's stream

socket.on("admin-status", (isAdminFromServer) => {
  isAdmin = isAdminFromServer;
  if (isAdmin) {
    console.log("You are the call host.");
    showModal("You are the call host.");
  } else {
    console.log("You are a guest.");
    showModal("Welcome! Please wait for the admin to approve your join request");
  }
});

function callProcess(peer, call, stream) {
  call.answer(stream);
  const video = document.createElement("video");
  call.on("stream", (userVideoStream) => {
    if (!peers[call.peer]) {
      addVideoStream(video, userVideoStream);
      peers[call.peer] = call;
    }
  });
  call.on("close", () => {
    video.remove();
    delete peers[call.peer];
  });
}

async function handleUserConnected(userId, stream) {
  if (isAdmin) {
    showModal(`Join request from user ${userId}.`, userId);
  } else {
    showModal("Your join request is pending approval. Please wait.");
  }
}

function handleUserDisconnected(userId, stream) {
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
    socket.emit("disconnect-user", userId, ROOM_ID);
  }
}

function connectToNewUser(userId, stream) {
  if (userId !== myPeer.id) {
    if (!peers[userId]) {
      const video = document.createElement("video");
      const call = myPeer.call(userId, stream);
      if (call) {
        call.on("stream", (userVideoStream) => {
          addVideoStream(video, userVideoStream);
        });
        call.on("close", () => {
          video.remove();
        });
        peers[userId] = call;
      }
    } else {
      console.log("Already connected to user:", userId);
    }
  }
}

function rejectNewUser(userId) {
  if (userId === myPeer.id) {
    myVideo.srcObject.getTracks().forEach((track) => track.stop());
    myVideo.remove();
    socket.disconnect();
  }
}

function showModal(message, userId) {
  const modal = document.createElement("div");
  modal.className = "modal";
  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";
  const content = document.createElement("p");
  content.textContent = message;

  // Create close button (x)
  const closeButton = document.createElement("span");
  closeButton.className = "close";
  closeButton.textContent = "×";
  modalContent.appendChild(closeButton);

  if (userId) {
    // Create accept button
    const acceptButton = document.createElement("button");
    acceptButton.textContent = "Accept";
    acceptButton.onclick = () => {
      hideModal(modal);
      connectToNewUser(userId, myVideo.srcObject);
      console.log("User " + userId + " accepted");
      socket.emit("accept-user", userId, ROOM_ID);
    };

    // Create reject button
    const rejectButton = document.createElement("button");
    rejectButton.textContent = "Reject";
    rejectButton.onclick = () => {
      hideModal(modal);
      rejectNewUser(userId);
      console.log("User " + userId + " rejected");
      socket.emit("reject-user", userId, ROOM_ID);
    };

    modalContent.appendChild(content);
    modalContent.appendChild(acceptButton);
    modalContent.appendChild(rejectButton);
  } else {
    // If it's not a join request modal, only display the message content
    modalContent.appendChild(content);
  }

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Add the modal to the array
  joinRequestModals.push(modal);

  // Show the modal
  modal.style.display = "block";

  // Close modal when close button is clicked
  closeButton.onclick = () => {
    modal.style.display = "none";
    processJoinRequestQueue(); // Process next join request in the queue
  };
}

function hideModal(modal) {
  modal.style.display = "none";
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
  videoGrid.append(video);
}

function processJoinRequestQueue() {
  if (joinRequestModals.length > 0) {
    const modal = joinRequestModals.shift(); // Remove the first modal from the array
    hideModal(modal); // Hide the modal
  }
}

socket.on("user-accepted", (userId) => {
  if (userId === myPeer.id) {
    acceptedByAdmin = true;
    if (otherUserAccepted) {
      establishPeerConnection(otherUserId); // Establish connection if the other user is also accepted
    }
  } else {
    otherUserAccepted = true;
    otherUserId = userId;
    if (acceptedByAdmin) {
      establishPeerConnection(userId); // Establish connection if the current user is accepted
    }
  }
});

socket.on("user-rejected", (userId) => {
  rejectNewUser(userId);
  if (userId === myPeer.id) {
    showModal("You have been rejected by the admin.");
  }
});

function establishPeerConnection(userId) {
  if (!peers[userId]) {
    const video = document.createElement("video");
    const call = myPeer.call(userId, myStream);
    if (call) {
      call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
      call.on("close", () => {
        video.remove();
      });
      peers[userId] = call;
    }
  }
}

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: false,
  })
  .then((stream) => {
    myStream = stream; // Save the stream of the current user
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
    socket.on("user-disconnect", (userId) => {
      console.log("User " + userId + " has left the call.");
      showModal("User " + userId + " has left the call.");
    });
    myPeer.on("open", (id) => {
      socket.emit("join-room", ROOM_ID, id);
    });
  });
