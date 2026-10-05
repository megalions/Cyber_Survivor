"use strict";

// ================== GAME LOOP ==================
function gameLoop(ts) {
    if (!loopRunning) return;
    requestAnimationFrame(gameLoop);
    pollGamepads();   // [เฟส 1] poll จอยทุกเฟรม แม้ตอนเมนู/พัก (ผูกปุ่ม + ปุ่ม Start)
    tickLevelUp();    // [3B-1] จับเวลาเลือกการ์ดเลเวลอัพ (เดินแม้เกมพักอยู่)
    if (!lastFrameTime) lastFrameTime = ts;
    let delta = (ts - lastFrameTime) / 1000;
    lastFrameTime = ts;
    if (delta < 0) delta = 0;
    if (delta > 0.25) delta = 0.25;
    accumulator += delta;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 8) {
        update();
        accumulator -= FIXED_DT;
        steps++;
    }
    if (steps >= 8) accumulator = 0;
    if (shakeT > 0) shakeT -= delta;
    render();
}

// ================== START SCREEN + META ==================
function renderStartScreen() {
    document.getElementById("core-balance").innerHTML = "🔴 CORE สะสมถาวร: <b>" + cores + "</b> (ได้จากการกำจัดบอส — OVERLORD 5 / DEVIL CORE 10 เม็ด)";

    let sv = getSavedRun();
    document.getElementById("continue-slot").innerHTML = (sv && sv.p)
        ? '<button class="btn" onclick="continueRun()">▶ CONTINUE — FLOOR ' + (sv.floor || 1) + ' (LV ' + (sv.p.level || 1) + ' · SCORE ' + (sv.score || 0) + ')</button>'
        : "";

    if (!lobby) resetLobby();
    renderLobby();

    let mhtml = "";
    META_PERKS.forEach(p => {
        let owned = !!metaUnlocks[p.id];
        mhtml += '<div class="meta-card' + (owned ? ' owned' : '') + '" onclick="buyPerk(\'' + p.id + '\')">'
              + '<div class="meta-name">' + p.name + '</div>'
              + '<div class="meta-desc">' + p.desc + '</div>'
              + '<div class="up-price">' + (owned ? "✔ OWNED" : p.cost + " CORE") + '</div>'
              + '</div>';
    });
    document.getElementById("meta-perks").innerHTML = mhtml;

    // [v27] Main โชว์แค่ชิปสรุป — ลิสต์เต็มย้ายไป RECORDS ในเซ็ตติ้ง
    let doneAch = 0;
    ACHIEVEMENTS.forEach(a => { if (achievements[a.id]) doneAch++; });
    let ac = document.getElementById("ach-count");
    if (ac) ac.innerHTML = '🏆 ACHIEVEMENTS ' + doneAch + '/' + ACHIEVEMENTS.length +
        ' · 🎯 CHALLENGES ' + ((runChal ? Object.keys(runChal.got).length : 0)) + '/' + RUN_CHALLENGES.length +
        ' <span style="color:#55607a;">(ดูทั้งหมด: ⚙ SETTINGS → 📊 RECORDS)</span>';

    // [v20-11] ป้าย 20 อันดับไหลขึ้น (แทนสถิติรวมเดิม)
    let hb = document.getElementById("highscore-board");
    if (hb) {
        let rows = (stats.highscores || []).slice(0, 20);
        let html = '<div class="hs-head">— HIGH SCORE —</div><div class="hs-rows' + (rows.length > 8 ? " flow" : "") + '">';
        if (rows.length === 0) {
            html += '<div class="hs-row" style="text-align:center; margin-top:40px;">ยังไม่มีสถิติ — ไปสร้างตำนาน!</div>';
        } else {
            rows.forEach((r, i) => {
                html += '<div class="hs-row ' + (i === 0 ? "top1" : i < 3 ? "top3" : "") + '">'
                     + String(i + 1).padStart(2) + '. ' + String(r.n).padEnd(8, ' ') + String(r.s).padStart(8) + '  F' + r.f + ' ' + (r.m || '')
                     + '</div>';
            });
        }
        html += '</div>';
        hb.innerHTML = html;
    }
}

