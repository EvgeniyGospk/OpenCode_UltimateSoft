import multiAuthModule from '@guard22/opencode-multi-auth-codex';

const toPlugin = (mod) => (typeof mod === 'function' ? mod : mod?.default ?? mod);
const multiAuth = toPlugin(multiAuthModule);

const FALLBACK_SOUND = '/System/Library/Sounds/Glass.aiff';
const ACCOUNT_SOURCE_HEADER = 'x-opencode-account-source';
const MODEL_POOL_SUFFIX_SOFTWARE = '-pool-soft';
const MODEL_POOL_SUFFIX_DEFAULT = '-pool-default';
const LEGACY_MODEL_POOL_SUFFIX_SOFTWARE = '-soft';
const LEGACY_MODEL_POOL_SUFFIX_DEFAULT = '-default';

function nowMs() {
  return Date.now();
}

function splitModelRef(model) {
  const slashIndex = model.indexOf('/');
  if (slashIndex < 0) {
    return {
      provider: '',
      modelId: model,
      hasProvider: false
    };
  }

  return {
    provider: model.slice(0, slashIndex),
    modelId: model.slice(slashIndex + 1),
    hasProvider: true
  };
}

function joinModelRef(provider, modelId, hasProvider) {
  return hasProvider ? `${provider}/${modelId}` : modelId;
}

function stripPoolSuffix(modelId) {
  if (modelId.endsWith(MODEL_POOL_SUFFIX_SOFTWARE)) {
    return {
      modelId: modelId.slice(0, -MODEL_POOL_SUFFIX_SOFTWARE.length),
      pool: 'software'
    };
  }

  if (modelId.endsWith(MODEL_POOL_SUFFIX_DEFAULT)) {
    return {
      modelId: modelId.slice(0, -MODEL_POOL_SUFFIX_DEFAULT.length),
      pool: 'default'
    };
  }

  return {
    modelId,
    pool: 'any'
  };
}

function stripLegacyPoolSuffix(modelId) {
  if (modelId.endsWith(LEGACY_MODEL_POOL_SUFFIX_SOFTWARE)) {
    return {
      modelId: modelId.slice(0, -LEGACY_MODEL_POOL_SUFFIX_SOFTWARE.length),
      pool: 'software'
    };
  }

  if (modelId.endsWith(LEGACY_MODEL_POOL_SUFFIX_DEFAULT)) {
    return {
      modelId: modelId.slice(0, -LEGACY_MODEL_POOL_SUFFIX_DEFAULT.length),
      pool: 'default'
    };
  }

  return {
    modelId,
    pool: 'any'
  };
}

function parseModelPoolDirective(rawModel) {
  if (typeof rawModel !== 'string' || !rawModel.trim()) {
    return {
      normalizedModel: rawModel,
      pool: 'any'
    };
  }

  const parsed = splitModelRef(rawModel);
  const isOpenAiCodex =
    parsed.provider === 'openai' && parsed.modelId.toLowerCase().includes('codex');

  if (!isOpenAiCodex) {
    return {
      normalizedModel: rawModel,
      pool: 'any'
    };
  }

  const stripped = stripPoolSuffix(parsed.modelId);
  if (stripped.pool !== 'any') {
    return {
      normalizedModel: joinModelRef(parsed.provider, stripped.modelId, parsed.hasProvider),
      pool: stripped.pool
    };
  }

  const legacy = stripLegacyPoolSuffix(parsed.modelId);
  if (legacy.pool !== 'any') {
    return {
      normalizedModel: joinModelRef(parsed.provider, legacy.modelId, parsed.hasProvider),
      pool: legacy.pool
    };
  }

  return {
    normalizedModel: rawModel,
    pool: 'any'
  };
}

function wrapFetchWithPoolRouting(baseFetch) {
  if (typeof baseFetch !== 'function') {
    return baseFetch;
  }

  return async (input, init = {}) => {
    if (!init?.body || typeof init.body !== 'string') {
      return baseFetch(input, init);
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(init.body);
    } catch {
      return baseFetch(input, init);
    }

    if (!parsedBody || typeof parsedBody !== 'object') {
      return baseFetch(input, init);
    }

    const rawModel = parsedBody.model;
    if (typeof rawModel !== 'string') {
      return baseFetch(input, init);
    }

    const directive = parseModelPoolDirective(rawModel);
    const nextHeaders = new Headers(init.headers || {});

    if (directive.pool === 'software' || directive.pool === 'default') {
      nextHeaders.set(ACCOUNT_SOURCE_HEADER, directive.pool);
    } else {
      nextHeaders.delete(ACCOUNT_SOURCE_HEADER);
    }

    if (directive.normalizedModel !== rawModel) {
      parsedBody.model = directive.normalizedModel;
    }

    const nextInit = {
      ...init,
      headers: nextHeaders,
      body: JSON.stringify(parsedBody)
    };

    return baseFetch(input, nextInit);
  };
}

function escapeAppleScriptString(value) {
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

const MultiAuthWithNotifications = async (ctx) => {
  const hooks = (multiAuth ? await multiAuth(ctx) : {}) || {};

  const baseEvent = hooks.event;
  const lastStatusBySession = new Map();
  const lastNotifiedAtBySession = new Map();

  hooks.event = async ({ event }) => {
    // Preserve any existing event hook.
    if (typeof baseEvent === 'function') {
      try {
        await baseEvent({ event });
      } catch {
        // ignore plugin errors
      }
    }

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

      // Notify only if we were doing something.
      if (prev === 'busy' || prev === 'retry') {
        lastNotifiedAtBySession.set(sessionID, n);
        await notifyMac(ctx, 'OpenCode', `Session idle: ${sessionID}`);
      }

      lastStatusBySession.set(sessionID, 'idle');
    }
  };

  if (hooks.auth && typeof hooks.auth === 'object' && typeof hooks.auth.loader === 'function') {
    const baseLoader = hooks.auth.loader.bind(hooks.auth);

    hooks.auth.loader = async (...args) => {
      const authConfig = await baseLoader(...args);

      if (!authConfig || typeof authConfig !== 'object') {
        return authConfig;
      }

      return {
        ...authConfig,
        fetch: wrapFetchWithPoolRouting(authConfig.fetch)
      };
    };
  }

  return hooks;
};

export default MultiAuthWithNotifications;
