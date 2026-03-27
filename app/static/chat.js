let user = localStorage.getItem("username");

if (!user) window.location.href = "/";

document.getElementById("loggedUser").innerText = user;
document.getElementById("avatar").innerText = user.charAt(0).toUpperCase();

let socket = new WebSocket(`ws://127.0.0.1:8000/ws/${user}`);

let selectedUser = null;
let selectedGroup = null;

const imageInput = document.getElementById("imageInput");
const previewContainer = document.getElementById("previewContainer");
const previewImage = document.getElementById("previewImage");
const fileName = document.getElementById("fileName");

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  fileName.innerText = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    previewContainer.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

function removeImage() {
  imageInput.value = "";
  previewContainer.classList.add("hidden");
  fileName.innerText = "";
}

socket.onmessage = function (event) {
  let data = JSON.parse(event.data);

  if (
    (selectedUser &&
      (data.sender === selectedUser || data.receiver === selectedUser)) ||
    (selectedGroup && data.group === selectedGroup)
  ) {
    if (data.content) addMessage(data.sender, data.content);
    if (data.image) addImageMessage(data.sender, data.image);
  }
};

async function loadUsers() {
  let res = await fetch("/users");
  let users = await res.json();

  let container = document.getElementById("users");
  container.innerHTML = "";

  users.forEach((u) => {
    if (u.username === user) return;

    let div = document.createElement("div");
    div.className = "user";
    div.innerText = u.username;

    div.onclick = async () => {
      selectedUser = u.username;
      selectedGroup = null;

      document.getElementById("messages").innerHTML = "";

      let res = await fetch(
        `/messages/history?user1=${user}&user2=${selectedUser}`,
      );

      let chats = await res.json();

      chats.forEach((msg) => {
        if (msg.content) addMessage(msg.sender, msg.content);
        if (msg.image) addImageMessage(msg.sender, msg.image);
      });
    };

    container.appendChild(div);
  });
}

async function loadGroups() {
  let res = await fetch("/groups");
  let groups = await res.json();

  let container = document.getElementById("groups");
  container.innerHTML = "";

  groups.forEach((g) => {
    if (!g.members.includes(user)) return;

    let div = document.createElement("div");
    div.className = "group";
    div.innerText = "👥 " + g.name;

    div.onclick = async () => {
      selectedGroup = g.name;
      selectedUser = null;

      document.getElementById("messages").innerHTML = "";

      let res = await fetch(`/messages/group/${selectedGroup}`);
      let chats = await res.json();

      chats.forEach((msg) => {
        if (msg.content) addMessage(msg.sender, msg.content);
        if (msg.image) addImageMessage(msg.sender, msg.image);
      });
    };

    container.appendChild(div);
  });
}

function addMessage(sender, msg) {
  let div = document.createElement("div");
  div.className = "message " + (sender === user ? "sent" : "received");

  let bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerText = msg;

  div.appendChild(bubble);
  document.getElementById("messages").appendChild(div);
}

function addImageMessage(sender, imageUrl) {
  let div = document.createElement("div");
  div.className = "message " + (sender === user ? "sent" : "received");

  let bubble = document.createElement("div");
  bubble.className = "bubble";

  let img = document.createElement("img");
  img.src = imageUrl;
  img.className = "chat-image";

  bubble.appendChild(img);
  div.appendChild(bubble);

  document.getElementById("messages").appendChild(div);
}

async function sendCombined() {
  let input = document.getElementById("messageInput");
  let msg = input.value.trim();
  let file = imageInput.files[0];

  if (!msg && !file) return;

  let imageUrl = null;

  if (file) {
    let formData = new FormData();
    formData.append("file", file);
    formData.append("sender", user);

    if (selectedUser) formData.append("receiver", selectedUser);
    else if (selectedGroup) formData.append("group", selectedGroup);

    let res = await fetch("/upload-image", {
      method: "POST",
      body: formData,
    });

    let data = await res.json();
    imageUrl = data.image_url;
  }

  let payload = {
    sender: user,
    receiver: selectedUser,
    group: selectedGroup,
    content: msg || null,
    image: imageUrl || null,
  };

  socket.send(JSON.stringify(payload));

  if (msg) addMessage(user, msg);
  if (imageUrl) addImageMessage(user, imageUrl);

  input.value = "";
  removeImage();
}

loadUsers();
loadGroups();
