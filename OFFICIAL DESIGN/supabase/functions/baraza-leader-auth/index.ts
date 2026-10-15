import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store",
  "content-type": "application/json",
};
const sessionLifetimeSeconds = 8 * 60 * 60;
const encoder = new TextEncoder();
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const sessionSecret = Deno.env.get("BARAZA_SESSION_SECRET");
const invalidCredentialsMessage = "Invalid name or access code. Please try again.";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!supabaseUrl || !serviceRoleKey || !sessionSecret || sessionSecret.length < 32) {
  throw new Error("Baraza authentication requires Supabase service credentials and a 32-character session secret.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const signingKey = await crypto.subtle.importKey(
  "raw",
  encoder.encode(sessionSecret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const encodeBase64Url = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const decodeBase64Url = (value: string) => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseDiscussion = (value: unknown) => {
  if (!isRecord(value) || !isRecord(value.configuration)) return null;
  const { configuration } = value;
  if (!Array.isArray(configuration.speakers) || configuration.speakers.length > 30) return null;

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const topic = typeof value.topic === "string" ? value.topic.trim() : "";
  const isValidDuration = (duration: unknown, maximum: number): duration is number =>
    typeof duration === "number" && Number.isInteger(duration) && duration >= 0 && duration <= maximum;

  if (title.length > 120 || topic.length > 2000) return null;

  const speakers = configuration.speakers.map((speaker) => {
    if (!isRecord(speaker) || typeof speaker.name !== "string"
      || speaker.name.trim().length > 120
      || !isValidDuration(speaker.durationSeconds, 7200)) return null;
    return { name: speaker.name.trim(), durationSeconds: speaker.durationSeconds };
  });
  if (speakers.some((speaker) => speaker === null)) return null;

  const normalizedSpeakers = speakers.filter(
    (speaker): speaker is { name: string; durationSeconds: number } => speaker !== null,
  );
  const ready = Boolean(title && topic && normalizedSpeakers.length > 0
    && normalizedSpeakers.every((speaker) => speaker.name && speaker.durationSeconds > 0));

  return {
    title: title || "Untitled discussion",
    topic,
    configuration: { speakers: normalizedSpeakers },
    ready,
  };
};

const createSessionToken = async (barazaId: number) => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = encodeBase64Url(encoder.encode(JSON.stringify({
    iss: "roundsquare-baraza-leader",
    sub: String(barazaId),
    barazaId,
    iat: issuedAt,
    exp: issuedAt + sessionLifetimeSeconds,
  })));
  const unsignedToken = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("HMAC", signingKey, encoder.encode(unsignedToken));
  return `${unsignedToken}.${encodeBase64Url(new Uint8Array(signature))}`;
};

const readSession = async (token: unknown) => {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let header: unknown;
  let payload: unknown;
  let signature: Uint8Array;
  try {
    header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    signature = decodeBase64Url(parts[2]);
  } catch {
    return null;
  }

  if (!isRecord(header) || !isRecord(payload)) return null;
  const barazaId = payload.barazaId;
  const expiresAt = payload.exp;
  if (header.alg !== "HS256" || header.typ !== "JWT"
    || payload.iss !== "roundsquare-baraza-leader"
    || typeof barazaId !== "number" || !Number.isInteger(barazaId) || barazaId < 1 || barazaId > 17
    || payload.sub !== String(barazaId)
    || typeof expiresAt !== "number" || !Number.isInteger(expiresAt)
    || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const validSignature = await crypto.subtle.verify(
    "HMAC",
    signingKey,
    signature,
    encoder.encode(`${parts[0]}.${parts[1]}`),
  );
  return validSignature ? barazaId : null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 65536) return jsonResponse({ error: "Request is too large." }, 413);

  let body: {
    action?: unknown;
    fullName?: unknown;
    accessCode?: unknown;
    token?: unknown;
    discussion?: unknown;
    id?: unknown;
    timerState?: unknown;
    stageCount?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  if (body.action === "login") {
    const fullName = typeof body.fullName === "string" ? body.fullName.normalize("NFKC").trim() : "";
    const accessCode = typeof body.accessCode === "string" ? body.accessCode : "";
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("cf-connecting-ip")?.trim()
      || request.headers.get("x-real-ip")?.trim();

    if (!clientIp) {
      console.error("Baraza login request did not include a client IP for rate limiting.");
      return jsonResponse({ error: "Baraza sign-in is temporarily unavailable. Please try again." }, 503);
    }
    if (fullName.length > 80 || accessCode.length > 5) {
      return jsonResponse({ error: invalidCredentialsMessage }, 401);
    }

    const { data: barazaId, error } = await admin.rpc("authenticate_baraza_leader", {
      p_full_name: fullName,
      p_access_code: accessCode,
      p_client_ip: clientIp,
    });
    if (error) {
      console.error("Baraza login verification failed.", error.message);
      return jsonResponse({ error: "Baraza sign-in is temporarily unavailable. Please try again." }, 503);
    }
    if (!Number.isInteger(barazaId) || barazaId < 1 || barazaId > 17) {
      return jsonResponse({ error: invalidCredentialsMessage }, 401);
    }

    return jsonResponse({
      token: await createSessionToken(barazaId),
      barazaId,
    });
  }

  if (body.action === "session") {
    const barazaId = await readSession(body.token);
    if (!barazaId) return jsonResponse({ error: "Session expired. Sign in again." }, 401);

    const { data, error } = await admin
      .from("baraza_leader_accounts")
      .select("baraza_id")
      .eq("baraza_id", barazaId)
      .eq("enabled", true)
      .maybeSingle();
    if (error) {
      console.error("Baraza session verification failed.", error.message);
      return jsonResponse({ error: "Baraza dashboard is temporarily unavailable. Please try again." }, 503);
    }
    if (!data) return jsonResponse({ error: "Session expired. Sign in again." }, 401);

    return jsonResponse({ barazaId: data.baraza_id });
  }

  if (body.action === "discussions.list"
    || body.action === "discussions.save"
    || body.action === "discussions.start"
    || body.action === "discussions.timer"
    || body.action === "discussions.complete"
    || body.action === "discussions.delete") {
    const barazaId = await readSession(body.token);
    if (!barazaId) return jsonResponse({ error: "Session expired. Sign in again." }, 401);

    const { data: account, error: accountError } = await admin
      .from("baraza_leader_accounts")
      .select("baraza_id")
      .eq("baraza_id", barazaId)
      .eq("enabled", true)
      .maybeSingle();
    if (accountError) {
      console.error("Baraza discussion account check failed.", accountError.message);
      return jsonResponse({ error: "Discussions are temporarily unavailable. Please try again." }, 503);
    }
    if (!account) return jsonResponse({ error: "Session expired. Sign in again." }, 401);

    if (body.action === "discussions.list") {
      const { data, error } = await admin
        .from("baraza_discussions")
        .select("id, baraza_id, title, topic, configuration, status, timer_state, started_at, created_at, updated_at")
        .eq("baraza_id", barazaId)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) {
        console.error("Baraza discussion list failed.", error.message);
        return jsonResponse({ error: "Could not load previous discussions." }, 503);
      }
      return jsonResponse({ discussions: data });
    }

    const discussionId = typeof body.id === "string" ? body.id : null;
    if (body.action === "discussions.save" && discussionId && !uuidPattern.test(discussionId)) {
      return jsonResponse({ error: "A valid discussion ID is required." }, 400);
    }
    if (body.action !== "discussions.save" && (!discussionId || !uuidPattern.test(discussionId))) {
      return jsonResponse({ error: "A valid discussion ID is required." }, 400);
    }
    const requiredDiscussionId = discussionId || "";

    if (body.action === "discussions.delete") {
      const { data, error } = await admin.from("baraza_discussions")
        .delete()
        .eq("id", requiredDiscussionId)
        .eq("baraza_id", barazaId)
        .neq("status", "In Progress")
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("Baraza discussion delete failed.", error.message);
        return jsonResponse({ error: "Could not delete this discussion." }, 503);
      }
      if (!data) return jsonResponse({ error: "In-progress discussions cannot be deleted." }, 409);
      return jsonResponse({ deleted: true });
    }

    if (body.action === "discussions.save") {
      const discussion = parseDiscussion(body.discussion);
      if (!discussion) return jsonResponse({ error: "The discussion configuration is invalid." }, 400);

      const values = {
        baraza_id: barazaId,
        title: discussion.title,
        topic: discussion.topic,
        scheduled_at: null,
        chairperson: "",
        configuration: discussion.configuration,
        status: discussion.ready ? "Ready" : "Draft",
        updated_at: new Date().toISOString(),
      };
      const result = discussionId
        ? await admin.from("baraza_discussions").update(values).eq("id", discussionId)
          .eq("baraza_id", barazaId).in("status", ["Draft", "Ready"]).select("*").maybeSingle()
        : await admin.from("baraza_discussions").insert(values).select("*").single();
      if (result.error) {
        console.error("Baraza discussion save failed.", result.error.message);
        return jsonResponse({ error: "Could not save this discussion." }, 503);
      }
      if (!result.data) return jsonResponse({ error: "This discussion can no longer be edited." }, 409);
      return jsonResponse({ discussion: result.data });
    }

    if (body.action === "discussions.start") {
      const { data: existing, error } = await admin.from("baraza_discussions")
        .select("id, status, configuration, title, topic")
        .eq("id", requiredDiscussionId)
        .eq("baraza_id", barazaId)
        .maybeSingle();
      if (error) {
        console.error("Baraza discussion lookup failed.", error.message);
        return jsonResponse({ error: "Could not start this discussion." }, 503);
      }
      if (!existing || !["Ready", "In Progress"].includes(existing.status)) {
        return jsonResponse({ error: "Save a complete discussion plan before starting." }, 409);
      }
      const validated = parseDiscussion(existing);
      if (!validated?.ready) return jsonResponse({ error: "Complete the discussion plan before starting." }, 400);

      const { data, error: updateError } = await admin.from("baraza_discussions")
        .update({
          status: "In Progress",
          started_at: existing.status === "In Progress" ? undefined : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requiredDiscussionId)
        .eq("baraza_id", barazaId)
        .select("*")
        .single();
      if (updateError) {
        console.error("Baraza discussion start failed.", updateError.message);
        return jsonResponse({ error: "Could not start this discussion." }, 503);
      }
      return jsonResponse({ discussion: data });
    }

    if (body.action === "discussions.timer") {
      const timerState = body.timerState;
      if (!isRecord(timerState)
        || !Number.isInteger(timerState.stageIndex) || Number(timerState.stageIndex) < 0
        || !Number.isInteger(body.stageCount) || Number(body.stageCount) < 1 || Number(body.stageCount) > 60
        || Number(timerState.stageIndex) >= Number(body.stageCount)
        || !Number.isInteger(timerState.remainingSeconds) || Number(timerState.remainingSeconds) < 0
        || Number(timerState.remainingSeconds) > 86400
        || !Number.isInteger(timerState.elapsedSeconds) || Number(timerState.elapsedSeconds) < 0
        || Number(timerState.elapsedSeconds) > 86400
        || !["paused", "running", "expired"].includes(String(timerState.status))
        || (timerState.status === "running"
          ? typeof timerState.runningSince !== "string" || !Number.isFinite(Date.parse(timerState.runningSince))
          : timerState.runningSince !== null)) {
        return jsonResponse({ error: "The timer state is invalid." }, 400);
      }

      const { data, error } = await admin.from("baraza_discussions")
        .update({ timer_state: timerState, updated_at: new Date().toISOString() })
        .eq("id", requiredDiscussionId)
        .eq("baraza_id", barazaId)
        .eq("status", "In Progress")
        .select("*")
        .maybeSingle();
      if (error) {
        console.error("Baraza discussion timer update failed.", error.message);
        return jsonResponse({ error: "Could not save timer progress." }, 503);
      }
      if (!data) return jsonResponse({ error: "This discussion is no longer in progress." }, 409);
      return jsonResponse({ discussion: data });
    }

    if (body.action === "discussions.complete") {
      const { data, error } = await admin.from("baraza_discussions")
        .update({ status: "Completed", updated_at: new Date().toISOString() })
        .eq("id", requiredDiscussionId)
        .eq("baraza_id", barazaId)
        .eq("status", "In Progress")
        .select("*")
        .maybeSingle();
      if (error) {
        console.error("Baraza discussion completion failed.", error.message);
        return jsonResponse({ error: "Could not complete this discussion." }, 503);
      }
      if (!data) return jsonResponse({ error: "This discussion is no longer in progress." }, 409);
      return jsonResponse({ discussion: data });
    }
  }

  return jsonResponse({ error: "Invalid request." }, 400);
});
