"use strict";

// ================== สถิติผู้เล่น ==================
function recalcStats() {
    if (!player) return;
    players.forEach(pl => {
        let L = pl.levels;   // [3B-1] อัพเกรดของคนนี้
        let w = WEAPONS[pl.weaponType];
        let b = pl.buffs;
        let frLv = (L.FIRERATE || 0) + (b.firerate > 0 ? 2 : 0);
        let dmLv = (L.DMG || 0) + (b.dmg > 0 ? 2 : 0);
        let spLv = (L.SPEED || 0) + (b.speed > 0 ? 2 : 0);
        pl.maxCooldown = Math.max(5, Math.ceil(w.delay * (1 - 0.08 * frLv)));
        pl.damage = Math.round((w.dmg + 2 * dmLv + runMods.bonusDmg) * (1 + 0.02 * dmLv));
        pl.speed = w.speed * (1 + 0.25 * spLv);
        pl.maxDashCooldown = Math.max(30, Math.round(180 * (1 - 0.10 * spLv)));
        if (pl.dashCooldown > pl.maxDashCooldown) pl.dashCooldown = pl.maxDashCooldown;
        pl.maxHp = Math.max(30, w.maxHp + (20 + 2 * (currentFloor - 1)) * (L.MAX_HP || 0) - (runMods.maxHpDown + (pl.maxHpDown || 0)));   // [3B-3] Curse MAX HP รายคน (+ ค่า runMods เดิมจากเซฟดั้งเดิม)
        pl.magnetRadius = 60 + 40 * (L.MAGNET || 0);
        let cls = pl.weaponType;
        pl.swordArcLevel = (cls === "SWORD" ? (L.SPEC_SWORD || 0) : 0);
        pl.swordArc = 120 + pl.swordArcLevel * 30;
        pl.missileLevel = (cls === "GUN" ? (L.SPEC_GUN || 0) : 0);
        pl.mineLevel = (cls === "SHOTGUN" ? (L.SPEC_SHOTGUN || 0) : 0);
        pl.incendiaryLevel = ((cls === "GUN" || cls === "LASER") ? (L.INCENDIARY || 0) : 0);
        pl.stunShellsLevel = (cls === "SHOTGUN" ? (L.STUN_SHELLS || 0) : 0);
        pl.shardMineLevel = (cls === "SHOTGUN" ? (L.SHARD_MINE || 0) : 0);
        pl.turretLevel = (cls === "GUN" ? (L.GUN_TURRET || 0) : 0);
        pl.standLevel = (cls === "SWORD" ? (L.ATTACK_STAND || 0) : 0);
        pl.standDmgPct = 0.1 * pl.standLevel;
        pl.vampLevel = L.VAMPIRE || 0;
        pl.focusLevel = (cls === "LASER" ? (L.FOCUS_LENS || 0) : 0);
        pl.chargedLance = (cls === "LASER" ? (L.CHARGED_LANCE || 0) : 0);
        pl.swarmLevel = (cls === "DRONE" ? (L.SWARM || 0) : 0);
        pl.titan = (cls === "DRONE" ? (L.TITAN || 0) : 0);
        pl.ricochetLevel = L.RICOCHET || 0;   // [แพตช์] ชิ่งกำแพง (GUN/DRONE/TURRET)
        pl.droneTarget = (cls === "DRONE" && evolved.drone) ? 5 : (cls === "DRONE" ? 1 : 0) + pl.swarmLevel;   // [แก้] เริ่ม 1 ลำ (เดิม 2)
        pl.skillCdMax = CLASS_SKILLS[pl.weaponType].cd;
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
    pool.push(CLASS_UPGRADES[pl.weaponType]);
    (EXTRA_CLASS_UPGRADES[pl.weaponType] || []).forEach(u => pool.push(u));
    return pool.filter(u => {
        if (isUpgradeMaxed(pl, u)) return false;
        // [แก้] CLASS/EXTRA: ต้อง Player Level ≥ (เลเวลถัดไป × 5) — GENERAL ผ่านเสมอ
        let isClass = CLASS_UPGRADES[pl.weaponType] && CLASS_UPGRADES[pl.weaponType].id === u.id;
        let extras = EXTRA_CLASS_UPGRADES[pl.weaponType] || [];
        let isExtra = false;
        for (let i = 0; i < extras.length; i++) { if (extras[i].id === u.id) { isExtra = true; break; } }
        if ((isClass || isExtra) && pl.level < ((pl.levels[u.id] || 0) + 1) * BAL.CLS.GATE) return false;
        // EXTRA ยังต้องมี CLASS เท่ากับเลเวลถัดไป
        if (isExtra && !isExtraAvailable(u, pl)) return false;
        return true;
    });   // [แพตช์ระบบอัพ] + เช็ค prereq
}
function getTeamPool() {   // [3B-1] union ของทีม — ใช้กับร้านชั่วคราว (ร้านรายคน = 3B-2)
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
        if (!evolved.sword && w === "SWORD" && (pl.levels.SPEC_SWORD || 0) >= 3) {   // [แก้] ≥3 (เดิม ≥5)
            evolved.sword = true;
            announce("⚔ ZERO BLADE EVOLVED" + tag, "#7df9ff");
            toasts.push({ title: "⚔ ZERO BLADE" + tag, sub: "ทุก 4 ครั้งที่ฟัน ปล่อยโนวาแช่แข็ง", life: 200, maxLife: 200 });
            did = true;
        }
        if (!evolved.gun && w === "GUN" && (pl.levels.SPEC_GUN || 0) >= 3) {
            evolved.gun = true;
            announce("🚀 OMEGA RIFLE EVOLVED" + tag, "#ff5577");
            toasts.push({ title: "🚀 OMEGA RIFLE" + tag, sub: "มิสไซล์ออกทุก 2 นัด + เพิ่มจำนวน", life: 200, maxLife: 200 });
            did = true;
        }
        if (!evolved.shotgun && w === "SHOTGUN" && (pl.levels.SPEC_SHOTGUN || 0) >= 3 && (pl.levels.STUN_SHELLS || 0) >= 3) {
            evolved.shotgun = true;
            announce("💥 SUPERNOVA BUCKSHOT EVOLVED" + tag, "#8be9fd");
            toasts.push({ title: "💥 SUPERNOVA BUCKSHOT" + tag, sub: "ทุก 4 ยิง กระจาย 12 เม็ดรอบตัว 360° ดาเมจ 60%", life: 200, maxLife: 200 });
            did = true;
        }
        if (!evolved.laser && w === "LASER" && (pl.levels.CHARGED_LANCE || 0) >= 3 && (pl.levels.FOCUS_LENS || 0) >= 3 && (pl.levels.INCENDIARY || 0) >= 3) {   // [แก้] ≥3 (เดิม ≥1)
            evolved.laser = true;
            announce("🌌 SINGULARITY LANCE EVOLVED" + tag, "#7df9ff");
            toasts.push({ title: "🌌 SINGULARITY LANCE" + tag, sub: "ลำแสงดูดศัตรูเข้าหาจุดกระทบ", life: 200, maxLife: 200 });
            did = true;
        }
        if (!evolved.drone && w === "DRONE" && (pl.levels.SWARM || 0) >= 3 && (pl.levels.TITAN || 0) >= 1) {
            evolved.drone = true;
            announce("🐝 HIVE MIND EVOLVED" + tag, "#ffd23d");
            toasts.push({ title: "🐝 HIVE MIND" + tag, sub: "โดรนแม่ผึ้ง 45% + ลูกน้อง 4 ลำ", life: 200, maxLife: 200 });
            did = true;
        }
    });
    if (did) {
        stats.evolutions++;
        unlockAch("evolved");
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
        players.forEach(pl => { if (pl !== player) { pl.level = player.level; pl.xpNext = player.xpNext; pl.xp = player.xp; } });   // [3B-1] เลเวลทีมซิงก์กัน
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
        let pool = getUpgradePool(pl).slice().sort(() => Math.random() - 0.5).slice(0, 3);

        // [แก้] บังคับมี CLASS หรือ EXTRA อย่างน้อย 1 ใบทุกการเลเวลอัพ (ถ้ามีของพร้อม)
        // Milestone 5/10/15: บังคับ CLASS ก่อน / ผ่าน milestone แล้ว: สุ่มจาก CLASS+EXTRA ที่พร้อม
        {
            let classUpg = CLASS_UPGRADES[pl.weaponType];
            let extras = EXTRA_CLASS_UPGRADES[pl.weaponType] || [];
            let ready = [];
            // เก็บ CLASS ที่พร้อม
            if (!isUpgradeMaxed(pl, classUpg)) {
                let nextLv = (pl.levels[classUpg.id] || 0) + 1;
                if (pl.level >= nextLv * 5) ready.push(classUpg);
            }
            // เก็บ EXTRA ที่พร้อม
            extras.forEach(ex => {
                if (!isUpgradeMaxed(pl, ex) && isExtraAvailable(ex, pl)) {
                    let nextLv = (pl.levels[ex.id] || 0) + 1;
                    if (pl.level >= nextLv * 5) ready.push(ex);
                }
            });
            // ถ้า pool ยังไม่มี CLASS/EXTRA ใบไหนเลย → แทนที่ slot สุดท้าย
            if (ready.length > 0 && !pool.some(u => ready.some(r => r.id === u.id))) {
                let pick = ready[Math.floor(Math.random() * ready.length)];
                if (pool.length > 0) pool[pool.length - 1] = pick;
                else pool = [pick];
            }
        }

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
    if (floorClean) unlockAch("untouched");
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
    fb.textContent = "ยินดีต้อนรับสู่ BLACK MARKET";
    fb.style.color = "#8fa3b8";
    document.getElementById("shop-screen").classList.remove("hidden");
    renderShop();
}
function renderShop() {
    let wt = document.getElementById("shop-user-pts");
    wt.innerHTML = players.map((pl, i) =>
        '<span style="color:' + (PC_COLORS[i] || "#ffd700") + '; font-weight:bold;">P' + (i + 1) + ' 💰' + Math.floor(pl.coins) + '</span>'
    ).join("  ·  ") + '   |  ราคาแยกรายคน (แพงขึ้นตามจำนวนครั้งที่ตัวเองซื้อ) · ใครซื้ออัพติดคนนั้น (คลิกเมาส์ = P1 ซื้อ)';

    shopCards = [];
    if (!shopRandomBought) shopCards.push({ id: "RANDOM" });
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
        if (card.id === "RANDOM") {
            html += '<div class="upgrade-card" style="' + style + '" onclick="shopBuyCard(0, ' + ci + ')">'
                 + '<div class="up-name">🎲 RANDOM MODULE' + (tags ? " · " + tags : "") + '</div>'
                 + '<div class="up-lv">จำกัด 1 ครั้ง / การมาตลาด</div>'
                 + '<div class="up-desc">คนซื้อจ่าย — ทุกคนได้อัพเกรดสุ่มจาก pool ของตัวเอง</div>'
                 + '<div class="up-price">' + priceTxt + " COINS</div>"
                 + '</div>';
        } else {
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

    if (card.id === "RANDOM") {
        if (shopRandomBought) { feedback.textContent = tag + ": RANDOM ขายหมดแล้ว"; feedback.style.color = "#ff5577"; return; }
        if (buyer.coins < price) { feedback.textContent = "⚠ เหรียญ " + tag + " ไม่พอ (ต้องการ " + price + ")"; feedback.style.color = "#ff5577"; playSynthSFX("click"); return; }
        buyer.coins -= price;
        buyer.shopBuys = (buyer.shopBuys || 0) + 1;   // [3B-3fix] นับของคนซื้อ
        shopRandomBought = true;
        players.forEach(pl => { let p = getUpgradePool(pl); if (p.length) applyUpgrade(pl, p[Math.floor(Math.random() * p.length)].id); });
        playSynthSFX("levelup");
        feedback.style.color = "#00ffcc";
        feedback.textContent = "✔ " + tag + " ซื้อ RANDOM — ทุกคนได้อัพเกรดสุ่ม";
        renderShop();
        return;
    }

    let upg = card.upg;
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
    if (currentFloor >= 10) unlockAch("deep_diver");
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
    if (stats.deals >= 5) unlockAch("devil");
    saveMeta();
    particles.push({ type: "text", x: player.x, y: player.y - 40, text: "🃏 BOON: " + boon.t, life: 110, maxLife: 110, color: "#3dff8c", vy: -0.5 });
    particles.push({ type: "text", x: player.x, y: player.y - 15, text: "🃏 CURSE: " + curse.t, life: 110, maxLife: 110, color: "#ff5577", vy: -0.5 });
    playSynthSFX("heavy_explosion");
    addShake(3, 0.25);
}

