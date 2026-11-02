---
"zoom-chat-adapter": patch
---

Fix threaded @-mentions: the bot now answers inside the existing Zoom thread. The adapter keys `team_chat.app_mention` threads on `reply_main_message_id`, sends replies with `reply_to` instead of `reply_main_message_id`, and converts bare app-mention channel IDs to channel JIDs before sending.
