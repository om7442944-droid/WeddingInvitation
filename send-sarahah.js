// Netlify Function: send-sarahah
// Accepts POST { name, message } and tries server-side send via WhatsApp API if configured.
exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const name = (body.name || '').toString().trim();
    const message = (body.message || '').toString().trim();
    if (!message) return { statusCode: 400, body: JSON.stringify({ error: 'empty_message' }) };
    if (message.length > 2000) return { statusCode: 400, body: JSON.stringify({ error: 'message_too_long' }) };

    const waApiUrl = process.env.WHATSAPP_API_URL;
    const waToken = process.env.WHATSAPP_API_TOKEN;
    const waChannelId = process.env.WHATSAPP_CHANNEL_ID;
    const waChannelUrl = process.env.WHATSAPP_CHANNEL_URL || 'https://chat.whatsapp.com/CWDjAh6ghqbEgXL8htOg77';

    const combined = (name ? (name + '\n\n') : '') + message;

    // If full WhatsApp API is configured, attempt server-side POST
    if (waApiUrl && waToken && waChannelId) {
      try {
        if (typeof fetch === 'function') {
          const payload = { channel_id: waChannelId, name: name || 'مجهول', message };
          const res = await fetch(waApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + waToken
            },
            body: JSON.stringify(payload)
          });
          const waResp = await (res.json().catch(()=>null));
          return { statusCode: 200, body: JSON.stringify({ ok: true, sentToWhatsApp: !!res.ok, waResponse: waResp }) };
        } else {
          console.warn('fetch not available in Netlify runtime');
        }
      } catch (e) {
        console.warn('sending to WhatsApp API failed', e);
      }
    }

    // Fallback: provide redirect URL to open WhatsApp channel with prefilled text
    try {
      const encoded = encodeURIComponent(combined);
      let redirectUrl = waChannelUrl;
      if (redirectUrl.indexOf('?') === -1) redirectUrl += '?text=' + encoded; else redirectUrl += '&text=' + encoded;
      return { statusCode: 200, body: JSON.stringify({ ok: true, redirectUrl }) };
    } catch (e) {
      console.warn('failed building whatsapp redirect', e);
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, forwarded: false }) };
  } catch (err) {
    console.error('send-sarahah error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error' }) };
  }
};
