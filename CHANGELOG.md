# zoom-chat-adapter

## 1.1.0

### Minor Changes

- [#16](https://github.com/aradhyacp/zoom-chat-adapter/pull/16) [`e8cedd0`](https://github.com/aradhyacp/zoom-chat-adapter/commit/e8cedd08958d48eb82f6eefaccff986472c36747) Thanks [@aradhyacp](https://github.com/aradhyacp)! - Added Markdown rendering so links, strikethrough, quotes and images now appear in Zoom.
  
  - Messages are sent with Zoom's Markdown parser on by default
  - Set `markdownSupport: false` or `ZOOM_MARKDOWN_SUPPORT=false` to use structured segments
  - Underline stays plain text because Zoom has no underline token

### Patch Changes

- [#12](https://github.com/aradhyacp/zoom-chat-adapter/pull/12) [`e747aae`](https://github.com/aradhyacp/zoom-chat-adapter/commit/e747aaef73e882cd1cc5007ad264ecc57c01d30b) Thanks [@aradhyacp](https://github.com/aradhyacp)! - Add a pull request template and changeset guidelines for contributors. Releases now run through Changesets with npm Trusted Publishing and provenance.