// ================== [เฟส 3A] LOBBY ==================
function resetLobby() {
    lobby = { stage: "count", count: 1, picks: [], picker: 0, focus: 0 };
}
function renderLobby() {
    let cont = document.getElementById("lobby-container");
    let title = document.getElementById("lobby-title");
    let html = "";
    if (lobby.stage === "count") {
        title.innerHTML = "เลือกจำนวนผู้เล่น — <span style='color:#8fa3b8;'>เลื่อนด้วยปุ่มทิศทาง · ยืนยันด้วยปุ่มโจมตี/Enter · หรือคลิก</span>";
        let opts = [
            { n: 1, name: "👤 1 PLAYER", desc: touchMode ? "📱 โหมดสัมผัส — AUTO ล็อก ON" : "โหมดเดี่ยวคลาสสิก — เซฟกลางรันใช้ได้" }
        ];
        // [v32] มือถือล็อค 1 คน — ตัดสินจาก "จอสัมผัสจริง" ไม่ใช่ touchMode ล้วนๆ (เดิม: แตะเมนูก่อน refresh = co-op โผล่บนมือถือ)
        let isPhone = touchMode || (("ontouchstart" in window) && matchMedia("(pointer: coarse)").matches && window.innerWidth < 900);
        if (!isPhone) {
            opts.push({ n: 2, name: "👥 2 PLAYERS", desc: "CO-OP 2 คน — P1: WASD · P2: ลูกศร+J/K/L หรือจอย" });
            opts.push({ n: 3, name: "👥 3 PLAYERS", desc: "CO-OP 3 คน — แนะนำจอยอย่างน้อย 1 ตัว" });
            opts.push({ n: 4, name: "👥 4 PLAYERS", desc: "CO-OP เต็มทีม — แนะนำจอย 2 ตัวขึ้นไป" });
        }
        opts.forEach(o => {
            html += '<div class="upgrade-card" onclick="lobbySetCount(' + o.n + ')">'
                 + '<div class="up-name">' + o.name + '</div>'
                 + '<div class="up-desc">' + o.desc + '</div>'
                 + '</div>';
        });
    } else {
        let pi = lobby.picker;
        let col = PC_COLORS[pi] || "#00ffcc";
        title.innerHTML = '<span style="color:' + col + '; font-weight:bold;">P' + (pi + 1) + '</span> เลือกคลาส' + (lobby.count > 1 ? ' — ห้ามซ้ำกับที่เลือกไปแล้ว' : '') + ' (คลาสล็อก = ยืนยันเพื่อซื้อด้วย CORE)';
        let keys = Object.keys(WEAPONS).filter(k => lobby.picks.indexOf(k) < 0);
        keys.forEach(k => {
            let w = WEAPONS[k];
            let locked = (k === "LASER" && !metaUnlocks.laser) || (k === "DRONE" && !metaUnlocks.drone);
            let skill = CLASS_SKILLS[k];
            html += '<div class="upgrade-card' + (locked ? ' locked' : '') + '" onclick="lobbyPickClass(\'' + k + '\')">'
                 + '<div class="up-name">' + spriteHtml(k, CLASS_ICONS[k], 28) + ' ' + w.name + (locked ? ' 🔒' : '') + '</div>'
                 + '<div class="up-lv">HP ' + w.maxHp + ' | DMG ' + w.dmg + ' | SPD ' + w.speed + '</div>'
                 + '<div class="up-desc">' + w.desc + '</div>'
                 + '<div class="up-desc" style="color:#ffcc00;">สกิล [E]: ' + skill.name + ' — ' + skill.desc + '</div>'
                 + (locked ? '<div class="up-price">🔓 ปลดล็อก: 5 CORE (ยืนยันเพื่อซื้อ)</div>' : '')
                 + '</div>';
        });
    }
    cont.innerHTML = html;
    refreshStartNav();   // [มินิแพส-nav] นำทางรวมทั้งหน้า start (ปุ่ม + การ์ด)
}
function refreshStartNav() {   // [มินิแพส-nav] ทุกอย่างบนหน้า start เลื่อน-ยืนยันได้ไม่ต้องเมาส์
    let elems = [];
    let cont = document.querySelector("#continue-slot button");
    if (cont) elems.push(cont);
    let sb = document.getElementById("settings-open-btn");
    if (sb) elems.push(sb);
    document.querySelectorAll("#lobby-container .upgrade-card").forEach(el => elems.push(el));
    document.querySelectorAll("#meta-perks .meta-card").forEach(el => elems.push(el));
    setUiNavDom(elems, (lobby && lobby.stage === "class") ? lobby.picker : 0);
}
function lobbySetCount(n) {
    playSynthSFX("click");
    lobby.count = n;
    lobby.stage = "class";
    lobby.picker = 0;
    lobby.picks = [];
    lobby.focus = 0;
    renderLobby();
}
function lobbyPickClass(k) {
    let locked = (k === "LASER" && !metaUnlocks.laser) || (k === "DRONE" && !metaUnlocks.drone);
    if (locked) {
        if (cores >= 5) {
            cores -= 5;
            metaUnlocks[k.toLowerCase()] = true;
            saveMeta();
            playSynthSFX("levelup");
            renderLobby();
        } else {
            playSynthSFX("click");
        }
        return;
    }
    playSynthSFX("click");
    lobby.picks.push(k);
    if (lobby.picks.length >= lobby.count) {
        let types = lobby.picks.slice();
        resetLobby();
        startGame(types);
    } else {
        lobby.picker = 1;
        lobby.focus = 0;
        renderLobby();
    }
}

