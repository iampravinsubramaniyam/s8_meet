let AdminName = null;

let handleMemberJoined = async (MemberId) => {
  console.log("A new member has joined the room:", MemberId);
  addMemberToDom(MemberId);

  let members = await channel.getMembers();
  updateMemberTotal(members);

  let { name } = await rtmClient.getUserAttributesByKeys(MemberId, ["name"]);
  addBotMessageToDom(`Welcome to the room ${name}! 👋`);

  if (!AdminName) {
    AdminName = name;
  }
};
let addMemberToDom = async (MemberId) => {
  let { name } = await rtmClient.getUserAttributesByKeys(MemberId, ["name"]);

  let membersWrapper = document.getElementById("member__list");
  let memberItem = `<div class="member__wrapper" id="member__${MemberId}__wrapper">
                        <span class="green__icon"></span>
                        <p class="member_name">${name}</p>
                    </div>`;

  membersWrapper.insertAdjacentHTML("beforeend", memberItem);
};

let updateMemberTotal = async (members) => {
  let total = document.getElementById("members__count");
  total.innerText = members.length;
};

let handleMemberLeft = async (MemberId) => {
  removeMemberFromDom(MemberId);

  let members = await channel.getMembers();
  updateMemberTotal(members);
};

let removeMemberFromDom = async (MemberId) => {
  let memberWrapper = document.getElementById(`member__${MemberId}__wrapper`);
  let name = memberWrapper.getElementsByClassName("member_name")[0].textContent;
  addBotMessageToDom(`${name} has left the room.`);

  memberWrapper.remove();
};

let getMembers = async () => {
  let members = await channel.getMembers();
  updateMemberTotal(members);
  for (let i = 0; members.length > i; i++) {
    addMemberToDom(members[i]);
  }
};

let handleChannelMessage = async (messageData, MemberId) => {
  let data = JSON.parse(messageData.text);

  if (data.type === "chat") {
    addMessageToDom(data.displayName, data.message);
  }
  if (data.type === "caption") {
    addcaptionToDom(data.displayName, data.caption);
  }
  console.log("A new message was received ");
  if (data.type === "user_left") {
    document.getElementById(`user-container-${data.uid}`).remove();

    if (userIdInDisplayFrame === `user-container-${uid}`) {
      displayFrame.style.display = null;

      for (let i = 0; videoFrames.length > i; i++) {
        videoFrames[i].style.height = "300px";
        videoFrames[i].style.width = "300px";
      }
    }
  }
};

let sendMessage = async (e) => {
  e.preventDefault();

  let message = e.target.message.value;
  channel.sendMessage({
    text: JSON.stringify({
      type: "chat",
      message: message,
      displayName: displayName,
    }),
  });
  addMessageToDom(displayName, message);
  e.target.reset();
};

let transcript = " ";
let isCaptioning = false;
let mediaRecorder;
let stream;
let socket;
let userNameDisplayed = false;
let PdfVersion = "";
let isMicOn = true;

let toggleMic = async (e) => {
  let button = e.currentTarget;
  console.log("Button works");

  if (isMicOn) {
    await localTracks[0].setMuted(false);
    isMicOn = !isMicOn;
    console.log(isMicOn);
    button.classList.remove("active");
  } else {
    await localTracks[0].setMuted(true);
    isMicOn = !isMicOn;
    console.log(isMicOn);
    button.classList.add("active");
  }

  // Call startCaptioning function with the microphone state
};

const startCaptioning = async () => {
  console.log("isstarted");
  console.log(isMicOn);
  if (!isCaptioning) {
    if (isMicOn) {
      // Proceed only if the microphone is on
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        socket = new WebSocket("wss://api.deepgram.com/v1/listen", [
          "token",
          "b8f913c60a850dc32805cc62cdc6dcec27c4814b",
        ]);

        socket.onopen = () => {
          mediaRecorder.addEventListener("dataavailable", (event) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(event.data);
            }
          });

          mediaRecorder.start(0);
        };

        socket.onmessage = (message) => {
          const received = JSON.parse(message.data);
          transcript = received.channel.alternatives[0].transcript;
          console.log(transcript);
          if (isMicOn) {
            sendCaption();
          }
        };

        isCaptioning = true;
      } catch (error) {
        console.error("Error starting captioning:", error);
      }
    } else {
      // Stop media stream and recorder if the microphone is off
      console.log("Microphone is off. Cannot start captioning.");
      stopCaptioning();
    }
  }
};

const stopCaptioning = () => {
  console.log("isstopped");
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }
  if (socket) {
    socket.close();
  }
  isCaptioning = false;
  nameDisplayed = false;
};

let toggleCaption = () => {
  if (isCaptioning) {
    stopCaptioning();
  } else {
    startCaptioning();
  }
};

// document.getElementById("caption-btn").addEventListener("click", toggleCaption);

