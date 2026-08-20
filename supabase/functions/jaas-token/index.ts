// Supabase Edge Function: genera un token JWT firmato per JaaS (Jitsi as a Service).
//
// ATTENZIONE: su richiesta esplicita del proprietario del progetto, i valori di
// configurazione (AppID, Key ID, chiave privata) sono inseriti direttamente in
// questo file invece che nei secrets di Supabase. Questo significa che chiunque
// abbia accesso al repository GitHub ha accesso completo alla chiave privata e
// può generare token validi per qualsiasi stanza JaaS di questo account. Va bene
// solo se il repository resta privato e sotto il tuo controllo.

import { SignJWT, importPKCS8 } from "npm:jose@5";

const APP_ID = "vpaas-magic-cookie-f524f38ed2344e7cae283aecd03d7748";
const KEY_ID = "ba63c6";
const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEwAIBADANBgkqhkiG9w0BAQEFAASCBKowggSmAgEAAoIBAQCYYg3Wt/XkF+dT
eOFaqsEgaW16VjpaoOveqlZnbH+PRSDPclgWW0jofv0cjCfO6P43B8VNHLg3QMI+
+Y2LWXWMa7mGz+hBao7lkrGNuceLfCgpDVg35zGlrUGyxdFlTmrVIaWvbVaHgTh+
rScbRmeinyVtlgqrNpdjNmcictHF6aLJHzGKAi2OZeEmrYQ5HqZdbk8VcKI/9W5B
DsrH5VUJJ+RpyJbJwE5SMiZa8R/R9yi47uinQke/cgERUOQVE/X+qyXOaKGJhd8M
xrdoGJMQUVqjIzt4Z85+OivqUaQqyTJX7m3n6bsRxcW/h/sv/mAYgc3Q8S4WsXPF
B9NSak4dAgMBAAECggEBAIdhrivSumoQdpupbIVx6S0TnYkv7J4yE/x6V1OBiH7Q
CstjKjGKnma408U2G/Pu+lQH2lmdJ2knZqwuaHuiWhYMawMD2bOsqRH7VzW0FT2u
a7u1OGhKRciM+i6LI3MezTlXsGz/9f1jZ77btT+9ODu5qrYGtKnSUYN6hPyNCCQN
BEvsTWZ8XN/CDS7S7y0pn2pD+2JXdKigoWsR5l6POQcWmDVaPibKpISQUlUHK94R
NV8UtwkZD1uomaz59CD6gh8NMgDkrU50frI3TlPh84I7dO0EQxDCw3O7IeDrFeTZ
9rpLo+EJDTxmdA61/7RpE+Lj6jv0LXNGJs6mNJR75uECgYEAy9NsK4lWBithEG/N
0b0L7c3Tpy8TtmceoJw0HrSR1lSgMuqS35pqR5z1Ln6Mqwuou95nXy+skcoQrNsK
Q74SFugdgaI7wKYor/4mxFJJOPgq6eHEDsEupQMl3q+Qi5HepWJTP9mFCvmAENtp
74KP6vMlVDfVC2skz4Ip/keH4AUCgYEAv2Oddv7Lzevk2e0SZn7UrRGBBABTj4UD
lpf/KcRzUyHVp6zCDqPnOiGcENC0I3/5zt5qcFlx25dnjsLFVd5FJl2Tp+INWB0m
tAQGNfsQOnxCdcz8tHphypV2KDwyUllHSdeSCK91kxVJzEbPiACPwLZ59X6LArQv
stv3GoeoSTkCgYEAiXwM5Lj4a6TrDhk8LZNk7nz9nTGmDE02XYO/rE6EaJwgiver
JmST98Ypo7j8zYtJv59e/te7gYNZCB+fpt4YeZcMABscTvBFVaELKTWP6nuLBsOg
aYtpGSksbC7kQyCbm9bc7J6enS56ceRuan4Y8ZQcw9f9PnyBEe9sv/Yj8rkCgYEA
it97aNblh1v9yOuvCFRLefFTjlW2TFOWEPXlnqb/j3jjkTFX9kuUAqhUmBb4PzIj
T6ovzan5Zf9skzhc/Du2LWqFM7JhQGiWptSstQqh8e4sQ1Iko8iRoO/mtrdHRF2n
zrrvKgI27CzsSZ+wAt11cb52rF3P/HxGiB/4I3X/9HECgYEArlyGSLSItTHhJ4nc
FTCfQ0SlqvL1WfHm8GOYzntpO3CTj+rTmbesj4A9Q2oMs3HEyjnly2zyvuTH8Y+A
1YFQCg2aq7kc5IvQwrQJ5yekdSUd1+S1WToXYOcAJzzOA9+mz+dLXlh/jhsE7/eH
lSNOaHnYKcK8WDAdJuvCbccgDu0=
-----END PRIVATE KEY-----`;

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
    const { room, nickname } = await req.json();

    if (!room || typeof room !== "string" || !nickname || typeof nickname !== "string") {
      return new Response(JSON.stringify({ error: "room e nickname sono obbligatori" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nomeStanzaPulito = room.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 100);
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
          moderator: true,
        },
        features: {
          livestreaming: false,
          recording: false,
          transcription: false,
          "outbound-call": false,
        },
      },
    })
      .setProtectedHeader({ alg: "RS256", kid: `${APP_ID}/${KEY_ID}` })
      .setIssuedAt(ora)
      .setNotBefore(ora - 10)
      .setExpirationTime(ora + 60 * 60 * 3) // valido 3 ore, sufficiente per una sessione di gioco
      .sign(chiavePrivata);

    return new Response(JSON.stringify({ token: jwt, appId: APP_ID, room: nomeStanzaPulito }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
