// Supabase Edge Function: crea (o recupera se già esiste) una stanza video su Daily.co
// per una stanza di gioco. La chiave API Daily resta nei secrets del progetto Supabase,
// non è mai esposta al browser.

const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY")!;

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
    const { room } = await req.json();
    if (!room || typeof room !== "string") {
      return new Response(JSON.stringify({ error: "room è obbligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nomeStanza = room.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40).toLowerCase();

    // Prova prima a recuperare la stanza, se esiste già
    const getResp = await fetch(`https://api.daily.co/v1/rooms/${nomeStanza}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    if (getResp.ok) {
      const esistente = await getResp.json();
      return new Response(JSON.stringify({ url: esistente.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Non esiste: la creiamo. Scade dopo 24 ore di inattività della stanza di gioco
    // (viene comunque ricreata al bisogno se qualcuno riapre il video più avanti).
    const scadenza = Math.floor(Date.now() / 1000) + 60 * 60 * 24;

    const createResp = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: nomeStanza,
        privacy: "public",
        properties: {
          exp: scadenza,
          enable_prejoin_ui: false,
          enable_screenshare: true,
          max_participants: 30,
        },
      }),
    });

    if (!createResp.ok) {
      const dettaglio = await createResp.text();
      console.error(`Creazione stanza Daily fallita (status ${createResp.status}):`, dettaglio);
      throw new Error(`Creazione stanza Daily fallita (status ${createResp.status}): ${dettaglio}`);
    }

    const nuova = await createResp.json();
    return new Response(JSON.stringify({ url: nuova.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Errore nella funzione daily-room:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