function buyPerk(id) {
    if (metaUnlocks[id]) return;
    let p = null;
    META_PERKS.forEach(x => { if (x.id === id) p = x; });
    if (!p) return;
    if (cores >= p.cost) {
        cores -= p.cost;
        metaUnlocks[id] = true;
        saveMeta();
        playSynthSFX("levelup");
        renderStartScreen();
    } else {
        playSynthSFX("click");
    }
}

// ================== เริ่มเกม / รีเซ็ต ==================
function startGame(types) {
    if (!Array.isArray(types)) types = [types];   // [เฟส 3A] รับ 1-2 คลาส
    for (let i = 0; i < types.length; i++) {
        let t = types[i];
        if ((t === "LASER" && !metaUnlocks.laser) || (t === "DRONE" && !metaUnlocks.drone)) return;
    }
    players = [];
    types.forEach(type => {
        let w = WEAPONS[type];
        players.push({
            weaponType: type, icon: CLASS_ICONS[type],
            x: 0, y: 0, angle: 0, size: 20,
            hp: w.maxHp, maxHp: w.maxHp,
            speed: w.speed, damage: w.dmg,
            bulletSize: w.bSize, bulletSpeed: w.bSpd,
            maxCooldown: w.delay, attackCooldown: 0,
            dashCooldown: 0, maxDashCooldown: 180, dashTimer: 0, dashVx: 0, dashVy: 0, isInvulnerable: false,
            hurtTimer: 0, shield: 0, magnetRadius: BAL.PLR.MAGNET_BASE,
            xp: 0, level: 1, xpNext: BAL.XP.BASE,
            swordArc: 120, swordArcLevel: 0, missileLevel: 0, mineLevel: 0,
            shardMineLevel: 0, stunShellsLevel: 0, incendiaryLevel: 0,
            turretLevel: 0, turretCd: 0,
            standLevel: 0, standDmgPct: 0,
            droneTarget: 0, droneCd: 0, titan: 0,
            vampLevel: 0, focusLevel: 0, chargedLance: 0, swarmLevel: 0,
            skillCd: 0, skillCdMax: CLASS_SKILLS[type].cd,
            usedRevive: false,
            pity: 0, dashCritTimer: 0,
            autoAtk: true, curses: [],
            levels: {},
            coins: 0,
            shopBuys: 0,
            magnetOff: false, maxHpDown: 0,
            face: 1, moving: false,
            healAccum: 0, healCapT: 1,
            berserkT: 0,                                      // [v16]
            burnT: 0, burnDps: 0, slowT: 0, slowPct: 0,       // [v17]
            buffs: { shield: 0, firerate: 0, dmg: 0, speed: 0 },   // ← บรรทัดที่เพิ่งคืน
            trail: [],
            gunShotCount: 0, shotgunCount: 0, laserShotCount: 0, swordSwingCount: 0
        });
    });
    player = players[0];
    pendingLevelUps = 0;
    levelPickers = null;   // [3B-1]
    shopRandomBought = false;
    runMods = freshMods();
    evolved = { sword: false, gun: false, shotgun: false, laser: false, drone: false };
    killStreak = 0; streakTimer = 0;
    droneOverdrive = 0;
    hitStopFrames = 0; shakeT = 0; shakeMag = 0;
    score = 0; currentFloor = 1; kills = 0;   // [3B-2] coins อยู่ใน player แล้ว
    runChal = freshRunChal();   // [v27] challenge รายรันเริ่มนับใหม่
    gameTime = 0; frameCount = 0; shotgunBlastSeq = 0;
    shatterQueue = [];
    toasts = [];
    isPaused = false; isShopping = false; isGameOver = false; isWarping = false;
    isPauseMenu = false; isBuildMenu = false;
    portalItemSpawned = false;
    // [v32] มือถือ (ตรวจจาก pointer coarse ตอนกดเริ่มเกม): ตรึง slot 0 = สัมผัสถาวร — ปุ่มจำลองโชว์ทันทีที่เข้าเกม
    if (("ontouchstart" in window) && matchMedia("(pointer: coarse)").matches) {
        touchMode = true;
        inputSlots[0].device = "touch";
        ["touchDash", "touchSkill", "touchPause"].forEach(id => {
            let el = document.getElementById(id);
            if (el) el.style.display = "flex";
        });
    }
    clearUiNav();
    recalcStats();
    ["start-screen", "upgrade-screen", "shop-screen", "mod-screen", "pause-screen", "build-screen", "gameover-screen"].forEach(id => document.getElementById(id).classList.add("hidden"));
    setupStage();
    startMusic();   // [เฟส A4]
    particles.push({ type: "text", x: player.x, y: player.y - 40, text: "FLOOR 1" + (players.length > 1 ? " — CO-OP ×" + players.length : ""), life: 90, maxLife: 90, color: "#00ffcc", vy: -0.4 });
    if (players.length > 1) announce("👥 CO-OP: EXP แชร์ · ตายรอชุบตอนขึ้นชั้น · ตายหมดทั้งทีม = จบ", "#00ffcc");
    playSynthSFX("click");
}

