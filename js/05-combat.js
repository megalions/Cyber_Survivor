"use strict";

// ================== game feel helpers ==================
function addShake(mag, dur) { shakeMag = Math.max(shakeMag, mag); shakeT = Math.max(shakeT, dur); }
function addHitStop(f) { hitStopFrames = Math.min(6, Math.max(hitStopFrames, f)); }
function announce(text, color, pl) {   // [v13-3] พารามิเตอร์ที่ 3 = เจ้าของข้อความ (ไม่ส่ง = P1 เหมือนเดิม — caller เดิมไม่ต้องแก้)
    pl = pl || player;
    if (!pl) return;
    particles.push({ type: "text", x: pl.x, y: pl.y - 55, text: text, life: 85, maxLife: 85, color: color || "#00ffcc", vy: -0.5 });
}


// ================== สถานะศัตรู ==================
function createStatus() {
    return { slow: 0, slowPct: 0, burn: 0, burnDps: 0, stun: 0, stunCd: 0, freeze: 0, slowHits: [], pelletBlast: null };
}
function getSlowResistance(en) {
    let bp = ENEMY_TYPES[en.typeKey];
    if (bp && bp.slowResistance !== undefined) return bp.slowResistance;
    return en.isBoss ? 0.5 : 0;
}
function applySlowToEnemy(en, pct, dur, countCombo) {
    if (en.typeKey === "BLOCK_OBSTACLE") return;
    if (en.status.freeze > 0) return;
    if (countCombo === undefined) countCombo = true;
    let res = getSlowResistance(en);
    let finalPct = pct * (1 - res);
    if (finalPct > en.status.slowPct || en.status.slow <= 0) en.status.slowPct = finalPct;
    en.status.slow = Math.max(en.status.slow, dur);
    if (countCombo && !en.isBoss) {
        en.status.slowHits.push(gameTime);
        en.status.slowHits = en.status.slowHits.filter(t => gameTime - t <= SHATTER.window);
        if (en.status.slowHits.length >= SHATTER.hitsNeeded) {
            en.status.slowHits = [];
            applyFreezeToEnemy(en, SHATTER.freezeDur);
        }
    }
}
function applyBurnToEnemy(en, dps, dur) {
    if (en.typeKey === "BLOCK_OBSTACLE") return;
    let bp = ENEMY_TYPES[en.typeKey];
    let res = bp ? (bp.burnResistance || 0) : 0;
    if (en.isBoss) res = Math.max(res, 0.5);
    en.status.burnDps = Math.max(en.status.burnDps, dps * (1 - res));
    en.status.burn = Math.max(en.status.burn, dur);
}
function applyStunToEnemy(en, dur) {
    if (en.isBoss || en.typeKey === "BLOCK_OBSTACLE") return;
    let bp = ENEMY_TYPES[en.typeKey];
    let res = bp ? (bp.stunResistance || 0) : 0;
    if (res >= 1) return;
    en.status.stun = Math.max(en.status.stun, dur * (1 - res));
    createSparks(en.x, en.y, "#ffe066");
    playSynthSFX("hit");
}
function applyFreezeToEnemy(en, dur) {
    if (en.isBoss || en.typeKey === "BLOCK_OBSTACLE") return;
    en.status.freeze = Math.max(en.status.freeze, dur);
    en.status.slow = 0; en.status.slowPct = 0;
    en.status.slowHits = [];
    particles.push({ type: "explosion", x: en.x, y: en.y, radius: en.size, life: 10, maxLife: 10, color: "rgba(180, 240, 255, 0.45)" });
    playSynthSFX("hit");
}

// ================== ระเบิดความเย็นแบบคิว ==================
let shatterQueue = [];
function queueShatter(en) {
    if (!en.shatterQueued) { en.shatterQueued = true; shatterQueue.push(en); }
}
function processShatters() {
    let processed = 0;
    while (shatterQueue.length > 0) {
        processed++;
        if (processed > 200) { shatterQueue.length = 0; break; }
        let en = shatterQueue.shift();
        en.shatterQueued = false;
        if (en.hp <= 0) continue;
        en.status.freeze = 0;
        en.status.slow = 0; en.status.slowPct = 0;
        en.status.slowHits = [];
        let dmg = Math.max(0, en.hp) * SHATTER.dmgPct;
        particles.push({ type: "explosion", x: en.x, y: en.y, radius: SHATTER.radius, life: 14, maxLife: 14, color: "rgba(160, 230, 255, 0.30)" });
        createSparks(en.x, en.y, "#bfeaff");
        playSynthSFX("hit");
        enemies.forEach(other => {
            if (other === en || other.hp <= 0) return;
            if (Math.hypot(other.x - en.x, other.y - en.y) <= SHATTER.radius + other.size / 2) {
                damageEnemy(other, dmg);
                applySlowToEnemy(other, SHATTER.slowPct, SHATTER.slowDur, false);
            }
        });
    }
}

