import React from "react";

const posts = [
  {
    id: 1,
    initials: "JS",
    name: "Jessica Smith",
    time: "2d",
    text:
      "AI Summary: After reviewing the house cameras, it was confirmed that Jessica 'that stank' was caught making out with Emily's ex-boyfriend behind the garage for EXACTLY 43 seconds. Emily has since declared emotional bankruptcy."
  },
  {
    id: 2,
    initials: "EM",
    name: "Emily Martin",
    time: "2d",
    text:
      "AI Summary: Emily confronted Jessica at brunch, but Jessica tried to deny everything while holding the SAME hoodie she 'borrowed' from the same ex. The omelets were cold. The tension was not."
  },
  {
    id: 3,
    initials: "CL",
    name: "Chloe Lane",
    time: "1d",
    text:
      "AI Summary: Chloe accidentally started a group chat war after sending a screenshot of the group chat… to the group chat. Three friendships died instantly. No survivors."
  },
  {
    id: 4,
    initials: "BR",
    name: "Brianna Rose",
    time: "1d",
    text:
      "AI Summary: Brianna hosted a 'girls-only wellness night' but forgot to hide her situationship in the pantry. He was discovered when he sneezed during meditation. All chakras unaligned permanently."
  },
  {
    id: 5,
    initials: "HA",
    name: "Hannah Adams",
    time: "16h",
    text:
      "AI Summary: Hannah tried to fake cry in the bathroom to get sympathy, but Alexa accidentally broadcasted her rehearsing the cry sounds. Trust levels dropped below sea level."
  },
  {
    id: 6,
    initials: "MS",
    name: "Madison Summers",
    time: "8h",
    text:
      "AI Summary: Madison attempted to expose Emily for 'stealing her skincare routine,' but the AI detected Madison actually copied it from TikTok user @glowmom247. The court of girl opinions ruled swiftly."
  }
];

export default function Chat() {
  return (
    <div className="chat">
      <main className="thread-feed element">
        {/* Header image + member circles, scroll with feed */}
        <div className="chat-header">
          <div className="header-image" />
          <div className="members">
            <div className="member" />
            <div className="member" />
            <div className="member" />
          </div>
        </div>

        {/* Discussion posts */}
        {posts.map((post) => (
          <article key={post.id} className="thread-card">
            <div className="thread-avatar-column">
              <div className="thread-avatar">{post.initials}</div>
            </div>

            <div className="thread-main-column">
              <div className="thread-meta-row">
                <span className="thread-name">{post.name}</span>
                <span className="thread-dot">·</span>
                <span className="thread-time">{post.time}</span>
              </div>

              <div className="thread-text">
                {post.text.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>

              <div className="thread-actions">
                <button className="thread-action primary">Open chat</button>
                <button className="thread-action">React</button>
              </div>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}
