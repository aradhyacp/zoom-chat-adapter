---
"zoom-chat-adapter": minor
---

Added Markdown rendering so links, strikethrough, quotes and images now appear in Zoom.

- Messages are sent with Zoom's Markdown parser on by default
- Set `markdownSupport: false` or `ZOOM_MARKDOWN_SUPPORT=false` to use structured segments
- Underline stays plain text because Zoom has no underline token
