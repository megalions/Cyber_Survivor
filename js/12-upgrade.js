"use strict";

// ================== สถิติผู้เล่น ==================
function recalcStats() {
    if (!player) return;
    players.forEach(pl => {
        // [v24] เยียวยา field ที่อาจหาย (เซฟเก่า/แพตช์คร่อม) ก่อนอ่าน — กัน "reading 'firerate'" ทำเกมดับกลาง startGame
        if (!pl.buffs) pl.buffs = { shield: 0, firerate: 0, dmg: 0, speed: 0 };
        if (!pl.levels) pl.levels = {};
        if (pl.berserkT === undefined) pl.berserkT = 0;
        if (pl.burnT === undefined) { pl.burnT = 0; pl.burnDps = 0; }
        if (pl.slowT === undefined) { pl.slowT = 0; pl.slowPct = 0; }
        if (!pl.trail) pl.trail = [];
        if (!pl.curses) pl.curses = [];
        let L = pl.levels;
        let w = WEAPONS[pl.weaponType];
        let b = pl.buffs;
        let brk = (pl.berserkT > 0) ? 1 : 0;   // [v16] Berserk: +1 ทุกอัพเกรดทั่วไป — สูตรไม่จำกัดเพดานเลเวล จึงเกินแคปได้อัตโนมัติ
        // [v29] บัฟดรอปออกจากระบบเลเวล — บวกตรงตาม BAL.PLR.BUFF_* (เดิมแอบ = +2 เลเวล: ทำให้ Berserk/เพดานหลอนและข้อความโกหก)
        let frLv = (L.FIRERATE || 0) + brk;
        let dmLv = (L.DMG || 0) + brk;
        let spLv = (L.SPEED || 0) + brk;

        // General upgrades (6 ชนิด)
        pl.maxCooldown = Math.max(5, Math.ceil(w.delay * (1 - 0.08 * frLv - (b.firerate > 0 ? BAL.PLR.BUFF_FR_PCT : 0))));   // [v29] บัฟ ⏩ ลด CD ตรง
        pl.damage = Math.round((w.dmg + BAL.CLS.DMG_FLAT * dmLv + runMods.bonusDmg + (b.dmg > 0 ? BAL.PLR.BUFF_DMG_FLAT : 0)) * (1 + BAL.CLS.DMG_PCT * dmLv));   // [v9-3+v29] บัฟ 💥 +แบนตรง
        pl.speed = w.speed * (1 + 0.25 * spLv + (b.speed > 0 ? BAL.PLR.BUFF_SPD_PCT : 0));   // [v29] บัฟ 👟 +% ตรง
        pl.maxDashCooldown = Math.max(30, Math.round(180 * (1 - 0.10 * spLv - (b.speed > 0 ? BAL.PLR.BUFF_SPD_PCT * 0.4 : 0))));   // [v29] บัฟ 👟 ช่วย CD แดชเล็กน้อยตามสัดส่วน (คงจิตวิทยาเดิมที่บัฟเร็ว = แด่นขึ้นด้วย)
        if (pl.dashCooldown > pl.maxDashCooldown) pl.dashCooldown = pl.maxDashCooldown;
        pl.maxHp = Math.max(30, w.maxHp + (20 + 2 * (currentFloor - 1)) * ((L.MAX_HP || 0) + brk) - (runMods.maxHpDown + (pl.maxHpDown || 0)));   // [v16]
        pl.magnetRadius = BAL.PLR.MAGNET_BASE;
        pl.vampLevel = (L.VAMPIRE || 0) + brk;   // [v16] Berserk ให้ VAMPIRE แม้ไม่เคยอัพ (ดาบ = 0.5 HP/ฟันเพิ่ม)
        pl.skillCdMax = Math.max(2, Math.round(CLASS_SKILLS[pl.weaponType].cd * (1 - BAL.CLS.FIRERATE_SKILL_CD * frLv)));

        // CLASS + EXTRA: auto-activate ที่เลเวล 5/10/15 (ไม่ใช้การ์ด)
        let clsLv = pl.level >= 15 ? 3 : pl.level >= 10 ? 2 : pl.level >= 5 ? 1 : 0;
        let cls = pl.weaponType;

        pl.swordArcLevel = (cls === "SWORD" ? clsLv : 0);
        pl.swordArc = 120 + pl.swordArcLevel * 30;
        pl.missileLevel = (cls === "GUN" ? clsLv : 0);
        pl.mineLevel = (cls === "SHOTGUN" ? clsLv : 0);
        pl.incendiaryLevel = ((cls === "GUN" || cls === "LASER") ? clsLv : 0);
        pl.stunShellsLevel = (cls === "SHOTGUN" ? clsLv : 0);
        pl.shardMineLevel = (cls === "SHOTGUN" ? Math.min(clsLv, 1) : 0);
        pl.turretLevel = (cls === "GUN" ? clsLv : 0);
        pl.standLevel = (cls === "SWORD" ? clsLv : 0);
        pl.standDmgPct = 0.1 * pl.standLevel;
        pl.focusLevel = (cls === "LASER" ? clsLv : 0);
        pl.chargedLance = (cls === "LASER" ? clsLv : 0);
        pl.swarmLevel = (cls === "DRONE" ? clsLv : 0);
        pl.titan = (cls === "DRONE" ? Math.min(clsLv, 1) : 0);
        pl.droneTarget = (cls === "DRONE" && evolved.drone) ? 5 : (cls === "DRONE" ? 1 : 0) + pl.swarmLevel;
        pl.ricochetLevel = Math.min(clsLv, 1);   // RICOCHET: 1 เลเวลเดียว

        if (pl.hp > pl.maxHp) pl.hp = pl.maxHp;
    });
}

