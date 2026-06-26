const express = require('express');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json({ limit: '8kb' }));
// Allow basic CORS so the page can call the endpoint when served from this server
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const DATA_DIR = path.join(__dirname, 'data');
const MFILE = path.join(DATA_DIR, 'messages.json');
const GFILE = path.join(DATA_DIR, 'guestbook.json');
const MILESTONES_FILE = path.join(__dirname, 'data', 'milestones.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
if (!fs.existsSync(MFILE)) fs.writeFileSync(MFILE, '[]', 'utf8');
if (!fs.existsSync(GFILE)) fs.writeFileSync(GFILE, '[]', 'utf8');

async function readMilestones(){
  try{
    const raw = await fsPromises.readFile(MILESTONES_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  }catch(e){
    return {};
  }
}
async function writeMilestones(obj){
  try{
    await fsPromises.mkdir(path.dirname(MILESTONES_FILE), { recursive: true });
    await fsPromises.writeFile(MILESTONES_FILE, JSON.stringify(obj, null, 2), 'utf8');
    return true;
  }catch(err){
    console.error('writeMilestones error', err);
    return false;
  }
}

// Endpoint to receive messages and store them
app.post('/api/send-sarahah', async (req, res) => {
  try {
    const name = (req.body && req.body.name) ? String(req.body.name).trim() : '';
    const msg = (req.body && req.body.message) ? String(req.body.message).trim() : '';
    if (!msg) return res.status(400).json({ error: 'empty_message' });
    if (msg.length > 2000) return res.status(400).json({ error: 'message_too_long' });

    const entry = {
      id: Date.now(),
      name: name || 'مجهول',
      message: msg,
      receivedAt: new Date().toISOString()
    };

    // save locally to messages file
    try{
      const raw = fs.readFileSync(MFILE, 'utf8') || '[]';
      let arr = [];
      try { arr = JSON.parse(raw); } catch (e) { arr = []; }
      arr.push(entry);
      fs.writeFileSync(MFILE, JSON.stringify(arr, null, 2), 'utf8');
    }catch(e){ console.warn('failed writing messages file', e); }

    // If WhatsApp API configured, attempt server-side send
    const waApiUrl = process.env.WHATSAPP_API_URL; // e.g. https://api.whatsapp.com/send or your provider endpoint
    const waToken = process.env.WHATSAPP_API_TOKEN;
    const waChannelId = process.env.WHATSAPP_CHANNEL_ID; // channel identifier if required by API
    if (waApiUrl && waToken && waChannelId) {
      try {
        if (typeof fetch === 'function') {
          const payload = { channel_id: waChannelId, name: entry.name, message: entry.message };
          const r = await fetch(waApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + waToken
            },
            body: JSON.stringify(payload)
          });
          const waResp = await (r.json().catch(()=>null));
          return res.json({ ok: true, sentToWhatsApp: !!r.ok, waResponse: waResp });
        } else {
          console.warn('fetch not available in Node runtime; cannot send to WhatsApp API from server.');
        }
      } catch (e) {
        console.warn('sending to WhatsApp API failed', e);
      }
    }

    // If WhatsApp channel URL configured (no API), return redirect URL to open channel with text as fallback
    const waChannel = process.env.WHATSAPP_CHANNEL_URL || 'https://whatsapp.com/channel/0029VbCyTkV72WToFFdzya08';
    if (waChannel) {
      try {
        const combined = (entry.name ? (entry.name + '\n\n') : '') + entry.message;
        const encoded = encodeURIComponent(combined);
        let redirectUrl = waChannel;
        if (redirectUrl.indexOf('?') === -1) redirectUrl += '?text=' + encoded;
        else redirectUrl += '&text=' + encoded;
        return res.json({ ok: true, redirectUrl });
      } catch (e) { console.warn('failed building whatsapp redirect', e); }
    }

    // fallback: attempt to forward to generic relay if provided
    const relayUrl = process.env.SARAHAH_RELAY_URL || process.env.SARAH_RELAY_URL;
    const apiKey = process.env.SARAHAH_API_KEY || process.env.SARAH_API_KEY;
    let forwarded = false;
    if (relayUrl) {
      try {
        if (typeof fetch === 'function'){
          const headers = { 'Content-Type': 'application/json' };
          if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
          const r = await fetch(relayUrl, { method: 'POST', headers, body: JSON.stringify({ name: entry.name, message: entry.message }) });
          forwarded = r && r.ok;
        }
      } catch (e) { console.warn('forward to relay failed', e); forwarded = false; }
    }

    return res.json({ ok: true, forwarded });
  } catch (err) {
    console.error('send-sarahah error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Guestbook endpoints
app.get('/api/guestbook', (req, res) => {
  try {
    const raw = fs.readFileSync(GFILE, 'utf8') || '[]';
    const arr = JSON.parse(raw);
    res.json(arr);
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/guestbook', (req, res) => {
  try {
    const name = (req.body.name || 'ضيف كريم').slice(0, 120);
    const message = (req.body.message || '').slice(0, 2000).trim();
    if(!message) return res.status(400).json({ error: 'empty_message' });

    const entry = { id: Date.now(), name, message, createdAt: new Date().toISOString() };
    const raw = fs.readFileSync(GFILE, 'utf8') || '[]';
    let arr = [];
    try { arr = JSON.parse(raw); } catch (e) { arr = []; }
    arr.push(entry);
    fs.writeFileSync(GFILE, JSON.stringify(arr, null, 2), 'utf8');
    res.json(entry);
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
});

// Guestbook delete endpoint
app.post('/api/guestbook/delete', (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const password = String(req.body.password || '');
    if(password !== 'M&M') return res.status(403).json({ error: 'forbidden' });
    if(!ids.length) return res.status(400).json({ error: 'no_ids' });

    const raw = fs.readFileSync(GFILE, 'utf8') || '[]';
    let arr = [];
    try{ arr = JSON.parse(raw); }catch(e){ arr = []; }
    const idSet = new Set(ids.map(id=>Number(id)));
    const remain = arr.filter(item => !idSet.has(Number(item.id)));
    fs.writeFileSync(GFILE, JSON.stringify(remain, null, 2), 'utf8');
    return res.json({ ok: true, deletedCount: arr.length - remain.length });
  } catch(e){ return res.status(500).json({ error: 'server_error' }); }
});

// Milestones endpoints
app.get('/api/milestones', async (req, res) => {
  try{
    const data = await readMilestones();
    res.json(data);
  }catch(err){
    res.status(500).json({ error: 'failed to load' });
  }
});

app.post('/api/milestones', async (req, res) => {
  try{
    const requiredKey = process.env.EDIT_API_KEY;
    if(requiredKey){
      const key = req.headers['x-api-key'] || '';
      if(key !== requiredKey) return res.status(401).json({ error: 'unauthorized' });
    }
    const body = req.body;
    if(!body || typeof body !== 'object') return res.status(400).json({ error: 'invalid payload' });
    const ok = await writeMilestones(body);
    if(!ok) return res.status(500).json({ error: 'write failed' });
    res.json({ ok: true });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Serve static files (the invitation) from project root
app.use(express.static(path.join(__dirname)));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Invitation server running: http://localhost:${port}/index.html`));
