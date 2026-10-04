"use strict";

// ================== สกิล [E] ==================
function castSkill(pl) {
    pl = pl || player;   // [เฟส 2C]
    if (pl.hp <= 0) return;   // [v11-1] ผีทำได้แค่โจมตีอัตโนมัติ — ใช้สกิลไม่ได้
    if (pl.skillCd > 0) return;
    let s = CLASS_SKILLS[pl.weaponType];
    pl.skillCd = pl.skillCdMax || s.cd;   // [v10-1] ใช้ค่าที่ recalc แล้ว — RAPID CIRCUIT ลด CD สกิลได้จริง (เดิมใส่ s.cd ดิบทำให้ FIRERATE ไม่มีผลกับสกิลเลย)
    playSynthSFX("levelup");
    addShake(3, 0.25);
    announce("⚡ " + s.name + " ⚡", "#ffcc00");
    if (pl.weaponType === "SWORD") {
        let r = pl.bulletSize + BAL.SKILL.VORTEX_RADIUS;   // [v14]
        particles.push({ type: "slash", x: pl.x, y: pl.y, radius: r, angle: 0, arc: Math.PI * 2, life: 12, maxLife: 12, color: "rgba(0, 255, 204, 0.45)" });
        let healed = false, critAny = false;
        enemies.forEach(en => {
            if (Math.hypot(en.x - pl.x, en.y - pl.y) < r + en.size / 2) {
                if (strikeEnemy(en, pl.damage * BAL.SKILL.VORTEX_DMG, pl, true)) critAny = true;   // [v14]
                healed = true;
                let a = Math.atan2(en.y - pl.y, en.x - pl.x);
                applyKnockbackToEnemy(en, a, WEAPONS.SWORD);
                createSparks(en.x, en.y, "#00ffcc");
            }
        });
        if (healed) { tryVampHeal(pl, critAny ? 2 : 1); tryVampHeal(pl, vampHeal(pl)); }
    } else if (pl.weaponType === "GUN") {
        let pool = enemies.filter(en => en.hp > 0 && en.typeKey !== "BLOCK_OBSTACLE" &&
            Math.hypot(en.x - pl.x, en.y - pl.y) <= BAL.CLS.MISSILE_RANGE);   // [v11-3] ระดมในรัศมีเดียวกับมิสไซล์ปกติ — เดิมสุ่มจากทั้งแผนที่
        for (let i = 0; i < BAL.SKILL.BARRAGE_N; i++) {   // [v14]
            let t = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
            let ang = t ? Math.atan2(t.y - pl.y, t.x - pl.x) : Math.random() * Math.PI * 2;
            playerProjectiles.push({
                x: pl.x, y: pl.y, vx: Math.cos(ang) * BAL.SKILL.BARRAGE_SPD, vy: Math.sin(ang) * BAL.SKILL.BARRAGE_SPD,   // [v14]
                damage: pl.damage * BAL.SKILL.BARRAGE_DMG, size: 12, color: "#ff0055", type: "MISSILE", target: t, forcedCrit: false,   // [v14]
                owner: pl
            });
        }
        playSynthSFX("missile");
    } else if (pl.weaponType === "SHOTGUN") {
        particles.push({ type: "slowWave", x: pl.x, y: pl.y, radius: 20, maxRadius: BAL.SKILL.EMP_RANGE, angle: 0, arcDeg: 360, life: 20, maxLife: 20, faint: false });   // [v14]
        enemies.forEach(en => {
            if (Math.hypot(en.x - pl.x, en.y - pl.y) < BAL.SKILL.EMP_RANGE) {   // [v14]
                applyStunToEnemy(en, BAL.SKILL.EMP_STUN);   // [v14]
                damageEnemy(en, BAL.SKILL.EMP_DMG);   // [v14]
            }
        });
        addHitStop(2);
    } else if (pl.weaponType === "LASER") {
        let focus = 1 + 0.4 * pl.focusLevel;
        for (let i = 0; i < BAL.SKILL.NOVA_DIRS; i++) {   // [v14]
            let ang = (i / BAL.SKILL.NOVA_DIRS) * Math.PI * 2;
            playerProjectiles.push({
                x: pl.x, y: pl.y, vx: Math.cos(ang) * 14, vy: Math.sin(ang) * 14,
                damage: pl.damage * focus * BAL.SKILL.NOVA_DMG, size: 8, color: "#7df9ff", type: "LASER", hits: {}, travel: 0, forcedCrit: false, vampDone: false,   // [v14]
                owner: pl
            });
        }
        playSynthSFX("missile_screamer");
    } else if (pl.weaponType === "DRONE") {
        droneOverdrive = BAL.SKILL.OVERDRIVE_SEC;   // [v14]
        particles.push({ type: "slowWave", x: pl.x, y: pl.y, radius: 20, maxRadius: 160, angle: 0, arcDeg: 360, life: 16, maxLife: 16, faint: false });
    }
}

