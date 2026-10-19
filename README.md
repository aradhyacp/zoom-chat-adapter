<div align="center">

# zoom-chat-adapter

**Zoom Team Chat for [Chat SDK](https://chat-sdk.dev)** — channels, DMs, slash commands and @-mentions through one `Chat` interface.

[![npm version](https://img.shields.io/npm/v/zoom-chat-adapter?style=flat-square&color=2D8CFF)](https://www.npmjs.com/package/zoom-chat-adapter)
[![npm downloads](https://img.shields.io/npm/dm/zoom-chat-adapter?style=flat-square&color=2D8CFF)](https://www.npmjs.com/package/zoom-chat-adapter)
[![license](https://img.shields.io/npm/l/zoom-chat-adapter?style=flat-square&color=2D8CFF)](./LICENSE)
[![docs](https://img.shields.io/badge/docs-zoom--chat--adapter.vercel.app-2D8CFF?style=flat-square)](https://zoom-chat-adapter.vercel.app)

[**Documentation**](https://zoom-chat-adapter.vercel.app) · [Quickstart](https://zoom-chat-adapter.vercel.app/quickstart) · [API reference](https://zoom-chat-adapter.vercel.app/reference) · [Issues](https://github.com/aradhyacp/zoom-chat-adapter/issues)

</div>

> [!NOTE]
> **Community adapter.** This package is community-maintained. It is not an official `@chat-adapter/*` package and is not published or supported by Zoom.

## Highlights

- **One webhook, one route.** Answers Zoom's setup challenge, verifies the HMAC signature, and turns events into ordinary Chat threads.
- **Post, edit, delete, reply.** Markdown is converted to Zoom's structured content segments for you.
- **Channel or DM, from the JID.** Thread IDs carry the Zoom JID, so you can tell the two apart.
- **Honest about gaps.** Calls Zoom cannot support throw `NotImplementedError` instead of failing quietly. See [Known limitations](#known-limitations).

## Installation

```bash
pnpm add zoom-chat-adapter chat @chat-adapter/state-memory
```

ESM only, for Node.js. A `state` adapter is required: `Chat` connects to it during initialization. `createMemoryState()` is the in-memory option for development and testing.

## Quick start

```typescript
import { createMemoryState } from "@chat-adapter/state-memory";
import { Chat } from "chat";
import { createZoomAdapter } from "zoom-chat-adapter";

const bot = new Chat({
  userName: "mybot",
  adapters: {
    zoom: createZoomAdapter(),
  },
  state: createMemoryState(),
});

bot.onNewMention(async (thread, message) => {
  await thread.post("Hello from Zoom!");
});
```

Called with no arguments, `createZoomAdapter()` reads its credentials from environment variables. Then add the one route Zoom posts to:

```typescript
// app/api/webhooks/zoom/route.ts
import { bot } from "@/lib/bot";
import { after } from "next/server";

export async function POST(request: Request) {
  return bot.webhooks.zoom(request, { waitUntil: after });
}
```

Pass the `Request` through untouched: the signature is computed over the raw body, so reading it first breaks verification for every event.

## Documentation

Full guides live at **[zoom-chat-adapter.vercel.app](https://zoom-chat-adapter.vercel.app)**. Every page also serves raw Markdown by adding `.md` to its URL, and [`/llms.txt`](https://zoom-chat-adapter.vercel.app/llms.txt) indexes them for agents.

| Guide | What it covers |
| :-- | :-- |
| [Quickstart](https://zoom-chat-adapter.vercel.app/quickstart) | A bot receiving and sending messages in about ten minutes |
| [Marketplace setup](https://zoom-chat-adapter.vercel.app/marketplace-setup) | The Zoom app, its scopes, event subscriptions, and ngrok |
| [Configuration](https://zoom-chat-adapter.vercel.app/configuration) | Every option and its environment variable |
| [Webhooks](https://zoom-chat-adapter.vercel.app/webhooks) | Setup challenge, signature checks, event dispatch |
| [Messaging](https://zoom-chat-adapter.vercel.app/messaging) | Sending, editing, deleting, and threaded replies |
| [Formatting](https://zoom-chat-adapter.vercel.app/formatting) | Markdown to Zoom content segments |
| [Thread IDs](https://zoom-chat-adapter.vercel.app/thread-ids) | The thread format, channel versus DM |
| [API reference](https://zoom-chat-adapter.vercel.app/reference) | Every export and method |
| [Limitations](https://zoom-chat-adapter.vercel.app/limitations) | What Zoom will not do, and what is not built yet |
| [Troubleshooting](https://zoom-chat-adapter.vercel.app/troubleshooting) | The failure modes that come up |

## Zoom Marketplace app setup

<details>
<summary><b>Step-by-step: create the app and collect the five credentials</b></summary>

&nbsp;

**Prerequisites**

- Zoom account with developer access
- A deployed URL or ngrok tunnel for local testing (e.g. `https://your-domain.com`)

**Steps**

1. **Create the app**
   - Go to [marketplace.zoom.us](https://marketplace.zoom.us) → **Develop** → **Build App**
   - Select **General App**
   - In **Basic Information**, set management type to **Admin-managed**

2. **Get core credentials** — from **Basic Information** → **App Credentials**
   - Copy **Client ID** → `ZOOM_CLIENT_ID`
   - Copy **Client Secret** → `ZOOM_CLIENT_SECRET`
   - Copy **Account ID** → `ZOOM_ACCOUNT_ID`

3. **Configure the bot endpoint and get Robot JID** — from **Surface** → **Team Chat Subscription**
   - Enable **Team Chat Subscription**
   - Set **Bot Endpoint URL** to `https://your-domain.com/api/webhooks/zoom`
   - Copy the **Bot JID** that appears → `ZOOM_ROBOT_JID`

4. **Get the webhook secret** — from **Features** → **Access** → **Token**
   - Copy the **Secret Token** → `ZOOM_WEBHOOK_SECRET_TOKEN`

5. **Add event subscriptions** — from **Features** → **Access** → **Event Subscription**
   - Enable Event Subscription
   - Set webhook URL to `https://your-domain.com/api/webhooks/zoom`
   - Subscribe to: `bot_notification`, `team_chat.app_mention`

6. **Add scopes** — from **Scopes** (see [Required scopes](#required-scopes) below)

7. **Authorize the app** — from **Local Test** → **Add app now**
   - Complete the OAuth flow to install the bot in your account

</details>

### Environment variables

```bash
ZOOM_CLIENT_ID=              # Basic Information → App Credentials
ZOOM_CLIENT_SECRET=          # Basic Information → App Credentials
ZOOM_ACCOUNT_ID=             # Basic Information → App Credentials
ZOOM_ROBOT_JID=              # Surface → Team Chat Subscription → Bot JID
ZOOM_WEBHOOK_SECRET_TOKEN=   # Features → Access → Token → Secret Token
```

**Local testing with ngrok**

```bash
ngrok http 3000
# Use the https:// forwarding URL as your Bot Endpoint URL and event subscription URL
```

### Required scopes

| Scope | Purpose |
| :-- | :-- |
| `imchat:bot` | Send bot messages to channels and DMs |
| `team_chat:read:app_mention:admin` | Receive app_mention events |
| `team_chat:write:message:admin` | Send, edit, and delete messages |

## Webhooks

The adapter handles these event types:

| Event | What it is |
| :-- | :-- |
| `endpoint.url_validation` | CRC challenge, answered automatically during setup |
| `bot_notification` | Channel messages, DMs, and slash commands |
| `team_chat.app_mention` | @-mentions in channels |

Webhook signatures (`x-zm-signature`) are verified with HMAC-SHA256, and timestamps older than 5 minutes are rejected.

## Configuration

All options fall back to environment variables when not provided.

| Option | Required | Description |
|--------|----------|-------------|
| `clientId` | No* | OAuth app Client ID. Auto-detected from `ZOOM_CLIENT_ID` |
| `clientSecret` | No* | OAuth app Client Secret. Auto-detected from `ZOOM_CLIENT_SECRET` |
| `accountId` | No* | Zoom account ID. Auto-detected from `ZOOM_ACCOUNT_ID` |
| `robotJid` | No* | Bot's JID. Auto-detected from `ZOOM_ROBOT_JID` |
| `webhookSecretToken` | No* | Webhook secret token. Auto-detected from `ZOOM_WEBHOOK_SECRET_TOKEN` |
| `userName` | No | Bot username. Auto-detected from `ZOOM_BOT_USERNAME` (defaults to `zoom-bot`) |
| `logger` | No | Logger instance (defaults to `ConsoleLogger("info")`) |

*Required at runtime — either via config or environment variable.

Or pass them explicitly:

```typescript
createZoomAdapter({
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  accountId: "your-account-id",
  robotJid: "bot-jid@xmpp.zoom.us",
  webhookSecretToken: "your-secret-token",
});
```

## What's supported

| Capability | Status |
| :-- | :-- |
| Post, edit, and delete a message | ✅ |
| Reply in a thread (`metadata.replyTo`) | ✅ |
| DMs and channel slash commands (via `bot_notification`) | ✅ |
| Streaming | ⚠️ Buffered: accumulates, then sends once |
| Typing indicator | ➖ No-op, Zoom has no typing API |
| Thread subscription (`thread.subscribe()`) | ❌ Zoom platform limitation |
| DM thread replies | ❌ Zoom platform limitation |
| Reactions, message history | ❌ Not implemented (throws `NotImplementedError`) |

## Formatting

The adapter converts Chat SDK markdown to Zoom's message format automatically.

| Syntax | Renders as |
| :-- | :-- |
| `**bold**` | Bold |
| `_italic_` | Italic |
| `` `code` `` | Inline code |
| `~strikethrough~` | Strikethrough |
| `__underline__` | Underline |
| `# heading` | Heading |
| `* item` | List item |

## Thread ID format

```
zoom:{channelId}:{messageId}
```

- Channel message: `zoom:abc123@conference.xmpp.zoom.us:msg-id-456`
- DM: `zoom:{userJid}:{event_ts}` (sender-based channel with the event timestamp as message ID)

## Known limitations

**Thread subscription (subscribe flow):** The `thread.subscribe()` pattern does not work for Zoom. Each `bot_notification` arrives with a unique thread ID based on `event_ts` — Zoom provides no `reply_to` or `parent_message_id` field to link replies to the original message. This is a confirmed Zoom platform limitation. Subsequent replies in a thread cannot be detected as part of the same conversation.

**DM thread replies:** Zoom does not fire `chat_message.replied` for 1:1 DM thread replies. The adapter cannot subscribe to or receive threaded replies in DMs.

**Unicode HMAC verification bug (ZOOM-506645):** Zoom's servers may normalize Unicode characters (emoji, accented characters) differently before computing the HMAC. Payloads containing non-ASCII characters may fail signature verification. The adapter logs the raw body hex on verification failure to aid diagnosis. If this affects you, contact Zoom Support referencing ZOOM-506645.

## Troubleshooting

<details>
<summary><b>Common problems and fixes</b></summary>

&nbsp;

**Webhook signature verification fails**
- Pass the untouched `Request` to `bot.webhooks.zoom`: the HMAC is computed over the raw body, so parsing or logging it first breaks verification
- Emoji or non-ASCII characters in payloads may fail HMAC verification due to a Zoom server-side Unicode normalization issue (ZOOM-506645) — check debug logs for raw body hex

**Bot not receiving events**
- Confirm the Bot Endpoint URL in **Surface → Team Chat Subscription** matches your deployment URL
- Confirm the event subscription URL in **Features → Access → Event Subscription** matches too
- Verify the app is installed via **Local Test → Add app now** (OAuth flow must complete)

**Bot appears in Zoom but doesn't respond**
- Check that `ZOOM_WEBHOOK_SECRET_TOKEN` matches the Secret Token in **Features → Access → Token**
- Ensure the app is marked as **Admin-managed** in Basic Information

**DM thread replies not received**
- This is a confirmed Zoom platform limitation — `chat_message.replied` is not fired for 1:1 DM thread replies. See [Known limitations](#known-limitations).

**`postMessage` returns 401**
- The `/v2/im/chat/messages` endpoint requires a `client_credentials` token. Ensure you're not using `account_credentials` grant type.

</details>

More in the [troubleshooting guide](https://zoom-chat-adapter.vercel.app/troubleshooting).

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, testing, and pull request guidelines.

This project uses [Ultracite](https://www.ultracite.ai/) ([Biome](https://biomejs.dev/)) for linting and formatting, enforced by a [Husky](https://typicode.github.io/husky/) pre-commit hook. `pnpm fix` runs on staged files, and commits with remaining lint errors are blocked.

## License

[MIT](./LICENSE)
