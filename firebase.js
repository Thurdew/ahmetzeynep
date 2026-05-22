/* ═══════════════════════════════════════════════════════════════════
   ⚙️  SUPABASE YAPILANDIRMASI
   ─────────────────────────────────────────────────────────────────
   Supabase Dashboard → Project Settings → API
   "Project URL" ve "anon public" key'i buraya yapıştır.
═══════════════════════════════════════════════════════════════════ */
const SUPABASE_URL      = "https://alomxtszjdwsaoxluhzr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsb214dHN6amR3c2FveGx1aHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzIwNDMsImV4cCI6MjA5NDk0ODA0M30.Oy13wTfmpT8e7AHF3raW_akQkCUdJDu1gzXK09ZT8Nk";

/* ── Admin şifresi ────────────────────────────────────────────── */
const ADMIN_PASSWORD = "ahmetzeynep2026";

/* ── Supabase client ─────────────────────────────────────────── */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ═══════════════════════════════════════════════════════════════
   FOTOĞRAF FONKSİYONLARI
═══════════════════════════════════════════════════════════════ */

async function loadPhotos() {
    try {
        const { data, error } = await sb.from('photos')
            .select('*').order('section').order('order');
        if (error) throw error;
        return data || [];
    } catch (e) { console.error('loadPhotos:', e); return []; }
}

async function loadPhotosBySection(section) {
    try {
        const { data, error } = await sb.from('photos')
            .select('*').eq('section', section).order('order');
        if (error) throw error;
        return data || [];
    } catch (e) { console.error('loadPhotosBySection:', e); return []; }
}

async function addPhoto(url, section, caption = '') {
    const { data: existing } = await sb.from('photos').select('id').eq('section', section);
    const order = existing ? existing.length : 0;
    const { error } = await sb.from('photos').insert({ url, section, caption, order, created_at: Date.now() });
    if (error) throw error;
}

async function deletePhoto(id) {
    const { error } = await sb.from('photos').delete().eq('id', id);
    if (error) throw error;
}