// ================== การฟันดาบ (ผู้เล่น + STAND) — ทะลุกำแพงตามเดิม ==================
function swordSwing(x, y, targetAngle, dmg, owner, isStand, forcedCrit) {
    owner = owner || player;   // [เฟส 2B] ฟันของใคร = สถิติ/ดูดเลือดของคนนั้น
    playSynthSFX(isStand ? "sword_stand" : "sword");
    let healed = false, critAny = false;

    if (swordVfxOn) {
        particles.push({
            type: "slash", x: x, y: y,
            radius: owner.bulletSize, angle: targetAngle, arc: (owner.swordArc * Math.PI) / 180,
            life: 9, maxLife: 9,
            color: isStand ? "rgba(201, 166, 255, 0.12)" : "rgba(0, 255, 204, 0.22)"
        });
    }

    if (owner.swordArcLevel >= 1) {
        let cfg = SLOW_WAVE_LEVELS[Math.min(owner.swordArcLevel, 5)];
        let waveRadius = owner.bulletSize + owner.swordArcLevel * TILE_SIZE;
        let waveArcRad = (SLOW_WAVE.arcDeg * Math.PI) / 180;
        let interval = owner.maxCooldown / 60;
        let dur = Math.min(cfg.dur, interval * SLOW_WAVE.maxUptime);

        if (swordVfxOn) spawnSlowWaveVFX(x, y, owner.bulletSize, waveRadius, targetAngle, SLOW_WAVE.arcDeg, dur, isStand);

        enemies.forEach(en => {
            let dx = en.x - x, dy = en.y - y;
            if (Math.hypot(dx, dy) > waveRadius + en.size / 2) return;
            let ang = Math.atan2(dy, dx);
            let diff = Math.atan2(Math.sin(ang - targetAngle), Math.cos(ang - targetAngle));
            if (Math.abs(diff) <= waveArcRad / 2) {
                applySlowToEnemy(en, cfg.pct, dur);
                if (strikeEnemy(en, dmg * 0.2, owner, true, forcedCrit)) critAny = true;
                healed = true;
            }
        });
    }

    enemies.forEach(en => {
        let dx = en.x - x, dy = en.y - y;
        let dist = Math.hypot(dx, dy);
        if (dist <= owner.bulletSize + en.size / 2) {
            let angleToEnemy = Math.atan2(dy, dx);
            let diff = Math.atan2(Math.sin(angleToEnemy - targetAngle), Math.cos(angleToEnemy - targetAngle));
            let arcRad = (owner.swordArc * Math.PI) / 180;
            if (Math.abs(diff) <= arcRad / 2) {
                if (strikeEnemy(en, dmg, owner, true, forcedCrit)) critAny = true;
                healed = true;
                createSparks(en.x, en.y, "#00ffcc");
                applyKnockbackToEnemy(en, angleToEnemy, WEAPONS.SWORD);
            }
        }
    });

    // [รอบ 1] ดูดเลือดติดตัว (1/คริ 2) + VAMPIRE ต่อการโจมตี — ผ่านแคป 5%/วิของเจ้าของ
    if (healed) {
        tryVampHeal(owner, critAny ? 2 : 1);
        tryVampHeal(owner, vampHeal(owner));
    }
}