let sendCaption = () => {
  let caption = transcript;
  console.log(transcript);
  if (!caption) return;
  channel.sendMessage({
    text: JSON.stringify({
      type: "caption",
      caption: caption,
      displayName: displayName,
    }),
  });
  addcaptionToDom(displayName, caption);
};
let addcaptionToDom = (name, caption) => {
  let captionsWrapper = document.getElementById("stream_caption");

  // Find the last element with the display name
  let lastCaptionElement = captionsWrapper.querySelector(
    `[data-name="${name}"]`
  );

  if (!lastCaptionElement) {
    // If the display name doesn't exist, create a new element
    lastCaptionElement = document.createElement("p");
    lastCaptionElement.dataset.name = name; // Set the data-name attribute to identify the display name
    lastCaptionElement.textContent = `${name}: ${caption}`;
    lastCaptionElement.style.margin = "0";
    captionsWrapper.appendChild(lastCaptionElement);
  } else {
    // If the display name exists, append the caption to the existing element
    lastCaptionElement.textContent += ` ${caption}`;
  }

  // Scroll to the newly added caption
  lastCaptionElement.scrollIntoView();
  PdfVersion = captionsWrapper.textContent;
};

let addMessageToDom = (name, message) => {
  let messagesWrapper = document.getElementById("messages");

  let newMessage = `<div class="message__wrapper">
                        <div class="message__body">
                            <strong class="message__author">${name}</strong>
                            <p class="message__text">${message}</p>
                        </div>
                    </div>`;

  messagesWrapper.insertAdjacentHTML("beforeend", newMessage);

  let lastMessage = document.querySelector(
    "#messages .message__wrapper:last-child"
  );
  if (lastMessage) {
    lastMessage.scrollIntoView();
  }
};

let addBotMessageToDom = (botMessage) => {
  let messagesWrapper = document.getElementById("messages");

  let newMessage = `<div class="message__wrapper">
                        <div class="message__body__bot">
                            <strong class="message__author__bot">🤖 Meet Bot</strong>
                            <p class="message__text__bot">${botMessage}</p>
                        </div>
                    </div>`;

  messagesWrapper.insertAdjacentHTML("beforeend", newMessage);

  let lastMessage = document.querySelector(
    "#messages .message__wrapper:last-child"
  );
  if (lastMessage) {
    lastMessage.scrollIntoView();
  }
};

let isCaption = document.getElementById("stream_caption");

document.getElementById("caption-btn").addEventListener("click", () => {
  toggleScreenCaption();
});

const toggleScreenCaption = () => {
  let button = document.getElementById("caption-btn");
  if (isCaption.style.display === "block") {
    button.classList.remove("active");
    isCaption.style.display = "none";
  } else {
    isCaption.style.display = "block";
    button.classList.add("active");
    toggleCaption();
  }
};

let leaveChannel = async () => {
  isMicOn = true;
  stopCaptioning();
  await channel.leave();
  await rtmClient.logout();
};

document.getElementById("leave-btn").addEventListener("click", function () {
  stopCaptioning();
  console.log("Button Works");
  let RoomName = getRoomName();
  console.log("Room:", RoomName);
  let TitleLine = `Transcript_On_${RoomName}_(${getCurrentDateTime()})_Meet`;
  let downloadVersion = PdfVersion.replace(/\n/g, " ").trim();
  const styledContent = `<style>  p {    font-size: 23px;    font-family: Arial, sans-serif;  } strong {    font-size: 28px;    font-family: Arial, sans-serif;   text-align: center;margin:0; }</style> <strong> ${TitleLine}</strong> <br> <p>${downloadVersion}</p>`;
  let confirmed = confirm("Are you sure you want to leave?");
  if (confirmed) {
    const blob = new Blob([styledContent], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    // Create a link element to initiate the download
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Transcript ${RoomName} ${getCurrentDateTime()}.docx`;

    // Trigger the click event on the link to start the download
    link.click();

    URL.revokeObjectURL(link.href);
  } else {
  }
});

function getCurrentDateTime() {
  let date = new Date();
  let year = date.getFullYear();
  let month = String(date.getMonth() + 1).padStart(2, "0");
  let day = String(date.getDate()).padStart(2, "0");
  let hours = String(date.getHours()).padStart(2, "0");
  let minutes = String(date.getMinutes()).padStart(2, "0");
  let seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}/${month}/${day}_${hours}:${minutes}:${seconds}`;
}

const getRoomName = () => {
  let currentURL = window.location.href;
  let roomParamIndex = currentURL.indexOf("room=");
  if (roomParamIndex !== -1) {
    let roomValue = currentURL.substring(roomParamIndex + 5);
    let cleanedRoomValue = roomValue.replace(/%20/g, " ");
    console.log("Room:", cleanedRoomValue);
    return cleanedRoomValue;
  }
};
window.addEventListener("beforeunload", leaveChannel);
let messageForm = document.getElementById("message__form");
messageForm.addEventListener("submit", sendMessage);
