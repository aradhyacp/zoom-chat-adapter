# zoom-chat-adapter

## 1.2.0

### Minor Changes

- [#47](https://github.com/aradhyacp/zoom-chat-adapter/pull/47) [`6bf7f07`](https://github.com/aradhyacp/zoom-chat-adapter/commit/6bf7f076da404f5195918b3d69319749f10a6dfa) Thanks [@aradhyacp](https://github.com/aradhyacp)! - Add native Zoom message head support. `thread.post` text is now sent as `content.head`, and Chat SDK `Card`s are split into head (`title`/`subtitle`) and body (`children`). Closes [#46](https://github.com/aradhyacp/zoom-chat-adapter/issues/46).

### Patch Changes

- [#45](https://github.com/aradhyacp/zoom-chat-adapter/pull/45) [`fef149b`](https://github.com/aradhyacp/zoom-chat-adapter/commit/fef149bcd34a531d10400f22fe127838b218eb91) Thanks [@jdotc1](https://github.com/jdotc1)! - Reject malformed and future-dated Zoom webhook timestamps outside the five-minute signature verification window.

- [#43](https://github.com/aradhyacp/zoom-chat-adapter/pull/43) [`05041a7`](https://github.com/aradhyacp/zoom-chat-adapter/commit/05041a7e726ba55da167af4d11fbb258e89ecd39) Thanks [@aradhyacp](https://github.com/aradhyacp)! - Fix threaded @-mentions: the bot now answers inside the existing Zoom thread. The adapter keys `team_chat.app_mention` threads on `reply_main_message_id`, sends replies with `reply_to` instead of `reply_main_message_id`, and converts bare app-mention channel IDs to channel JIDs before sending.

## 1.1.0

### Minor Changes

- [#16](https://github.com/aradhyacp/zoom-chat-adapter/pull/16) [`e8cedd0`](https://github.com/aradhyacp/zoom-chat-adapter/commit/e8cedd08958d48eb82f6eefaccff986472c36747) Thanks [@aradhyacp](https://github.com/aradhyacp)! - Added Markdown rendering so links, strikethrough, quotes and images now appear in Zoom.
  
  - Messages are sent with Zoom's Markdown parser on by default
  - Set `markdownSupport: false` or `ZOOM_MARKDOWN_SUPPORT=false` to use structured segments
  - Underline stays plain text because Zoom has no underline token

### Patch Changes

- [#12](https://github.com/aradhyacp/zoom-chat-adapter/pull/12) [`e747aae`](https://github.com/aradhyacp/zoom-chat-adapter/commit/e747aaef73e882cd1cc5007ad264ecc57c01d30b) Thanks [@aradhyacp](https://github.com/aradhyacp)! - Add a pull request template and changeset guidelines for contributors. Releases now run through Changesets with npm Trusted Publishing and provenance.
