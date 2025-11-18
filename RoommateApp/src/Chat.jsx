import React from "react";

export default function Chat() {
  return (
    <div class="chat">
      <div class="chat-header">
        <div class="header-image"></div>
        <div class="members">
          <div class="member"></div>
          <div class="member"></div>
          <div class="member"></div>
        </div>
      </div>

      <div class="chat-logs">
        <div class="message received">Hello! How are you?</div>
        <div class="message sent">I'm good, thanks!</div>
        <div class="message received">Are you coming today?</div>
      </div>

      <div id="input-chat">
        <input type="text" placeholder="Type a message..."></input>
        <button>Send</button>
      </div>
    </div>
  );
}