async function updatePhoto(id, data) {
    const { error } = await sb.from('photos').update(data).eq('id', id);
    if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════════
   SORU FONKSİYONLARI
═══════════════════════════════════════════════════════════════ */

async function loadQuestions() {
    try {
        const { data, error } = await sb.from('questions').select('*').order('order');
        if (error) throw error;
        return (data || []).map(q => ({
            id:       q.id,
            question: q.question,
            options:  Array.isArray(q.options) ? q.options : [],
            answer:   q.answer  ?? 0,
            okMsg:    q.ok_msg,
            badMsg:   q.bad_msg,
            points:   q.points  ?? 10,
            order:    q.order   ?? 0
        }));
    } catch (e) { console.error('loadQuestions:', e); return []; }
}

async function addQuestion(data) {
    const { data: existing } = await sb.from('questions').select('id');
    const order = existing ? existing.length : 0;
    const { error } = await sb.from('questions').insert({
        question:   data.question || '',
        options:    data.options  || [],
        answer:     data.answer   ?? 0,
        ok_msg:     data.okMsg    || '✅ Doğru!',
        bad_msg:    data.badMsg   || '❌ Yanlış.',
        points:     data.points   ?? 10,
        order,
        created_at: Date.now()
    });
    if (error) throw error;
}

async function updateQuestion(id, data) {
    const { error } = await sb.from('questions').update({
        question: data.question,
        options:  data.options,
        answer:   data.answer,
        ok_msg:   data.okMsg,
        bad_msg:  data.badMsg,
        points:   data.points
    }).eq('id', id);
    if (error) throw error;
}

async function deleteQuestion(id) {
    const { error } = await sb.from('questions').delete().eq('id', id);
    if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════════
   AYARLAR
═══════════════════════════════════════════════════════════════ */

async function loadSettings() {
    try {
        const { data, error } = await sb.from('settings')
            .select('data').eq('id', 'app').single();
        if (error || !data) return {};
        return data.data || {};
    } catch (e) { console.error('loadSettings:', e); return {}; }
}

async function updateSettings(newData) {
    const current = await loadSettings();
    const merged  = { ...current, ...newData };
    const { error } = await sb.from('settings').upsert({ id: 'app', data: merged });
    if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════════
   OYUN ODA SİSTEMİ
═══════════════════════════════════════════════════════════════ */

function genRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function getPlayerId() {
    let id = sessionStorage.getItem('az_playerId');
    if (!id) {
        id = 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        sessionStorage.setItem('az_playerId', id);
    }
    return id;
}

async function createRoom(gameType, extraState = {}) {
    const code     = genRoomCode();
    const playerId = getPlayerId();
    const roomData = {
        gameType,
        status:        'waiting',
        player1:       playerId,
        player2:       null,
        currentPlayer: 1,
        winner:        null,
        createdAt:     Date.now(),
        ...extraState
    };
    const { error } = await sb.from('game_rooms').insert({
        id:         `${gameType}_${code}`,
        game_type:  gameType,
        data:       roomData
    });
    if (error) throw error;
    return code;
}

async function joinRoom(gameType, roomCode) {
    const key = `${gameType}_${roomCode.toUpperCase()}`;
    const { data, error } = await sb.from('game_rooms')
        .select('data').eq('id', key).single();
    if (error || !data) throw new Error('Oda bulunamadı. Kodu kontrol et.');
    const roomData = data.data;
    if (roomData.status !== 'waiting') throw new Error('Bu oda dolu veya oyun başladı.');
    const playerId = getPlayerId();
    if (roomData.player1 === playerId) throw new Error('Kendi odana katılamazsın.');
    const newData = { ...roomData, player2: playerId, status: 'playing' };
    const { error: upErr } = await sb.from('game_rooms')
        .update({ data: newData, updated_at: new Date().toISOString() })
        .eq('id', key);
    if (upErr) throw upErr;
    return { ...newData, roomCode };
}

async function getRoomData(gameType, roomCode) {
    const key = `${gameType}_${roomCode}`;
    const { data, error } = await sb.from('game_rooms')
        .select('data').eq('id', key).single();
    if (error || !data) return null;
    return data.data;
}

function listenRoom(gameType, roomCode, callback) {
    const key = `${gameType}_${roomCode}`;

    // İlk veriyi hemen getir
    sb.from('game_rooms').select('data').eq('id', key).single()
        .then(({ data }) => { if (data) callback(data.data); });

    // Realtime dinle
    const channel = sb.channel(`room_${key}`)
        .on('postgres_changes', {
            event:  '*',
            schema: 'public',
            table:  'game_rooms',
            filter: `id=eq.${key}`
        }, payload => {
            callback(payload.new?.data || null);
        })
        .subscribe();

    return () => sb.removeChannel(channel);
}

async function updateRoom(gameType, roomCode, partialData) {
    const key     = `${gameType}_${roomCode}`;
    const current = await getRoomData(gameType, roomCode);
    if (!current) throw new Error('Oda verisi alınamadı.');
    const newData = { ...current, ...partialData };
    const { error } = await sb.from('game_rooms')
        .update({ data: newData, updated_at: new Date().toISOString() })
        .eq('id', key);
    if (error) throw error;
}

async function deleteRoom(gameType, roomCode) {
    const { error } = await sb.from('game_rooms')
        .delete().eq('id', `${gameType}_${roomCode}`);
    if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════════
   YARDIMCI FONKSİYONLAR
═══════════════════════════════════════════════════════════════ */

function checkAdminPassword(input) {
    return input === ADMIN_PASSWORD;
}

function fireConfetti() {
    const colors = ['#FFB6C1','#C8A2C8','#F5C842','#FF9AA2','#B5EAD7','#FFDAC1','#fff'];
    for (let i = 0; i < 130; i++) {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'confetti';
            const size = 5 + Math.random() * 9;
            el.style.cssText = [
                'left:'               + (Math.random() * 100) + 'vw',
                'width:'              + size + 'px',
                'height:'             + size + 'px',
                'background:'         + colors[Math.floor(Math.random() * colors.length)],
                'animation-duration:' + (2.2 + Math.random() * 3) + 's',
                'animation-delay:'    + (Math.random() * 1.5) + 's',
                'border-radius:'      + (Math.random() > .45 ? '50%' : '2px')
            ].join(';');
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 5500);
        }, i * 18);
    }
}

function startParticles(containerId = 'particles') {
    const EMOJIS = ['🌸','💕','✨','🌺','💖','🌷','💗','⭐','🌼','💞','🍀','🌙'];
    const cont   = document.getElementById(containerId);
    if (!cont) return;
    (function spawnLoop() {
        const el       = document.createElement('div');
        el.className   = 'particle';
        el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        el.style.left  = Math.random() * 100 + 'vw';
        const dur   = 9 + Math.random() * 14;
        const delay = Math.random() * 10;
        el.style.animationDuration = dur   + 's';
        el.style.animationDelay    = delay + 's';
        el.style.fontSize          = (.65 + Math.random() * .75) + 'rem';
        cont.appendChild(el);
        setTimeout(() => el.remove(), (dur + delay + 1) * 1000);
        setTimeout(spawnLoop, 650);
    })();
}
