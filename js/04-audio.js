"use strict";

// ================== เสียง ==================
let audioCtx = null;

// ================== [เฟส A4] ไฟล์เสียง: มีไฟล์ = ใช้ไฟล์ / ไม่มี = สังเคราะห์เหมือนเดิม ==================
let SFX_FILE_VOL = 0.7;   // ดังของไฟล์ SFX (ปรับได้จาก settings)
let MUSIC_VOL = 0.35;     // ดังของเพลง (ปรับได้จาก settings)
const SFX_FILES = {
    shoot: "assets/audio/sfx/sfx_shoot.mp3", hit: "assets/audio/sfx/sfx_hit.mp3", crit: "assets/audio/sfx/sfx_crit.mp3",
    explosion: "assets/audio/sfx/sfx_explosion.mp3", heavy_explosion: "assets/audio/sfx/sfx_heavy_explosion.mp3",
    hurt: "assets/audio/sfx/sfx_hurt.mp3", levelup: "assets/audio/sfx/sfx_levelup.mp3", shotgun: "assets/audio/sfx/sfx_shotgun.mp3",
    sword: "assets/audio/sfx/sfx_sword.mp3", sword_stand: "assets/audio/sfx/sfx_sword_stand.mp3", click: "assets/audio/sfx/sfx_click.mp3",
    turret: "assets/audio/sfx/sfx_turret.mp3", heal: "assets/audio/sfx/sfx_heal.mp3", missile: "assets/audio/sfx/sfx_missile.mp3",
    missile_screamer: "assets/audio/sfx/sfx_missile_screamer.mp3", missile_heavy: "assets/audio/sfx/sfx_missile_heavy.mp3",
    warp: "assets/audio/sfx/sfx_warp.mp3", dash_cyber: "assets/audio/sfx/sfx_dash_cyber.mp3", dash_thruster: "assets/audio/sfx/sfx_dash_thruster.mp3",
    fireball: "assets/audio/sfx/sfx_fireball.mp3", frost: "assets/audio/sfx/sfx_frost.mp3"   // [v17] เวท MAGE — ไม่มีไฟล์ = สังเคราะห์อัตโนมัติ
};
const MUSIC_FILES = {
    bgm_cyber: "assets/audio/music/bgm_cyber.mp3", bgm_blood: "assets/audio/music/bgm_blood.mp3",
    bgm_venom: "assets/audio/music/bgm_venom.mp3", bgm_gold: "assets/audio/music/bgm_gold.mp3",
    bgm_main: "assets/audio/music/bgm_main.mp3"
};
function loadAudioMap(files) {
    let m = {};
    for (let k in files) {
        let a = new Audio(files[k]);
        a.preload = "auto";
        a._ok = false;
        // [v35] มือถือ: canplaythrough มักไม่ fire จนกว่าจะมี gesture (iOS/โหมดประหยัดแบต) — รับกว้างขึ้น 3 event ใด 1 พอ
        let markOk = () => { a._ok = true; };
        a.addEventListener("canplaythrough", markOk);
        a.addEventListener("canplay", markOk);
        a.addEventListener("loadeddata", markOk);
        a.addEventListener("error", () => { a._ok = false; console.warn("[audio] โหลดไม่สำเร็จ:", files[k], "— เช็คชื่อไฟล์/case ตรงกับโค้ดหรือเปล่า"); });
        m[k] = a;
    }
    return m;
}
// [v35] เตะ unlock ตอน gesture แรก: บังคับให้มือถือเริ่มโหลด/อนุญาตเสียงจริง (play เงียบๆ แล้ว pause)
// เรียกจาก musicAutoplayKick (16-boot) — หลังเตะ เพลง/SFX ไฟล์จะเริ่ม _ok และ startMusic ลองใหม่ให้อัตโนมัติ
function unlockMobileAudio() {
    let kick = (a) => {
        try {
            a.currentTime = 0;
            let pr = a.play();
            if (pr && pr.then) pr.then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
        } catch (e) {}
    };
    for (let k in SFX_AUDIO) kick(SFX_AUDIO[k]);
    for (let k in MUSIC_AUDIO) kick(MUSIC_AUDIO[k]);
    setTimeout(() => startMusic(), 300);   // ลองเปิดเพลงอีกครั้งเมื่อไฟล์เริ่มพร้อม (startMusic กันเพลงซ้ำเองอยู่แล้ว)
}
const SFX_AUDIO = loadAudioMap(SFX_FILES);
const MUSIC_AUDIO = loadAudioMap(MUSIC_FILES);

