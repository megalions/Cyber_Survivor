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

    let ahtml = "";
    ACHIEVEMENTS.forEach(a => {
        ahtml += '<span class="ach' + (achievements[a.id] ? ' done' : '') + '">' + (achievements[a.id] ? "✔" : "▫") + " " + a.name + " — " + a.desc + '</span>';
    });
    document.getElementById("ach-list").innerHTML = ahtml;

    document.getElementById("run-stats").innerHTML = "สถิติรวม: เล่น " + stats.runs + " รัน | ชั้นสูงสุด " + stats.bestFloor +
        " | คะแนนสูงสุด " + stats.bestScore + " | กำจัด " + stats.kills + " ตัว | บอส " + stats.bosses + " ตัว | คริ " + (stats.crits || 0) + " ครั้ง | ดีลปีศาจ " + stats.deals + " ครั้ง | วิวัฒนาการ " + stats.evolutions + " ครั้ง";
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
        if (!touchMode) {
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
            hurtTimer: 0, shield: 0, magnetRadius: BAL.PLR.MAGNET_BASE,   // [v9-5] ตาม BAL (80) — เดิม hardcode 60 แต้ recalcStats ทับให้อยู่แล้ว แก้เพื่อความสม่ำเสมอ
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
            levels: {},          // [3B-1] อัพเกรดรายคน
            coins: 0,            // [3B-2] กระเป๋าแยกรายคน
            shopBuys: 0,         // [3B-3fix] ราคาร้านรายคน
            magnetOff: false, maxHpDown: 0,   // [3B-3] Curse ส่วนตัวรายคน
            face: 1, moving: false,   // [มินิแพส] เริ่มหันซ้าย + สถานะเดิน (ใช้กับ bob)
            healAccum: 0, healCapT: 1,
            buffs: { shield: 0, firerate: 0, dmg: 0, speed: 0 },
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
    gameTime = 0; frameCount = 0; shotgunBlastSeq = 0;
    shatterQueue = [];
    toasts = [];
    isPaused = false; isShopping = false; isGameOver = false; isWarping = false;
    isPauseMenu = false; isBuildMenu = false;
    portalItemSpawned = false;
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
}

// ================== เริ่มระบบ ==================
loadMeta();
loadSettings();   // [แก้] โหลดค่าเสียงที่เซฟไว้
renderStartScreen();
loopRunning = true;
requestAnimationFrame(gameLoop);