function resetGame() {
    document.getElementById("gameover-screen").classList.add("hidden");
    document.getElementById("mod-screen").classList.add("hidden");
    document.getElementById("pause-screen").classList.add("hidden");
    document.getElementById("build-screen").classList.add("hidden");
    document.getElementById("start-screen").classList.remove("hidden");
    isGameOver = false; isShopping = false; isPaused = false; isWarping = false;
    isPauseMenu = false; isBuildMenu = false;
    pendingLevelUps = 0;
    player = null;
    players = [];
    resetLobby();
    clearUiNav();
    stopMusic();   // [เฟส A4]
    enemies = []; items = []; mines = []; particles = [];
    deployables = [];
    arenas = [];
    shatterQueue = [];
    toasts = [];
    playerProjectiles = []; enemyProjectiles = []; spawners = [];
    renderStartScreen();
    startMusic();   // [v19] stopMusic ไปแล้วตอนต้น resetGame — เปิดเพลงเมนูคืน
}

// ================== เริ่มระบบ ==================
loadMeta();
loadSettings();   // [แก้] โหลดค่าเสียงที่เซฟไว้
resizeGame();   // [v31] มุมมองตามจอจริงก่อนเฟรมแรก
window.addEventListener("resize", resizeGame);   // [v31] ย่อ/ขยายหน้าต่าง
window.addEventListener("orientationchange", () => setTimeout(resizeGame, 150));   // [v31] หมุนจอ — รอ OS จัด layout เสร็จค่อยวัด
renderStartScreen();
startMusic();   // [v19] เพลงหน้าเมนู — เบราว์เซอร์อาจเพิกเฉยจนกว่าจะมี interaction แรก (มี kick ด้านล่างรองรับ)

// [v19] Autoplay policy: เสียงเริ่มได้หลังแตะ/กดครั้งแรก — เตะให้เพลงเล่นที่จังหวะนั้น (ครั้งเดียวแล้วถอด listener ทิ้ง)
function musicAutoplayKick() {
    unlockMobileAudio();   // [v35] เตะให้มือถือเริ่มโหลด/ปลดล็อกเสียง แล้ว startMusic ซ้ำเมื่อพร้อม
    startMusic();
    document.removeEventListener("mousedown", musicAutoplayKick);
    document.removeEventListener("keydown", musicAutoplayKick);
    document.removeEventListener("touchstart", musicAutoplayKick);
}
document.addEventListener("mousedown", musicAutoplayKick);
document.addEventListener("keydown", musicAutoplayKick);
document.addEventListener("touchstart", musicAutoplayKick);

loopRunning = true;
requestAnimationFrame(gameLoop);