// ================== การโจมตี ==================
function performAttack(pl) {
    pl = pl || player;   // [เฟส 2C]
    let targetAngle = pl.angle;
    // [แพตช์คริ] คริการันตีจากแดช: ผูกกับการโจมตีครั้งถัดไปครั้งเดียว แล้วเคลียร์ทันที
    let forcedCrit = pl.dashCritTimer > 0;

    if (pl.weaponType === "GUN" || pl.weaponType === "DRONE") {
        playSynthSFX("shoot");
        playerProjectiles.push({
            x: pl.x, y: pl.y,
            vx: Math.cos(targetAngle) * pl.bulletSpeed, vy: Math.sin(targetAngle) * pl.bulletSpeed,
            damage: pl.damage, size: pl.bulletSize,
            color: pl.weaponType === "DRONE" ? "#9fd6ff" : "#00ffcc", type: "GUN",
            forcedCrit: forcedCrit,
            ricochet: pl.ricochetLevel || 0,   // [แพตช์] ชิ่งกำแพง (Normal_Bullet เท่านั้น)
            owner: pl
        });
        if (pl.weaponType === "GUN") {
            pl.gunShotCount++;
            let threshold = evolved.gun ? BAL.CLS.MISSILE_EVO_EVERY : BAL.CLS.MISSILE_EVERY;
            if (pl.gunShotCount >= threshold) {
                pl.gunShotCount = 0;
                if (pl.missileLevel > 0 && enemies.length > 0) {
                    // [v11-2] เล็งเฉพาะศัตรูใน MISSILE_RANGE + ไม่รวมหิน — เดิม sort ทุกตัวทั้งแผนที่
                    // ทำให้สู้บอสแล้วมิสไซล์ตัวที่ 2,3,4 บินหามอนไกลๆ/ก้อนหิน
                    let sorted = enemies.filter(en => en.hp > 0 && en.typeKey !== "BLOCK_OBSTACLE" &&
                        Math.hypot(en.x - pl.x, en.y - pl.y) <= BAL.CLS.MISSILE_RANGE)
                        .sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y));
                    let count = pl.missileLevel + (evolved.gun ? 1 : 0);
                    for (let m = 0; m < count; m++) {
                        playerProjectiles.push({
                            x: pl.x, y: pl.y,
                            vx: Math.cos(targetAngle) * BAL.CLS.MISSILE_SPD, vy: Math.sin(targetAngle) * BAL.CLS.MISSILE_SPD,   // [v14]
                            damage: pl.damage * BAL.CLS.MISSILE_DMG, size: 12, color: "#ff0055",
                            type: "MISSILE", target: sorted.length ? sorted[m % sorted.length] : null,   // [v11-2] ไม่มีเป้าในรัศมี = บินตรงตามทิศเล็ง (กัน NaN จาก % 0)
                            forcedCrit: forcedCrit,
                            owner: pl
                        });
                    }
                    playSynthSFX("missile");
                }
            }
        }
        pl.attackCooldown = pl.maxCooldown;

    } else if (pl.weaponType === "LASER") {
        pl.laserShotCount = (pl.laserShotCount || 0) + 1;
        let chargedMult = 0;
        if (pl.chargedLance > 0 && pl.laserShotCount % BAL.CLS.LANCE_EVERY === 0) {
            chargedMult = BAL.CLS.LANCE_DMG[Math.min(pl.chargedLance, 3)];
        }
        let charged = chargedMult > 0;
        let focus = 1 + 0.4 * pl.focusLevel;
        if (charged) { playSynthSFX("missile_screamer"); } else playSynthSFX("shoot");
        playerProjectiles.push({
            x: pl.x, y: pl.y,
            vx: Math.cos(targetAngle) * pl.bulletSpeed, vy: Math.sin(targetAngle) * pl.bulletSpeed,
            damage: pl.damage * focus * (charged ? chargedMult : 1),
            size: charged ? 10 : 6, color: charged ? "#fff7ae" : "#7df9ff",
            type: "LASER", hits: {}, travel: 0,
            forcedCrit: forcedCrit, vampDone: false,
            owner: pl
        });
        pl.attackCooldown = pl.maxCooldown;

    } else if (pl.weaponType === "SHOTGUN") {
        playSynthSFX("shotgun");
        shotgunBlastSeq++;
        // [v14] จำนวนเม็ด/มุมกระจายจาก BAL.CLS — เม็ดกลาง (canVamp) คำนวณจากจำนวนจริง (เดิม fix 5 เม็ด idx===2)
        let sgN = BAL.CLS.SG_PELLETS, sgMid = Math.floor((sgN - 1) / 2);
        for (let idx = 0; idx < sgN; idx++) {
            let sp = (idx - sgMid) * BAL.CLS.SG_STEP;
            playerProjectiles.push({
                x: pl.x, y: pl.y,
                vx: Math.cos(targetAngle + sp) * pl.bulletSpeed,
                vy: Math.sin(targetAngle + sp) * pl.bulletSpeed,
                damage: pl.damage, size: pl.bulletSize, color: "#ffcc00",
                type: "SHOTGUN", startX: pl.x, startY: pl.y,
                blastId: shotgunBlastSeq,
                forcedCrit: forcedCrit,
                canVamp: idx === sgMid,
                hits: {},             // [แพตช์] Piece_Bullet: จำศัตรูที่โดนแล้ว (ทะลุ)
                hitCount: 0,          // [แพตช์] นับจำนวนที่ทะลุ (สำหรับ decay + cap)
                owner: pl
            });
        }
        pl.shotgunCount++;
        if (pl.shotgunCount >= BAL.CLS.MINE_EVERY) {   // [v10-2] ใช้ BAL (เดิม hardcode 5)
            pl.shotgunCount = 0;
            dropShotgunMines(pl);
        }

        // [v10-2] SUPERNOVA BUCKSHOT: ตัวนับแยกจากไมน์ — เดิมใช้ shotgunCount ร่วมกัน พอรีเซ็ตเป็น 0 แล้ว 0%4===0
        // ทำให้โนวายิงซ้อนกับยิงที่ทิ้งไมน์ (จังหวะ 4,5 / 9,10 / 14,15...) — ตอนนี้โนวาทุก 4 ไมน์ทุก 5 อิสระ
        pl.novaCount = (pl.novaCount || 0) + 1;
        if (evolved.shotgun && pl.novaCount >= BAL.CLS.NOVA_EVERY) {
            pl.novaCount = 0;
            for (let a = 0; a < BAL.CLS.NOVA_PELLETS; a++) {
                let ang = (a / BAL.CLS.NOVA_PELLETS) * Math.PI * 2;
                playerProjectiles.push({
                    x: pl.x, y: pl.y,
                    vx: Math.cos(ang) * pl.bulletSpeed,
                    vy: Math.sin(ang) * pl.bulletSpeed,
                    damage: pl.damage * BAL.CLS.NOVA_DMG,
                    size: pl.bulletSize, color: "#ff923d",
                    type: "SHOTGUN", startX: pl.x, startY: pl.y,
                    blastId: shotgunBlastSeq,
                    forcedCrit: false,
                    canVamp: false,
                    hits: {}, hitCount: 0,
                    owner: pl
                });
            }
            playSynthSFX("explosion");
            addShake(2, 0.15);
            particles.push({ type: "explosion", x: pl.x, y: pl.y, radius: 100, life: 12, maxLife: 12, color: "rgba(255, 146, 61, 0.3)" });
        }

        pl.attackCooldown = pl.maxCooldown;

    } else if (pl.weaponType === "SWORD") {
        pl.swordSwingCount = (pl.swordSwingCount || 0) + 1;

        if (evolved.sword && pl.swordSwingCount % BAL.CLS.ZERO_EVERY === 0) {   // [v14]
            if (swordVfxOn) {
                particles.push({ type: "slowWave", x: pl.x, y: pl.y, radius: 20, maxRadius: BAL.CLS.ZERO_RADIUS, angle: 0, arcDeg: 360, life: 16, maxLife: 16, faint: false });   // [v14]
                particles.push({ type: "explosion", x: pl.x, y: pl.y, radius: BAL.CLS.ZERO_RADIUS - 30, life: 12, maxLife: 12, color: "rgba(140, 220, 255, 0.18)" });   // [v14] 150 เมื่อรัศมี 180
            }
            playSynthSFX("explosion");
            enemies.forEach(en => {
                if (Math.hypot(en.x - pl.x, en.y - pl.y) < BAL.CLS.ZERO_RADIUS + en.size / 2) {   // [v14]
                    applyFreezeToEnemy(en, BAL.CLS.ZERO_FREEZE);   // [v14]
                    damageEnemy(en, pl.damage * BAL.CLS.ZERO_DMG);   // [v14]
                }
            });
        }

        swordSwing(pl.x, pl.y, targetAngle, pl.damage, pl, false, forcedCrit);
        pl.attackCooldown = pl.maxCooldown;
    }

    // [แพตช์คริ] ใช้คริจากแดชไปแล้ว = เคลียร์สถานะทันที (วง CRIT! หายปั๊บ)
    if (forcedCrit) pl.dashCritTimer = 0;
}