// ================== อัพเกรด + วิวัฒนาการ ==================
function isUpgradeMaxed(pl, upg) { pl = pl || player; return ((pl.levels[upg.id]) || 0) >= upg.maxLevel; }
function upgradeLevelText(pl, upg) {
    pl = pl || player;
    let lv = pl.levels[upg.id] || 0;
    if (upg.maxLevel === Infinity) return "Lv." + lv;
    return "Lv." + lv + "/" + upg.maxLevel;
}
// [แพตช์ระบบอัพ] EXTRA ต้องมี CLASS เท่ากับเลเวลถัดไปก่อน (เช่น STAND 2 ต้อง SPEC_SWORD ≥ 2)
function extraPrereqId(extraId, weaponType) {
    if (weaponType === "SWORD") return "SPEC_SWORD";
    if (weaponType === "GUN") return "SPEC_GUN";
    if (weaponType === "SHOTGUN") return "SPEC_SHOTGUN";
    if (weaponType === "LASER") return "CHARGED_LANCE";
    if (weaponType === "DRONE") return "SWARM";
    return null;
}
function isExtraAvailable(u, pl) {
    // [แก้บั๊ก] กรองเฉพาะ EXTRA_CLASS_UPGRADES เท่านั้น — GENERAL และ CLASS ผ่านเสมอ
    let extras = EXTRA_CLASS_UPGRADES[pl.weaponType] || [];
    let isExtra = false;
    for (let i = 0; i < extras.length; i++) { if (extras[i].id === u.id) { isExtra = true; break; } }
    if (!isExtra) return true;   // GENERAL หรือ CLASS → ไม่มีเงื่อนไข

    let prereq = extraPrereqId(u.id, pl.weaponType);
    if (!prereq) return true;
    let nextLv = (pl.levels[u.id] || 0) + 1;
    let classLv = pl.levels[prereq] || 0;
    return classLv >= nextLv;
}
function getUpgradePool(pl) {
    pl = pl || player;
    let pool = GENERAL_UPGRADES.slice();
    return pool.filter(u => !isUpgradeMaxed(pl, u));
}

function getTeamPool() {
    let seen = {}, pool = [];
    players.forEach(pl => {
        getUpgradePool(pl).forEach(u => {
            if (seen[u.id]) return;
            seen[u.id] = true;
            pool.push(u);
        });
    });
    return pool;
}
function isGeneralUpgrade(id) {
    for (let i = 0; i < GENERAL_UPGRADES.length; i++) if (GENERAL_UPGRADES[i].id === id) return true;
    return false;
}
function upgradeMatchesPlayer(id, pl) {
    if (CLASS_UPGRADES[pl.weaponType] && CLASS_UPGRADES[pl.weaponType].id === id) return true;
    let ex = EXTRA_CLASS_UPGRADES[pl.weaponType] || [];
    for (let i = 0; i < ex.length; i++) if (ex[i].id === id) return true;
    return false;
}
function teamUpgradeLevel(id) {
    let mx = 0;
    players.forEach(pl => { mx = Math.max(mx, pl.levels[id] || 0); });
    return mx;
}

