---
"zoom-chat-adapter": minor
---

Add native Zoom message head support. `thread.post` text is now sent as `content.head`, and Chat SDK `Card`s are split into head (`title`/`subtitle`) and body (`children`). Closes #46.