// ================== [3C] ผี STAND: ท่าปกติของอาชีพ ดาเมจ 10% อิง stat ก่อนตาย ==================
function ghostAttack(pl) {
    let ang = pl.angle;
    let dmg = pl.ghostDmg;
    if (pl.weaponType === "SWORD") {
        swordSwing(pl.x, pl.y, ang, dmg, pl, true, false);   // สไตล์ STAND (สี/เสียงเบา)
    } else if (pl.weaponType === "SHOTGUN") {
        playSynthSFX("shotgun");
        shotgunBlastSeq++;
        // [v14] ใช้ BAL.CLS.SG_PELLETS/SG_STEP เดียวกับยิงจริง
        for (let idx = 0; idx < BAL.CLS.SG_PELLETS; idx++) {
            let sp = (idx - Math.floor((BAL.CLS.SG_PELLETS - 1) / 2)) * BAL.CLS.SG_STEP;
            playerProjectiles.push({
                x: pl.x, y: pl.y,
                vx: Math.cos(ang + sp) * pl.bulletSpeed,
                vy: Math.sin(ang + sp) * pl.bulletSpeed,
                damage: dmg, size: pl.bulletSize, color: "#c9a6ff",
                type: "SHOTGUN", startX: pl.x, startY: pl.y,
                blastId: shotgunBlastSeq,
                forcedCrit: false,
                canVamp: false,   // ผีไม่ดูดเลือด
                owner: pl
            });
        }
    } else if (pl.weaponType === "LASER") {
        playSynthSFX("shoot");
        playerProjectiles.push({
            x: pl.x, y: pl.y,
            vx: Math.cos(ang) * pl.bulletSpeed, vy: Math.sin(ang) * pl.bulletSpeed,
            damage: dmg, size: 6, color: "#c9a6ff",
            type: "LASER", hits: {}, travel: 0,
            forcedCrit: false, vampDone: true,
            owner: pl
        });
    } else {   // GUN / DRONE
        playSynthSFX("shoot");
        playerProjectiles.push({
            x: pl.x, y: pl.y,
            vx: Math.cos(ang) * pl.bulletSpeed, vy: Math.sin(ang) * pl.bulletSpeed,
            damage: dmg, size: pl.bulletSize, color: "#c9a6ff", type: "GUN",
            forcedCrit: false,
            owner: pl
        });
    }
    pl.attackCooldown = pl.maxCooldown;   // aspd ตามร่างก่อนตาย
}

