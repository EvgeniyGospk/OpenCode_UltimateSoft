// Wrapper that prefers oh-my-opencode when running under Bun,
// but falls back to a tiny notification hook when Bun is not available.
//
// Goal: keep background notifications working in OpenCode Web/Desktop,
// even when plugins are evaluated under Node (globalThis.Bun undefined).

const FALLBACK_SOUND = '/System/Library/Sounds/Glass.aiff';

function nowMs() {
  return Date.now();
}

function escapeAppleScriptString(value) {
  // Escape backslashes/quotes/newlines to keep AppleScript valid.
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\"')
    .replaceAll(String.fromCharCode(10), '\n');
}

async function notifyMac(ctx, title, message) {
  // Best-effort macOS notification + sound.
  try {
    const osascript = '/usr/bin/osascript';
    const safeTitle = escapeAppleScriptString(title);
    const safeMessage = escapeAppleScriptString(message);
    const script = `display notification "${safeMessage}" with title "${safeTitle}"`;
    await ctx.$`${osascript} -e ${script}`.nothrow();
  } catch {}

  try {
    const afplay = '/usr/bin/afplay';
    await ctx.$`${afplay} ${FALLBACK_SOUND}`.nothrow();
  } catch {}
}

async function maybeLoadOhMy() {
  if (typeof globalThis.Bun === 'undefined') return null;
  try {
    const mod = await import('oh-my-opencode');
    return typeof mod === 'function' ? mod : (mod?.default ?? mod);
  } catch {
    return null;
  }
}

export default async function opencodeOhMyOrFallback(ctx) {
  const ohmy = await maybeLoadOhMy();
  if (typeof ohmy === 'function') {
    try {
      return await ohmy(ctx);
    } catch {
      // fall through
    }
  }

  // Fallback notifications (session.status -> session.idle transition).
  const lastStatusBySession = new Map();
  const lastNotifiedAtBySession = new Map();

  return {
    event: async ({ event }) => {
      if (!event || !event.type) return;

      if (event.type === 'session.status') {
        const sessionID = event.properties?.sessionID;
        const status = event.properties?.status?.type;
        if (!sessionID || !status) return;
        lastStatusBySession.set(sessionID, status);
        return;
      }

      if (event.type === 'session.idle') {
        const sessionID = event.properties?.sessionID;
        if (!sessionID) return;

        const prev = lastStatusBySession.get(sessionID);
        const last = lastNotifiedAtBySession.get(sessionID) || 0;
        const n = nowMs();

        // Avoid spamming if multiple idle events arrive.
        if (n - last < 2000) return;

        if (prev === 'busy' || prev === 'retry') {
          lastNotifiedAtBySession.set(sessionID, n);
          await notifyMac(ctx, 'OpenCode', `Session idle: ${sessionID}`);
        }

        lastStatusBySession.set(sessionID, 'idle');
      }
    }
  };
}