function findUpgradeById(id) {
    let all = GENERAL_UPGRADES.slice();
    players.forEach(pl => {
        all.push(CLASS_UPGRADES[pl.weaponType]);
        (EXTRA_CLASS_UPGRADES[pl.weaponType] || []).forEach(u => all.push(u));
    });
    for (let i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
}
function checkEvolution() {
    let did = false;
    players.forEach((pl, pi) => {
        let tag = players.length > 1 ? " (P" + (pi + 1) + ")" : "";
        let w = pl.weaponType;
        if (!evolved.sword && w === "SWORD" && pl.level >= 15) {   // [แก้] ≥3 (เดิม ≥5)
            evolved.sword = true;
            announce("⚔ ZERO BLADE EVOLVED" + tag, "#7df9ff");
            toasts.push({ title: "⚔ ZERO BLADE" + tag, sub: "ทุก 4 ครั้งที่ฟัน ปล่อยโนวาแช่แข็ง", life: 200, maxLife: 200 });
            did = true;
        }
        if (!evolved.gun && w === "GUN" && pl.level >= 15) {   // เดิม SPEC_GUN >= 3
            evolved.gun = true;
            announce("🚀 OMEGA RIFLE EVOLVED" + tag, "#ff5577");
                        toasts.push({ title: "🚀 OMEGA RIFLE" + tag, sub: "มิสไซล์ออกทุก " + BAL.CLS.MISSILE_EVO_EVERY + " นัด + เพิ่มจำนวน", life: 200, maxLife: 200 });   // [v12-2] อ่านจาก BAL — เดิม hardcode "2" ขัดกับค่าจริง 4
            did = true;
        }
        if (!evolved.shotgun && w === "SHOTGUN" && pl.level >= 15) {   // เดิม SPEC_SHOTGUN >= 3
            evolved.shotgun = true;
            announce("💥 SUPERNOVA BUCKSHOT EVOLVED" + tag, "#8be9fd");
            toasts.push({ title: "💥 SUPERNOVA BUCKSHOT" + tag, sub: "ทุก 4 ยิง กระจาย 12 เม็ดรอบตัว 360° ดาเมจ 60%", life: 200, maxLife: 200 });
            did = true;
        }
        if (!evolved.laser && w === "LASER" && pl.level >= 15) {   // เดิม CHARGED_LANCE >= 3
            evolved.laser = true;
            announce("🌌 SINGULARITY LANCE EVOLVED" + tag, "#7df9ff");
            toasts.push({ title: "🌌 SINGULARITY LANCE" + tag, sub: "ลำแสงดูดศัตรูเข้าหาจุดกระทบ", life: 200, maxLife: 200 });
            did = true;
        }
        if (!evolved.drone && w === "DRONE" && pl.level >= 15) {   // เดิม SWARM >= 3
            evolved.drone = true;
            announce("🐝 HIVE MIND EVOLVED" + tag, "#ffd23d");
            toasts.push({ title: "🐝 HIVE MIND" + tag, sub: "โดรนแม่ผึ้ง 45% + ลูกน้อง 4 ลำ", life: 200, maxLife: 200 });
            did = true;
        }
    });
    if (did) {
        stats.evolutions++;
        unlockRunChal("evolved");   // [v27]
        playSynthSFX("levelup");
        recalcStats();
    }
}
function applyUpgrade(pl, id) {   // [3B-1] อัพเกรดรายคน
    pl = pl || player;
    let u = findUpgradeById(id);
    if (u && (pl.levels[id] || 0) >= u.maxLevel) return;   // กันเกินแม็กซ์ (ร้าน/ดีล)
    pl.levels[id] = (pl.levels[id] || 0) + 1;
    recalcStats();
    if (id === "MAX_HP") pl.hp = pl.maxHp;   // ฟื้นเฉพาะคนที่เลือก
    if (id === "GUN_TURRET") pl.turretCd = 0;
    if (id === "SWARM") pl.droneCd = 0;
    checkEvolution();
}

// ================== Level-up ==================
function checkXp() {
    if (!player || isGameOver) return;
    let leveled = false;
    while (player.xp >= player.xpNext) {
        player.xp -= player.xpNext;
        player.level++;
        player.xpNext = Math.floor(player.xpNext * BAL.XP.GROWTH) + BAL.XP.BONUS;
        players.forEach(pl => { if (pl !== player) { pl.level = player.level; pl.xpNext = player.xpNext; pl.xp = player.xp; } });
        // [ปรับระบบ] milestone 5/10/15 = CLASS skill auto-activate
        if (player.level === 5 || player.level === 10 || player.level === 15) {
            recalcStats();
            checkEvolution();
            let clsLv = player.level / 5;
            let clsName = CLASS_UPGRADES[player.weaponType].name;
            toasts.push({ title: "⬆ " + clsName + " Lv." + clsLv, sub: "AUTO-ACTIVATED at Level " + player.level, life: 200, maxLife: 200 });
            playSynthSFX("levelup");
        }
        pendingLevelUps++;
        leveled = true;
    }
    if (leveled && !isPaused && !isShopping && !isWarping) openLevelUp();
}

// ================== [เฟส 3B-1] LEVEL-UP รายคน: หยุดเกมรอทุกคน + จับเวลา 10 วิ ==================
const LEVELUP_SECONDS = BAL.XP.LEVELUP_SECONDS;
function openLevelUp() {
    if (!player || isGameOver || levelPickers) return;
    levelPickers = [];
    players.forEach((pl, i) => {
                // [v9-1] pool = GENERAL 6 การ์ดล้วน — สกิลคลาส/EXTRA auto-activate ที่ 5/10/15 ใน recalcStats แล้ว
        //        (การ์ดคลาสใน level-up เป็น "การ์ดหลอก" หลังระบบ auto มา — เลือกแล้วไม่เกิดผล)
        let pool = getUpgradePool(pl).slice().sort(() => Math.random() - 0.5).slice(0, 3);

        levelPickers.push({ slot: i, pl: pl, choices: pool, index: 0, done: pool.length === 0,
                            prevMX: 0, prevBL: false, prevBR: false, prevAtk: false });
    });
    if (levelPickers.every(p => p.done)) {   // ทุกคนอัพครบ = ข้าม
        levelPickers = null;
        pendingLevelUps = Math.max(0, pendingLevelUps - 1);
        if (pendingLevelUps > 0) openLevelUp();
        return;
    }
    isPaused = true;
    levelUpTimer = LEVELUP_SECONDS * 60;
    renderLevelUp();
    document.getElementById("upgrade-screen").classList.remove("hidden");
    playSynthSFX("levelup");
}
function renderLevelUp() {
    if (!levelPickers) return;
    let html = "";
    levelPickers.forEach((pk, i) => {
        let col = PC_COLORS[i] || "#00ffcc";
        html += '<div style="margin-bottom:12px;">'
             + '<div style="color:' + col + '; font-weight:bold; font-size:14px; margin-bottom:4px;">'
             + 'P' + (i + 1) + ' — ' + WEAPONS[pk.pl.weaponType].name
             + (pk.done ? ' ✔ เลือกแล้ว' : '') + '</div>';
        html += '<div class="card-row">';
        pk.choices.forEach((u, ci) => {
            let focus = (!pk.done && pk.index === ci);
            html += '<div class="upgrade-card" style="' + (focus ? "border-color:" + col + "; box-shadow:0 0 10px " + col + "55;" : "") + '" onclick="levelPickCard(' + i + ', ' + ci + ')">'
                 + '<div class="up-name">' + u.name + '</div>'
                 + '<div class="up-lv">' + upgradeLevelText(pk.pl, u) + '</div>'
                 + '<div class="up-desc">' + u.desc + '</div>'
                 + '</div>';
        });
        if (pk.choices.length === 0) html += '<div class="sub">— อัพเกรดครบทุกอย่างแล้ว ข้ามรอบนี้ —</div>';
        html += '</div></div>';
    });
    document.getElementById("upgrade-players").innerHTML = html;
    updateLevelUpTimerText();
}
function updateLevelUpTimerText() {
    let t = document.getElementById("upgrade-sub");
    if (t) t.textContent = "ทุกคนเลือกการ์ดของตัวเอง (ปุ่มทิศทางเลื่อน + ปุ่มโจมตียืนยัน หรือคลิก) — หมดเวลาใน " + Math.ceil(levelUpTimer / 60) + " วิ · ไม่เลือก = ยืนยันการ์ดที่เลือกอยู่";
}
function tickLevelUp() {   // เรียกจาก gameLoop ทุกเฟรม — เดินแม้เกมพัก
    if (!levelPickers) return;
    levelUpTimer--;
    updateLevelUpTimerText();
    if (levelUpTimer <= 0) {
        levelPickers.forEach((pk, i) => {
            if (!pk.done && pk.choices.length > 0) levelPickCard(i, pk.index, true);   // [แก้สัญญา] หมดเวลา = ยืนยันการ์ดที่เลือกอยู่ ไม่สุ่ม
        });
    }
}
function levelMove(pi, dir) {
    if (!levelPickers) return;
    let pk = levelPickers[pi];
    if (!pk || pk.done || pk.choices.length === 0) return;
    pk.index = (pk.index + dir + pk.choices.length) % pk.choices.length;
    playSynthSFX("click");
    renderLevelUp();
}
function levelPickCard(i, ci, force) {
    if (!levelPickers) return;
    let pk = levelPickers[i];
    if (!pk || pk.done) return;
    let u = pk.choices[ci];
    if (!u) return;
    pk.done = true;
    applyUpgrade(pk.pl, u.id);
    playSynthSFX(force ? "levelup" : "click");
    if (levelPickers && levelPickers.every(p => p.done)) finishLevelUp();
    else renderLevelUp();
}
function finishLevelUp() {
    levelPickers = null;
    document.getElementById("upgrade-screen").classList.add("hidden");
    isPaused = false;
    pendingLevelUps = Math.max(0, pendingLevelUps - 1);
    if (pendingLevelUps > 0) openLevelUp();
}

// ================== บอส / ประตู WARP ==================
function allBossesKilled() { return spawners.length > 0 && spawners.every(sp => sp.bossKilled); }
function startWarp() {
    if (floorClean) unlockRunChal("untouched");   // [v27]
    isWarping = true;
    warpTimer = WARP_DURATION;
    warpStars = [];
    for (let i = 0; i < 90; i++) warpStars.push({ a: Math.random() * Math.PI * 2, d: Math.random() * 480, spd: 5 + Math.random() * 9 });
    playSynthSFX("warp");
}

// ================== BLACK MARKET ==================
function getShopPrice(pl) {
    pl = pl || player;
    return Math.floor(BAL.ECO.SHOP_BASE * Math.pow(BAL.ECO.SHOP_MULT, pl.shopBuys || 0));
}
function openShopScreen() {
    isShopping = true;
    shopRandomBought = false;
    shopPickers = null;   // [3B-2] เคอร์เซอร์ร้านชุดใหม่ทุกครั้ง
    let fb = document.getElementById("shop-feedback");
    fb.textContent = "";
    fb.style.color = "#8fa3b8";
    document.getElementById("shop-screen").classList.remove("hidden");
    renderShop();
}
function renderShop() {
    let wt = document.getElementById("shop-user-pts");
    wt.innerHTML = players.map((pl, i) =>
        '<span style="color:' + (PC_COLORS[i] || "#ffd700") + '; font-weight:bold;">P' + (i + 1) + ' 💰' + Math.floor(pl.coins) + '</span>'
    ).join("  ·  ") + '   |  ราคาแยกรายคน (แพงขึ้นตามจำนวนครั้งที่ตัวเองซื้อ)';

    shopCards = [];
    // [v30] ตัด RANDOM MODULE ออกจากร้านตามดีไซน์ใหม่ — shopRandomBought/shopPickers ยังทำงานเหมือนเดิม (slot ลบ 1 อัตโนมัติ)
    getTeamPool().forEach(u => shopCards.push({ id: u.id, upg: u }));
    if (!shopPickers) {
        shopPickers = [];
        players.forEach((pl, i) => shopPickers.push({ slot: i, index: 0, prevMX: 0, prevBL: false, prevBR: false, prevAtk: false }));
    }
    shopPickers.forEach(pk => { if (pk.index > shopCards.length) pk.index = shopCards.length; });   // [มินิแพส-nav] ยอมให้ชี้ปุ่มออก

    let priceTxt = players.map((pl, i) =>
        '<span style="color:' + (PC_COLORS[i] || "#ffd700") + ';">P' + (i + 1) + " " + getShopPrice(pl) + "</span>"
    ).join(" · ");

    let html = "";
    shopCards.forEach((card, ci) => {
        let tags = "", borderCol = "";
        shopPickers.forEach((pk, i) => {
            if (pk.index === ci) {
                tags += '<span style="color:' + (PC_COLORS[i] || "#00ffcc") + '; font-weight:bold;">P' + (i + 1) + '</span> ';
                if (!borderCol) borderCol = PC_COLORS[i] || "#00ffcc";
            }
        });
        let style = borderCol ? "border-color:" + borderCol + "; box-shadow:0 0 10px " + borderCol + "55;" : "";
        {   // [v30] RANDOM ถูกตัดออก — เหลือเฉพาะการ์ดอัพเกรดจริง (คงปีกกา else เดิมเป็นบล็อกเดียว)
            let u = card.upg;
            // [แก้] EXTRA ที่ P1 ยังไม่มี prereq = โชว์ 🔒
            let lockTag = "";
            if (!isGeneralUpgrade(u.id)) {
                let chk = players[0] || player;
                let nextLv = (chk.levels[u.id] || 0) + 1;
                if (chk.level < nextLv * 5) lockTag = " 🔒Lv." + (nextLv * 5);
                else if (upgradeMatchesPlayer(u.id, chk) && !isExtraAvailable(u, chk)) lockTag = " 🔒";
            }
            html += '<div class="upgrade-card" style="' + style + '" onclick="shopBuyCard(0, ' + ci + ')">'
                 + '<div class="up-name">' + u.name + lockTag + (tags ? " · " + tags : "") + '</div>'
                 + '<div class="up-lv">ทีม Lv.' + teamUpgradeLevel(u.id) + (u.maxLevel === Infinity ? "" : "/" + u.maxLevel) + '</div>'
                 + '<div class="up-desc">' + u.desc + '</div>'
                 + '<div class="up-price">' + priceTxt + ' COINS</div>'
                 + '</div>';
				 }
				 
    });
    if (shopCards.length === 0) html += '<div class="sub">— อัพเกรดหมดสต็อกแล้ว —</div>';
    document.getElementById("shop-cards-container").innerHTML = html;
    let leaveBtn = document.getElementById("shop-leave-btn");   // [มินิแพส-nav] ไฮไลต์ปุ่มออก (ทอง)
    if (leaveBtn) {
        if (shopPickers.some(pk => pk.index >= shopCards.length)) {
            leaveBtn.style.borderColor = "#ffd700";
            leaveBtn.style.boxShadow = "0 0 14px #ffd700, inset 0 0 10px #ffd70040";
        } else {
            leaveBtn.style.borderColor = "";
            leaveBtn.style.boxShadow = "";
        }
    }
}
function shopBuyCard(pi, ci) {   // [3B-2] ร้านรายคน: ใครยืนยัน = ใครจ่าย + อัพติดคนนั้น
    let buyer = players[pi];
    if (!buyer) return;
    if (ci >= shopCards.length) { showModScreen(); return; }   // [มินิแพส-nav] ช่องสุดท้าย = ออกร้าน
    if (!shopCards[ci]) return;
    let card = shopCards[ci];
    let feedback = document.getElementById("shop-feedback");
    let price = getShopPrice(buyer);   // [3B-3fix] ราคาของคนซื้อ
    let tag = "P" + (pi + 1);

    let upg = card.upg;   // [v30] บล็อคซื้อ RANDOM ถูกตัดออก — ทุกการ์ดในร้านเป็นอัพเกรดจริง
    if (!upg) return;
    if (!isGeneralUpgrade(upg.id) && !upgradeMatchesPlayer(upg.id, buyer)) {
        feedback.textContent = "⚠ " + tag + " ใช้การ์ดนี้ไม่ได้ (อาชีพไม่ตรง)";
        feedback.style.color = "#ff5577";
        playSynthSFX("click");
        return;
    }
    // [แก้] ร้าน: เช็คเลเวลผู้เล่น + prereq ก่อนซื้อ CLASS/EXTRA
    {
        let isClass = CLASS_UPGRADES[buyer.weaponType] && CLASS_UPGRADES[buyer.weaponType].id === upg.id;
        let extras = EXTRA_CLASS_UPGRADES[buyer.weaponType] || [];
        let isExtra = false;
        for (let i = 0; i < extras.length; i++) { if (extras[i].id === upg.id) { isExtra = true; break; } }
        if (isClass || isExtra) {
            let nextLv = (buyer.levels[upg.id] || 0) + 1;
            let gate = nextLv * BAL.CLS.GATE;
            if (buyer.level < gate) {
                feedback.textContent = "⚠ " + tag + " ต้อง Player Level " + gate + "+ ถึงอัพ Lv." + nextLv + " ได้";
                feedback.style.color = "#ff5577";
                playSynthSFX("click");
                return;
            }
            if (isExtra && !isExtraAvailable(upg, buyer)) {
                let prereq = extraPrereqId(upg.id, buyer.weaponType);
                let pu = findUpgradeById(prereq);
                feedback.textContent = "⚠ " + tag + " ต้อง " + (pu ? pu.name : "อัพคลาส") + " Lv." + nextLv + " ก่อน";
                feedback.style.color = "#ff5577";
                playSynthSFX("click");
                return;
            }
        }
    }
    if (!isExtraAvailable(upg, buyer)) {   // [แก้] ร้านต้องเช็ค prereq ด้วย — กันซื้อ EXTRA ก่อนอัพ CLASS
        let prereq = extraPrereqId(upg.id, buyer.weaponType);
        let need = (buyer.levels[upg.id] || 0) + 1;
        feedback.textContent = "⚠ " + tag + " ต้องอัพ " + (findUpgradeById(prereq) ? findUpgradeById(prereq).name : prereq) + " Lv." + need + " ก่อน";
        feedback.style.color = "#ff5577";
        playSynthSFX("click");
        return;
    }
    if ((buyer.levels[upg.id] || 0) >= upg.maxLevel) {
        feedback.textContent = "⚠ " + tag + " อัพเกรดนี้เต็มแล้ว";
        feedback.style.color = "#ff5577";
        playSynthSFX("click");
        return;
    }
    if (buyer.coins < price) {
        feedback.textContent = "⚠ เหรียญ " + tag + " ไม่พอ (ต้องการ " + price + ")";
        feedback.style.color = "#ff5577";
        playSynthSFX("click");
        return;
    }
    buyer.coins -= price;
    buyer.shopBuys = (buyer.shopBuys || 0) + 1;   // [3B-3fix] นับของคนซื้อ
    applyUpgrade(buyer, upg.id);
    playSynthSFX("levelup");
    feedback.style.color = "#00ffcc";
    feedback.textContent = "✔ " + tag + " ติดตั้ง: " + upg.name + " → Lv." + (buyer.levels[upg.id] || 0) + (upg.maxLevel === Infinity ? "" : "/" + upg.maxLevel);
    renderShop();
}
function shopMove(pi, dir) {   // [3B-2] เลื่อนเคอร์เซอร์ร้านรายผู้เล่น
    if (!shopPickers || !shopCards.length) return;
    let pk = shopPickers[pi];
    if (!pk) return;
    pk.index = (pk.index + dir + shopCards.length + 1) % (shopCards.length + 1);   // [มินิแพส-nav] +1 ช่องสุดท้าย = ปุ่มออก
    playSynthSFX("click");
    renderShop();
}

// ================== FLOOR PROTOCOL ==================
function showModScreen() {
    document.getElementById("shop-screen").classList.add("hidden");
    shopPickers = null;   // [แก้บั๊ก] ปิดเคอร์เซอร์ร้าน — ไม่งั้นปุ่มทิศทางถูกดัก การ์ด mod เลยไม่ขยับ
    // [แก้บั๊ก] คง isShopping = true ต่อไป: เกมหยุดระหว่างเลือก mod (เดิมเกมเดินอยู่หลังเมนู!)
    // ปิดท้ายโดย closeShopAndWarp ซึ่งตั้ง isShopping = false ให้แล้ว
    pendingMods = FLOOR_MODS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    let html = "";
    pendingMods.forEach((m, i) => {
        html += '<div class="upgrade-card" onclick="chooseMod(' + i + ')">'
             + '<div class="up-name">' + m.name + '</div>'
             + '<div class="up-lv">FLOOR ' + (currentFloor + 1) + ' PROTOCOL</div>'
             + '<div class="up-desc">' + m.desc + '</div>'
             + '</div>';
    });
    document.getElementById("mod-cards-container").innerHTML = html;
    document.getElementById("mod-screen").classList.remove("hidden");
    let mnav = [];   // [มินิแพส-nav] เลือก mod ด้วยปุ่มได้
    document.querySelectorAll("#mod-cards-container .upgrade-card").forEach(el => mnav.push(el));
    setUiNavDom(mnav, 0);
}
function chooseMod(i) {
    let m = pendingMods[i];
    if (m) {
        m.apply(runMods);
        runMods.list.push(m.short);
    }
    playSynthSFX("click");
    document.getElementById("mod-screen").classList.add("hidden");
    closeShopAndWarp();
}
function closeShopAndWarp() {
    document.getElementById("shop-screen").classList.add("hidden");
    document.getElementById("mod-screen").classList.add("hidden");
    isShopping = false;
    shopPickers = null;   // [3B-2] ปิดเคอร์เซอร์ร้าน
    clearUiNav();         // [มินิแพส-nav]
    currentFloor++;
    if (currentFloor > stats.bestFloor) stats.bestFloor = currentFloor;
    if (currentFloor >= 10) unlockRunChal("deep_diver");   // [v27]
    if (currentFloor >= 20) unlockRunChal("deep_20");   // [v28]
    if (currentFloor >= 30) unlockRunChal("deep_30");   // [v28]
    if (currentFloor >= 40) unlockRunChal("deep_40");   // [v28]
    saveMeta();
    recalcStats();          // [รอบ 2] ARMOR/หัวใจ scale ตามชั้น — คิดสถิติใหม่ทุกขึ้นชั้น
    players.forEach((pl, i) => {   // [เฟส 3A] ฟื้นทุกคน + ชุบคนที่ล้ม
        if (pl.hp <= 0 && players.length > 1) announce("✚ P" + (i + 1) + " REVIVED", "#3dff8c");
        pl.hp = pl.maxHp;
        pl.ghostDmg = 0;   // [3C] เคลียร์โหมดผี
    });
    setupStage();
    playSynthSFX("warp");
    particles.push({ type: "text", x: player.x, y: player.y - 40, text: "FLOOR " + currentFloor + " · " + getTheme().name, life: 80, maxLife: 80, color: "#00ffcc", vy: -0.4 });
    if (currentFloor % 10 === 0) announce("☠ DEVIL CORE FLOOR — บอสโคลนบิลด์คุณ ☠", "#ff00aa");
    else if (currentFloor % 5 === 0) announce("⚠ OVERLORD FLOOR ⚠", "#ff5577");
    if (runMods.list.length > 0) {
        let mc = {};
        runMods.list.forEach(m => { mc[m] = (mc[m] || 0) + 1; });
        announce("MODS: " + Object.keys(mc).map(k => mc[k] > 1 ? k + "×" + mc[k] : k).join(" "), "#ffcc00");
    }
    startMusic();   // [เฟส A4] ธีมอาจเปลี่ยนตามชั้น
    saveRun();
}

// ================== DEVIL DEAL (จับคู่ tier) ==================
function applyDevilDeal(pl) {
    pl = pl || player;   // [เฟส 3A] boon ส่วนตัว + Curse ผูกกับผู้เก็บ
    let tier = DEVIL_DEALS[Math.floor(Math.random() * DEVIL_DEALS.length)];
    let boon = tier.boons[Math.floor(Math.random() * tier.boons.length)];
    let curse = tier.curses[Math.floor(Math.random() * tier.curses.length)];
    boon.f(pl);
    curse.f(pl);
    pl.curses.push(curse.t);   // Curse ติดตัวผู้เก็บ — แสดงบนการ์ด
    stats.deals++;
    runChal.deals++;   // [v27]
    if (runChal.deals >= 3) unlockRunChal("devil");   // [v27] เดิมถาวร 5 สะสม
    saveMeta();
    particles.push({ type: "text", x: pl.x, y: pl.y - 40, text: "🃏 BOON: " + boon.t, life: 110, maxLife: 110, color: "#3dff8c", vy: -0.5 });   // [v13-3] เจ้าของดีล
    particles.push({ type: "text", x: pl.x, y: pl.y - 15, text: "🃏 CURSE: " + curse.t, life: 110, maxLife: 110, color: "#ff5577", vy: -0.5 });
    playSynthSFX("heavy_explosion");
    addShake(3, 0.25);
}

