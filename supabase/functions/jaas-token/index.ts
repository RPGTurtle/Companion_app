// Supabase Edge Function: genera un token JWT firmato per JaaS (Jitsi as a Service).
// AppID, Key ID e chiave privata vengono letti dai secrets del progetto Supabase
// (mai scritti in questo file), impostati automaticamente dalla GitHub Action
// a partire dai repository secrets di GitHub.

import { SignJWT, importPKCS8 } from "npm:jose@5";

const APP_ID = Deno.env.get("JAAS_APP_ID")!;
const KEY_ID = Deno.env.get("JAAS_KEY_ID")!;
const PRIVATE_KEY_PEM = Deno.env.get("JAAS_PRIVATE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { room, nickname, isGM } = await req.json();

    if (!room || typeof room !== "string" || !nickname || typeof nickname !== "string") {
      return new Response(JSON.stringify({ error: "room e nickname sono obbligatori" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Minuscolo obbligatorio: JaaS confronta il nome-stanza in minuscolo internamente,
    // un token con maiuscole nel claim "room" viene rifiutato con "Authentication failed".
    const nomeStanzaPulito = room.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 100).toLowerCase();
    const nicknamePulito = nickname.slice(0, 60);

    const chiavePrivata = await importPKCS8(PRIVATE_KEY_PEM, "RS256");

    const ora = Math.floor(Date.now() / 1000);

    const jwt = await new SignJWT({
      aud: "jitsi",
      iss: "chat",
      sub: APP_ID,
      room: nomeStanzaPulito,
      context: {
        user: {
          name: nicknamePulito,
          moderator: isGM === true,
        },
        features: {
          livestreaming: false,
          recording: false,
          transcription: false,
          "outbound-call": false,
        },
      },
    })
      .setProtectedHeader({ alg: "RS256", kid: `${APP_ID}/${KEY_ID}`, typ: "JWT" })
      .setIssuedAt(ora)
      .setNotBefore(ora - 10)
      .setExpirationTime(ora + 60 * 60 * 3) // valido 3 ore, sufficiente per una sessione di gioco
      .sign(chiavePrivata);

    return new Response(JSON.stringify({ token: jwt, appId: APP_ID, room: nomeStanzaPulito }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Errore nella funzione jaas-token:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