// ================== ระบบคริติคอล ==================
function getCritChance(pl) {
    pl = pl || player;
    let ch = 0.05 + 0.05 * ((pl.levels.CRIT) || 0) + (runMods.critUp || 0);
    if (metaUnlocks.crit) ch += 0.10;
    if (killStreak >= 10) ch += 0.10;
    return Math.min(0.95, ch);
}
function getCritMult(pl) {
    pl = pl || player;
    let m = 2.0 + 0.25 * ((pl.levels.CRIT) || 0) - (runMods.critMultDown || 0);
    return Math.max(1.5, m);
}
// [แพตช์คริ] ไม่เช็ค dashCritTimer ที่นี่แล้ว — คริจากแดชจัดการผ่าน forcedCrit
// ที่ผูกกับ "การโจมตีครั้งถัดไป" เพียงครั้งเดียว (สถานะหายทันทีหลังโจมตี)
function rollCrit(en, owner) {
    owner = owner || player;   // [เฟส 2B] pity เป็นของรายคน
    if (en.hp < en.maxHp * 0.15) return true;
    let ch = getCritChance(owner);
    if (Math.random() < Math.min(0.95, ch + owner.pity)) return true;
    owner.pity = Math.min(0.5, owner.pity + ch * 0.5);
    return false;
}
function strikeEnemy(en, baseDmg, owner, canCrit, forceCrit) {
    owner = owner || player;   // [เฟส 2B] รู้ว่าใครตี — คริ/pity รายคน
    let dmg = baseDmg;
    let crit = false;
    if (forceCrit) crit = true;
    else if (canCrit !== false) crit = rollCrit(en, owner);
    if (crit) {
        dmg *= getCritMult(owner);
        owner.pity = 0;
    }
    damageEnemy(en, dmg, crit);
    if (crit) {
        stats.crits++;
        if (stats.crits >= 1000) unlockAch("crit_mass");
        if (frameCount - lastCritSfxFrame > 4) {
            playSynthSFX("crit");
            lastCritSfxFrame = frameCount;
        }
    }
    return crit;
}

// ================== [รอบ 1] ดูดเลือด: ต่อการโจมตี + แคป 5%/วิ ==================
function vampHeal(pl) {
    pl = pl || player;   // [เฟส 2B] รายเจ้าของ
    if (pl.vampLevel <= 0) return 0;
    let amt = 0.5 * pl.vampLevel;
    if (pl.weaponType === "GUN" || pl.weaponType === "LASER" || pl.weaponType === "DRONE") amt *= 0.5;
    return amt;
}
function tryVampHeal(pl, amount) {
    pl = pl || player;   // [เฟส 2B] แคป 5%/วิ รายคน
    if (amount <= 0 || !pl || pl.hp <= 0 || pl.hp >= pl.maxHp) return;   // [3C] ผีไม่ดูดเลือด (กันฟื้นโดยพลัก)
    let cap = pl.maxHp * BAL.PLR.VAMP_CAP;
    if (pl.healAccum >= cap) return;
    let healed = Math.min(amount, cap - pl.healAccum);
    pl.hp = Math.min(pl.maxHp, pl.hp + healed);
    pl.healAccum += healed;
}

// ================== ดาเมจกลาง ==================
function damageEnemy(en, amount, isCrit) {
    if (en.hp <= 0) return;
    amount *= runMods.dmgDealtMult;
    if (en.shield > 0) {
        let absorbed = Math.min(en.shield, amount);
        en.shield -= absorbed;
        amount -= absorbed;
        createSparks(en.x, en.y, "#66ccff");
        if (amount <= 0) return;
    }
    en.hp -= amount;
    if (dmgNumbersOn && amount >= 1 && dmgNumActive < 40) {
        dmgNumActive++;
        particles.push({
            type: "dmg", x: en.x + (Math.random() - 0.5) * 16, y: en.y - en.size / 2,
            text: "" + Math.round(amount) + (isCrit ? "!" : ""),
            life: isCrit ? 32 : 26, maxLife: isCrit ? 32 : 26,
            color: isCrit ? "#ff923d" : (amount >= 30 ? "#ffd23d" : "#e8fff9"),
            vy: isCrit ? -1.4 : -1, crit: !!isCrit
        });
    }
    if (isCrit && en.hp <= 0) addHitStop(1);
    if (en.status && en.status.freeze > 0) queueShatter(en);
}

function spawnSlowWaveVFX(x, y, fromR, toR, angle, arcDeg, lifeSec, faint) {
    let frames = Math.round(lifeSec / DT);
    if (frames < 3) return;
    let count = 0, oldest = -1;
    for (let i = 0; i < particles.length; i++) {
        if (particles[i].type !== "slowWave") continue;
        count++;
        if (oldest === -1 || particles[i].life < particles[oldest].life) oldest = i;
    }
    if (count >= SLOW_WAVE.maxVfx && oldest !== -1) {
        let o = particles[oldest];
        o.x = x; o.y = y; o.radius = fromR; o.maxRadius = toR;
        o.angle = angle; o.arcDeg = arcDeg;
        o.life = frames; o.maxLife = frames; o.faint = !!faint;
        return;
    }
    particles.push({ type: "slowWave", x: x, y: y, radius: fromR, maxRadius: toR, angle: angle, arcDeg: arcDeg, life: frames, maxLife: frames, faint: !!faint });
}

// ================== Knockback / Particles ==================
function applyKnockbackToEnemy(enemy, angle, weaponConfig) {
    let blueprint = ENEMY_TYPES[enemy.typeKey];
    let resistance = blueprint ? (blueprint.kbResistance || 0) : 0;
    if (resistance >= 1.0) return;
    let finalForce = weaponConfig.kbForce * (1 - resistance);
    enemy.kbVx = Math.cos(angle) * finalForce;
    enemy.kbVy = Math.sin(angle) * finalForce;
    enemy.kbTimer = weaponConfig.kbDuration;
}
function createSparks(x, y, color) {
    for (let i = 0; i < 4; i++) {
        particles.push({ type: "spark", x: x, y: y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, size: 2 + Math.random() * 2, life: 10 + Math.random() * 6, color: color });
    }
}

// ================== [รอบ 2] ตัวคูณดาเมจศัตรู (แคป x3.5) ==================
function enemyDmgMult() {
    let base = Math.min(BAL.MON.DMG_CAP, 1 + BAL.MON.DMG_PER_FLOOR * (currentFloor - 1));
    return base * (1 + BAL.MON.DMG_COOP * (players.length - 1));
}

