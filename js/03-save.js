"use strict";

// ================== META: save / load ==================
function saveMeta() {
    try { localStorage.setItem("cyberMetaV1", JSON.stringify({ cores: cores, metaUnlocks: metaUnlocks, stats: stats, achievements: achievements })); } catch (e) {}
}
function loadMeta() {
    try {
        let d = JSON.parse(localStorage.getItem("cyberMetaV1"));
        if (d) {
            cores = d.cores || 0;
            metaUnlocks = d.metaUnlocks || {};
            achievements = d.achievements || {};
            if (d.stats) stats = Object.assign(stats, d.stats);
            if (!Array.isArray(stats.highscores)) stats.highscores = [];   // [v20] เซฟเก่า/เสียหาย = รีเซ็ตเป็นว่าง
        }
    } catch (e) {}
}
function unlockAch(id) {
    if (achievements[id]) return;
    achievements[id] = true;
    let a = ACH_BY_ID[id];
    toasts.push({ title: "🏆 " + a.name, sub: a.desc, life: 180, maxLife: 180 });
    if (toasts.length > 3) toasts.shift();
    playSynthSFX("levelup");
    saveMeta();
}

// ================== [v27] Challenge รายรัน — สำเร็จครั้งเดียวต่อรัน (ไม่ toast ซ้ำ) ==================
function unlockRunChal(id) {
    if (!runChal) return;
    if (runChal.got[id]) return;
    runChal.got[id] = true;
    let c = null;
    for (let i = 0; i < RUN_CHALLENGES.length; i++) if (RUN_CHALLENGES[i].id === id) c = RUN_CHALLENGES[i];
    if (!c) return;
    toasts.push({ title: CHAL_ICON[id] + " CHALLENGE: " + c.name, sub: c.desc, life: 180, maxLife: 180 });
    if (toasts.length > 3) toasts.shift();
    playSynthSFX("levelup");
}

// ================== เซฟกลางรัน ==================
function saveRun() {
    if (!player || isGameOver) return;
    if (players.length > 1) return;   // [เฟส 3A] สัญญาข้อ 8: เซฟกลางรันเฉพาะ single
    try {
        localStorage.setItem("cyberRunV1", JSON.stringify({
            p: player, ul: player.levels, ev: evolved, rm: runMods,
            floor: currentFloor, score: score, coins: player.coins, kills: kills, shopBuyCount: (player.shopBuys || 0),
            rc: runChal   // [v27] สถานะ challenge ติดไปกับเซฟกลางรัน
        }));
    } catch (e) {}
}
function getSavedRun() {
    try { return JSON.parse(localStorage.getItem("cyberRunV1")); } catch (e) { return null; }
}
function clearSavedRun() { try { localStorage.removeItem("cyberRunV1"); } catch (e) {} }
function continueRun() {
    let d = getSavedRun();
    if (!d || !d.p) return;
    player = d.p;
    players = [player];   // [เฟส 2A]
    if (player.coins === undefined) player.coins = d.coins || 0;   // [3B-2] กระเป็า (เซฟเก่า/ใหม่)
    player.magnetOff = !!player.magnetOff;   // [3B-3] defaults สำหรับเซฟเก่า
    player.maxHpDown = player.maxHpDown || 0;
    if (!player.trail) player.trail = [];
    if (!player.buffs) player.buffs = { shield: 0, firerate: 0, dmg: 0, speed: 0 };
    player.pity = player.pity || 0;
    player.dashCritTimer = player.dashCritTimer || 0;
    player.berserkT = player.berserkT || 0;   // [v16] เซฟเก่าไม่มีค่านี้
    player.burnT = player.burnT || 0; player.burnDps = player.burnDps || 0;   // [v17]
    player.slowT = player.slowT || 0; player.slowPct = player.slowPct || 0;   // [v17]
    player.autoAtk = player.autoAtk !== false;   // [เฟส 1] เซฟเก่าอาจไม่มีค่านี้
    player.curses = player.curses || [];
    player.healAccum = 0; player.healCapT = 1;
    player.levels = d.ul || {};   // [3B-1] อัพเกรดรายคน (เซฟเก่าย้ายเข้า player ให้)
    evolved = Object.assign({ sword: false, gun: false, shotgun: false, laser: false, drone: false }, d.ev || {});
    runMods = Object.assign(freshMods(), d.rm || {});
    currentFloor = d.floor || 1;
    score = d.score || 0; kills = d.kills || 0;
    player.shopBuys = d.shopBuyCount || 0;   // [3B-3fix] ราคาร้านรายคน
    pendingLevelUps = 0; shopRandomBought = false;
    killStreak = 0; streakTimer = 0; droneOverdrive = 0;
    runChal = d.rc ? { got: d.rc.got || {}, kills: d.rc.kills || 0, bosses: d.rc.bosses || 0, crits: d.rc.crits || 0, deals: d.rc.deals || 0, coins: 0, hitThisRun: !!d.rc.hitThisRun } : freshRunChal();   // [v27+v28]
    hitStopFrames = 0; shakeT = 0; shakeMag = 0;
    gameTime = 0; frameCount = 0; shotgunBlastSeq = 0;
    shatterQueue = []; toasts = [];
    isPaused = false; isShopping = false; isGameOver = false; isWarping = false;
    isPauseMenu = false; isBuildMenu = false;
    portalItemSpawned = false;
    recalcStats();
    ["start-screen", "upgrade-screen", "shop-screen", "mod-screen", "pause-screen", "build-screen", "gameover-screen"].forEach(id => document.getElementById(id).classList.add("hidden"));
    setupStage();
    startMusic();   // [เฟส A4]
    particles.push({ type: "text", x: player.x, y: player.y - 40, text: "RUN RESTORED — FLOOR " + currentFloor, life: 90, maxLife: 90, color: "#00ffcc", vy: -0.4 });
    playSynthSFX("warp");
}

