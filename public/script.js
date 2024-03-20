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
    console.log("You are the call host.");
    showModal("You are the call host.");
  } else {
    console.log("You are a guest.");
    showModal(
      "Welcome! Please wait for the admin to approve your join request"
    );
  }
});

function callProcess(peer, call, stream) {
  call.answer(stream);
  const video = document.createElement("video");

  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });

  call.on("close", () => {
    video.remove();
  });
}

async function handleUserConnected(userId, stream) {
  if (isAdmin && !modalShown) {
    showModal("Do you want to allow the user to connect?");

    const modalContent = document.getElementById("modalContent");
    modalContent.innerHTML = ""; // Clear existing content

    // Add message to modal content
    const message = document.createElement("p");
    message.textContent = "Do you want to allow the user to connect?";
    modalContent.appendChild(message);

    // Add accept button to modal content
    const acceptButton = document.createElement("button");
    acceptButton.textContent = "Accept";
    acceptButton.onclick = async () => {
      hideModal();
      connectToNewUser(userId, stream);
      console.log("Accepted " + userId);
      socket.emit("accept-user", userId, ROOM_ID);
    };
    modalContent.appendChild(acceptButton);

    // Add reject button to modal content
    const rejectButton = document.createElement("button");
    rejectButton.textContent = "Reject";
    rejectButton.onclick = async () => {
      hideModal();
      rejectNewUser(userId);
      console.log("Rejected " + userId);
      socket.emit("reject-user", userId, ROOM_ID);
    };
    modalContent.appendChild(rejectButton);
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
  }
}

function rejectNewUser(userId) {
  if (userId === myPeer.id) {
    myVideo.srcObject.getTracks().forEach((track) => track.stop());
    myVideo.remove();
    socket.disconnect();
  }
}

function showModal(message) {
  const modal = document.getElementById("notificationModal");
  const modalContent = document.getElementById("modalContent");
  const closeButton = document.getElementById("closeButton");

  modalContent.innerHTML = message;
  modal.style.display = "block";

  closeButton.onclick = () => {
    modal.style.display = "none";
  };
}

function hideModal() {
  const modal = document.getElementById("notificationModal");
  modal.style.display = "none";
}

function addVideoStream(video, stream) {
  video.srcObject = stream;

  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
  videoGrid.append(video);
}

socket.on("user-accepted", (userId) => {
  connectToNewUser(userId, myVideo.srcObject);
  if (userId === myPeer.id) {
    showModal("You have been accepted by the admin.");
  }
});

socket.on("user-rejected", (userId) => {
  rejectNewUser(userId);
  if (userId === myPeer.id) {
    showModal("You have been rejected by the admin.");
  }
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

    socket.on("user-disconnect", (userId) => {
      console.log("User " + userId + " has left the call.");
      showModal("User " + userId + " has left the call.");
    });

    myPeer.on("open", (id) => {
      socket.emit("join-room", ROOM_ID, id);
    });
  });

