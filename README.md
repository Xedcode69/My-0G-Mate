# MyMate

MyMate is a privacy-focused AI companion platform. Users can create persistent companions or role-specialized AI agents that guide workflows, remember meaningful context, and preserve encrypted archives on 0G Storage.

Each companion can have a clear role, mission, scope, boundaries, personality, memories, goals, and role-specific actions. Ownership can be registered with a user wallet on 0G mainnet, while encrypted archive root hashes can be anchored on-chain without publishing readable conversations.

## Main capabilities

- Create general companions or focused agents such as fitness coaches, travel guides, study partners, content assistants, and custom roles.
- Define a custom agent's role, mission, scope, boundaries, and response style.
- Generate role-aware guided workflows with structured plans, recommendations, checklists, and summaries.
- Maintain conversation history, preferences, decisions, goals, projects, feedback, and other meaningful memories.
- Present living portrait states based on companion activity and conversation tone.
- Encrypt companion archives with a per-user/per-companion derived key before uploading to 0G Storage.
- Register companion ownership through a user wallet and anchor encrypted archive versions on 0G mainnet.
- Use 0G Compute through its OpenAI-compatible Router API, with private-provider and TEE-verification settings.

## Technology

- Next.js 15, React, TypeScript, and Tailwind CSS.
- PostgreSQL with Prisma ORM.
- Privy and WalletConnect for sign-in, embedded wallets, and external wallet support.
- 0G Compute Router for companion and workflow inference.
- `@0gfoundation/0g-ts-sdk` for encrypted archive uploads to 0G Storage.
- ethers.js and Solidity for 0G mainnet ownership and archive anchoring.

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file:

```bash
cp .env.example .env
```

Fill in the required values in `.env`. See `.env.example` for all available settings.

At minimum, local development needs:

```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_PRIVY_APP_ID="..."
```

To use 0G Compute, Storage, and on-chain ownership, configure the corresponding `ZERO_G_*`, `NEXT_PUBLIC_*`, and `CRON_SECRET` values as well.

### 3. Prepare the database

```bash
npx prisma generate
npx prisma migrate dev
```

For production, use this instead:

```bash
npx prisma migrate deploy
```

### 4. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## User guide

### 1. Sign in and connect a wallet

1. Open MyMate.
2. Sign in with email or connect a wallet through Privy.
3. Use the same wallet whenever you want to register companions or anchor archives on 0G.
4. For 0G mainnet actions, switch the wallet to the configured 0G chain and keep a small amount of native 0G available for gas.

### 2. Create a companion

1. Select **Add companion** from the profile menu or complete onboarding.
2. Choose a companion type and avatar.
3. Give it a name.
4. Select a built-in role template, or choose **Custom agent**.
5. For a custom agent, enter its role, mission, and focused scope.
6. Select **Validate agent design**. MyMate checks the definition and asks the model for 2–4 role-specific workflows.
7. Review the suggested workflows and create the companion.

If the 0G registry is configured, MyMate asks the wallet to register ownership. If the request is skipped or fails, the companion still works and can be registered later from the profile menu.

### 3. Chat and complete workflows

1. Select a companion from the left rail.
2. Use the chat composer for normal conversation.
3. Select an **Agent action** to start a focused workflow.
4. Answer the companion's follow-up questions one at a time.
5. When the workflow has enough information, the companion can return a structured result such as a plan, checklist, recommendation set, or summary.
6. Use message feedback controls to mark replies helpful, unhelpful, or corrected. This creates learning context for the companion.

### 4. Review companion context

The dashboard shows the active companion's role, current mood, relationship state, workflow actions, recent memories, goals, and archive state. The profile menu lets you edit your display name, add a companion, and access 0G ownership/archive actions.

### 5. Create and check an encrypted archive

Companion changes queue archive jobs after actions such as conversation, feedback, workflow starts/completions, and goal/project creation.

Archive states in the profile menu mean:

- `Queued (pending)`: waiting for the archive worker.
- `Queued (processing)`: being encrypted and uploaded.
- `v1 · not anchored`: uploaded to 0G Storage, but not yet recorded on-chain.
- `v1 · anchored`: uploaded and its root hash has been anchored on 0G mainnet.

Use **Snapshot** for an immediate archive upload. Automatic processing uses the protected archive worker and `ARCHIVE_DEBOUNCE_SECONDS` to batch frequent changes.

### 6. Register ownership and anchor an archive

1. Open the profile menu while the relevant companion is active.
2. Select **Register [companion] on 0G** if the companion is not registered.
3. Approve the wallet transaction.
4. Wait for an archive to show an archive version such as `v1 · not anchored`.
5. Select **Sync latest archive to 0G**.
6. Approve the wallet transaction to anchor the encrypted root hash and archive version.

The chain receives ownership information and encrypted archive references only. It never receives plaintext chats, memories, or encryption keys.

## 0G Storage configuration

MyMate encrypts a complete companion archive before upload. The encryption key is derived from the app master key, the user's wallet address, and the companion ID, so one companion's archive cannot be decrypted with another companion's derived key.

Required production variables:

```env
MEMORY_ENCRYPTION_KEY="base64-encoded-32-byte-key"
ZERO_G_EVM_RPC="https://evmrpc.0g.ai"
ZERO_G_INDEXER_RPC="https://indexer-storage-turbo.0g.ai"
ZERO_G_STORAGE_PRIVATE_KEY="0x..."
CRON_SECRET="long-random-secret"
```

`ZERO_G_STORAGE_PRIVATE_KEY` belongs to a dedicated, funded backend wallet used only to pay Storage upload fees. Never expose it through a `NEXT_PUBLIC_` variable.

## Automated archive worker

The archive worker endpoint is:

```text
GET /api/cron/archives
```

It requires:

```text
Authorization: Bearer <CRON_SECRET>
```

`vercel.json` schedules it every five minutes. On Vercel Hobby, use a supported daily schedule or an external scheduler; Vercel Cron invokes the route with `GET`.

## 0G mainnet ownership

Deploy `contracts/CompanionRegistry.sol` to 0G mainnet, then set:

```env
NEXT_PUBLIC_CHAIN_ID="16661"
NEXT_PUBLIC_COMPANION_REGISTRY_ADDRESS="0x..."
```

The wallet must be connected to the same configured 0G chain before registration or archive anchoring can proceed.

## Security notes

- Never commit `.env` or share private keys, API keys, encryption keys, or `DATABASE_URL`.
- `NEXT_PUBLIC_*` variables are visible to the browser. Use them only for public configuration such as chain IDs and contract addresses.
- Rotate encryption keys only with a migration/re-encryption plan; old archives depend on the key used when they were created.
- Use separate database, service-wallet, and provider credentials for development, preview, and production environments.