// ---- เพลงประกอบ: เปิดตามธีม (ไม่มีไฟล์ = เงียบ) ดัง/ปิดตามปุ่ม M ----
let bgmCurrent = null;
function startMusic() {
    if (isGameOver) return;   // [v19] หน้าเมนูเล่นเพลงได้ (เดิม !player = บล็อกตั้งแต่ยังไมี่เริ่มเกม)
    let key = player ? "bgm_" + getTheme().name.toLowerCase() : "bgm_main";   // [v19] เมนู = bgm_main / ในเกม = ธีมตามชั้น
    let el = (key !== "bgm_main" && MUSIC_AUDIO[key] && MUSIC_AUDIO[key]._ok) ? MUSIC_AUDIO[key] : MUSIC_AUDIO["bgm_main"];
    let wantKey = (el === MUSIC_AUDIO["bgm_main"]) ? "bgm_main" : key;
    if (!el || !el._ok) return;
    if (bgmCurrent === wantKey && !el.paused) return;   // เพลงเดิมเล่นอยู่ = ไม่รีสตาร์ท
    stopMusic();
    bgmCurrent = wantKey;
    el.loop = true;
    updateMusicVol();
    try { el.currentTime = 0; el.play().catch(() => {}); } catch (e) {}
}
function stopMusic() {
    for (let k in MUSIC_AUDIO) { try { MUSIC_AUDIO[k].pause(); } catch (e) {} }
    bgmCurrent = null;
}
function updateMusicVol() {
    let v = (sfxVolIdx === 2) ? 0 : (sfxVolIdx === 1 ? 0.5 : 1);
    for (let k in MUSIC_AUDIO) MUSIC_AUDIO[k].volume = MUSIC_VOL * v;
}
function playSynthSFX(type, pitch) {   // [v15] pitch ที่ 2 = ตัวคูณความถี่ (ไม่ส่ง = 1 เหมือนเดิม — caller เดิมไม่ต้องแก้)
    if (sfxVolIdx === 2) return;
    pitch = Math.max(0.5, Math.min(2, pitch || 1));
    // [เฟส A4] มีไฟล์เสียง = เล่นไฟล์ (โคลนเพื่อเล่นซ้อนกันได้) / ไม่มี = สังเคราะห์ต่อ
    let f = SFX_AUDIO[type];
    if (f && f._ok) {
        try {
            let c = f.cloneNode();
            c.volume = SFX_FILE_VOL * (sfxVolIdx === 1 ? 0.5 : 1);
            c.playbackRate = pitch;   // [v15] ไฟล์เสียงหมุนเร็ว/ช้าตาม pitch
            c.play().catch(() => {});
        } catch (e) {}
        return;
    }
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
        let t = audioCtx.currentTime;
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.detune.value = 1200 * Math.log2(pitch);   // [v15] ขยับทั้งเสียง 1 บรรทัด (แทนแตะทุก frequency ใน switch)
        let vol = 0.06, dur = 0.12, wave = "square";
        switch (type) {
            case "shoot":          wave = "square";   osc.frequency.setValueAtTime(900, t); osc.frequency.exponentialRampToValueAtTime(240, t + 0.09); dur = 0.09; break;
            case "hit":            wave = "triangle"; osc.frequency.setValueAtTime(500, t); osc.frequency.exponentialRampToValueAtTime(160, t + 0.08); dur = 0.08; break;
            case "crit":           wave = "sine";     osc.frequency.setValueAtTime(1300, t); osc.frequency.setValueAtTime(1900, t + 0.05); vol = 0.045; dur = 0.09; break;
            case "explosion":      wave = "sawtooth"; osc.frequency.setValueAtTime(180, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.3); vol = 0.09; dur = 0.3; break;
            case "heavy_explosion":wave = "sawtooth"; osc.frequency.setValueAtTime(120, t); osc.frequency.exponentialRampToValueAtTime(30, t + 0.5); vol = 0.12; dur = 0.5; break;
            case "hurt":           wave = "square";   osc.frequency.setValueAtTime(220, t); osc.frequency.exponentialRampToValueAtTime(90, t + 0.18); vol = 0.09; dur = 0.18; break;
            case "levelup":        wave = "sine";     osc.frequency.setValueAtTime(440, t); osc.frequency.setValueAtTime(660, t + 0.08); osc.frequency.setValueAtTime(880, t + 0.16); dur = 0.3; break;
            case "shotgun":        wave = "sawtooth"; osc.frequency.setValueAtTime(500, t); osc.frequency.exponentialRampToValueAtTime(80, t + 0.15); vol = 0.09; dur = 0.15; break;
            case "sword":          wave = "sawtooth"; osc.frequency.setValueAtTime(1400, t); osc.frequency.exponentialRampToValueAtTime(300, t + 0.1); vol = 0.05; dur = 0.1; break;
            case "sword_stand":    wave = "sawtooth"; osc.frequency.setValueAtTime(1000, t); osc.frequency.exponentialRampToValueAtTime(260, t + 0.08); vol = 0.018; dur = 0.08; break;
            case "click":          wave = "square";   osc.frequency.setValueAtTime(1200, t); dur = 0.05; vol = 0.04; break;
            case "turret":         wave = "square";   osc.frequency.setValueAtTime(1100, t); osc.frequency.exponentialRampToValueAtTime(500, t + 0.05); vol = 0.02; dur = 0.05; break;
            case "heal":           wave = "sine";     osc.frequency.setValueAtTime(600, t); osc.frequency.setValueAtTime(900, t + 0.07); vol = 0.03; dur = 0.1; break;
            case "missile":        wave = "sine";     osc.frequency.setValueAtTime(300, t); osc.frequency.exponentialRampToValueAtTime(900, t + 0.2); dur = 0.2; break;
            case "missile_screamer":wave = "sawtooth";osc.frequency.setValueAtTime(700, t); osc.frequency.exponentialRampToValueAtTime(1800, t + 0.25); vol = 0.05; dur = 0.25; break;
            case "missile_heavy":  wave = "square";   osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.35); vol = 0.09; dur = 0.35; break;
            case "fireball":       wave = "sawtooth"; osc.frequency.setValueAtTime(600, t); osc.frequency.exponentialRampToValueAtTime(120, t + 0.2); vol = 0.05; dur = 0.2; break;   // [v17]
            case "frost":          wave = "sine";     osc.frequency.setValueAtTime(1600, t); osc.frequency.exponentialRampToValueAtTime(400, t + 0.3); vol = 0.035; dur = 0.3; break;   // [v17]
            case "warp":           wave = "sine";     osc.frequency.setValueAtTime(120, t); osc.frequency.exponentialRampToValueAtTime(1400, t + 0.9); vol = 0.08; dur = 0.9; break;
            case "dash_cyber":     wave = "sine";     osc.frequency.setValueAtTime(1000, t); osc.frequency.exponentialRampToValueAtTime(200, t + 0.15); vol = 0.05; dur = 0.15; break;
            case "dash_thruster":  wave = "sawtooth"; osc.frequency.setValueAtTime(300, t); osc.frequency.exponentialRampToValueAtTime(90, t + 0.18); vol = 0.06; dur = 0.18; break;
            default: return;
        }
        if (sfxVolIdx === 1) vol *= 0.5;
        osc.type = wave;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.start(t); osc.stop(t + dur + 0.05);
    } catch (err) {}
}

