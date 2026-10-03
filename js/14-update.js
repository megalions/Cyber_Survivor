"use strict";

// [แพตช์] Ricochet redirect: ชิ่งแล้วบินหาศัตรูใกล้สุด / ไม่มีศัตรู = ชิ่งปกติ
function ricochetRedirect(p, excludeEn) {
    let target = null, best = Infinity;
    for (let i = 0; i < enemies.length; i++) {
        let en = enemies[i];
        if (en === excludeEn || en.hp <= 0 || en.typeKey === "BLOCK_OBSTACLE") continue;
        let d = Math.hypot(en.x - p.x, en.y - p.y);
        if (d < best) { best = d; target = en; }
    }
    if (target) {
        let ang = Math.atan2(target.y - p.y, target.x - p.x);
        let spd = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        return true;
    }
    return false;
}

// ================== UPDATE ==================
function update() {
    frameCount++;

    if (hitStopFrames > 0) { hitStopFrames--; return; }

    if (isWarping) {
        warpTimer--;
        warpStars.forEach(s => {
            s.d += s.spd;
            if (s.d > 520) { s.d = 10 + Math.random() * 50; s.a = Math.random() * Math.PI * 2; }
        });
        if (warpTimer <= 0) { isWarping = false; openShopScreen(); }
        return;
    }
    if (!player || isPaused || isShopping || isGameOver) return;
    if (pendingLevelUps > 0) { openLevelUp(); return; }   // [3B-1] เลเวลอัพที่ค้างระหว่าง warp/ร้าน
    gameTime += DT;
    handleSpawners();

    // [เฟส 5] Touch: AUTO lock ON + perf monitor
    if (touchMode && player && !player.autoAtk) player.autoAtk = true;
    updateTouchPerf();

    // [เฟส A2] ฝุ่นบรรยากาศ — ข้ามถ้า perf ลดแล้ว
    if (perfLevel < 1 && frameCount % 18 === 0 && particles.length < 260) {
        let th = getTheme();
        particles.push({ type: "amb",
            x: player.x + (Math.random() - 0.5) * (VIEW_WIDTH / camZoom),
            y: player.y + (Math.random() - 0.5) * (VIEW_HEIGHT / camZoom),
            vx: (Math.random() - 0.5) * 0.3, vy: -0.15 - Math.random() * 0.25,
            size: 2, life: 130 + Math.random() * 60, maxLife: 190, color: th.accent });
    }

if (droneOverdrive > 0) droneOverdrive -= DT;
    if (streakTimer > 0) {
        streakTimer -= DT;
        if (streakTimer <= 0) killStreak = 0;
    }

    // [เฟส 2C] ส่วนผู้เล่นรายคน: timers + บัฟ + เดิน/แดช + เล็ง/โจมตี (ตอนนี้ 1 คน = เหมือนเดิม)
    players.forEach((pl, pi) => {
        if (pl.hp <= 0) {
            // [เฟส 3A] ผีลอยตามเพื่อนที่ยังมีชีวิต ทะลุกำแพงได้
            let alive = nearestPlayerTo(pl.x, pl.y);
            if (alive) {
                pl.x += (alive.x - pl.x) * 0.015;
                pl.y += (alive.y - pl.y) * 0.015;
            }
            // [3C] ผี STAND โจมตีอัตโนมัติ
            if (players.length > 1 && (pl.ghostDmg || 0) > 0) {
                if (pl.attackCooldown > 0) pl.attackCooldown--;
                let gT = null, gD = Infinity, gSup = null, gSupD = Infinity, gRock = null, gRockD = Infinity;
                enemies.forEach(en2 => {
                    let d2 = Math.hypot(en2.x - pl.x, en2.y - pl.y);
                    if (d2 > AUTO_AIM_RANGE) return;
                    if (en2.typeKey === "BLOCK_OBSTACLE") { if (d2 < gRockD) { gRockD = d2; gRock = en2; } return; }
                    if (en2.typeKey === "HEALER" || en2.typeKey === "SHIELDER") { if (d2 < gSupD) { gSupD = d2; gSup = en2; } return; }
                    if (d2 < gD) { gD = d2; gT = en2; }
                });
                let gTgt = gSup || gT || gRock;
                if (gTgt) {
                    pl.angle = Math.atan2(gTgt.y - pl.y, gTgt.x - pl.x);
                    if (pl.attackCooldown <= 0) ghostAttack(pl);
                }
            }
            return;
        }
        if (pl.dashCooldown > 0) pl.dashCooldown--;
        if (pl.hurtTimer > 0) pl.hurtTimer--;
        if (pl.dashCritTimer > 0) pl.dashCritTimer -= DT;
        if (pl.skillCd > 0) pl.skillCd -= DT;
        pl.healCapT -= DT;
        if (pl.healCapT <= 0) { pl.healCapT += 1; pl.healAccum = 0; }
        let buffsChanged = false;
        for (let k in pl.buffs) {
            if (pl.buffs[k] > 0) {
                pl.buffs[k] -= DT;
                if (pl.buffs[k] <= 0) {
                    pl.buffs[k] = 0;
                    if (k === "shield") pl.shield = 0;
                    buffsChanged = true;
                }
            }
        }
        if (buffsChanged) recalcStats();   // [เฟส 3] จะเปลี่ยนเป็น recalc รายคน

        // ---- เดิน / แดช ----
        let mv = inputMove(pi);
        if (pl.dashTimer > 0) {
            pl.dashTimer--;
            let nx = pl.x + pl.dashVx;
            if (!blockedForEntity(nx, pl.y, pl.size)) pl.x = nx;
            let ny = pl.y + pl.dashVy;
            if (!blockedForEntity(pl.x, ny, pl.size)) pl.y = ny;
            particles.push({ type: "spark", x: pl.x, y: pl.y, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, size: 3 + Math.random() * 2, life: 8, color: "#00ffcc" });
            if (pl.dashTimer <= 0) pl.isInvulnerable = false;
        } else {
            let moveX = mv.x * pl.speed, moveY = mv.y * pl.speed;
            let nx = pl.x + moveX;
            if (!blockedForEntity(nx, pl.y, pl.size)) pl.x = nx;
            let ny = pl.y + moveY;
            if (!blockedForEntity(pl.x, ny, pl.size)) pl.y = ny;
        }

        pl.trail.push({ x: pl.x, y: pl.y });
        if (pl.trail.length > 40) pl.trail.shift();

        // ---- เล็ง + โจมตี ----
        if (pl.attackCooldown > 0) pl.attackCooldown--;
        if (pl.autoAtk || players.length > 1) {
            // [แก้] เล็ง "คนใกล้ที่สุด" เสมอ — ไม่เร่ง HEALER/SHIELDER ถ้ามอนปกติอยู่ใกล้กว่า
            let closest = null, best = Infinity;
            let rockClosest = null, rockBest = Infinity;
            enemies.forEach(en => {
                let d = Math.hypot(en.x - pl.x, en.y - pl.y);
                if (d > AUTO_AIM_RANGE) return;
                if (en.typeKey === "BLOCK_OBSTACLE") {
                    if (d < rockBest) { rockBest = d; rockClosest = en; }
                    return;
                }
                if (d < best) { best = d; closest = en; }
            });
            let aimTarget = closest || rockClosest;
            if (aimTarget) {
                pl.angle = Math.atan2(aimTarget.y - pl.y, aimTarget.x - pl.x);
                if (pl.attackCooldown <= 0 && (pl.autoAtk || inputAttackHeld(pi))) performAttack(pl);
            }
        } else {
            // เล็งเอง: จอย stick ขวา > เมาส์ (คีย์บอร์ด A) > ทิศที่เดิน
            let aim = inputAimVec(pi);
            if (aim) pl.angle = Math.atan2(aim.y, aim.x);
            else if (inputSlots[pi].device === "kb1") pl.angle = Math.atan2(mouseY - (pl.y - camera.y), mouseX - (pl.x - camera.x));
            else if (mv.x !== 0 || mv.y !== 0) pl.angle = Math.atan2(mv.y, mv.x);
            if (inputAttackHeld(pi) && pl.attackCooldown <= 0) performAttack(pl);
        }

        // [มินิแพส] หันหน้าเข้าหาเป้าเล็ง (เริ่มต้นหันซ้าย) + สถานะเดิน (ใช้กับ bob)
        let ca = Math.cos(pl.angle);
        if (ca > 0.25) pl.face = -1;
        else if (ca < -0.25) pl.face = 1;
        pl.moving = (pl.dashTimer > 0) || (mv.x !== 0 || mv.y !== 0);

        // [เฟส 3A-2] รั้งบังคับ: ห้ามหลุดออกนอกจอ (เมื่อซูม < 1 — ใช้กล้องเฟรมก่อนหน้า)
        if (camZoom < 1) {
            let lvW = VIEW_WIDTH / camZoom, lvH = VIEW_HEIGHT / camZoom;
            let m = 28;
            if (pl.x < camera.x + m) pl.x = camera.x + m;
            if (pl.x > camera.x + lvW - m) pl.x = camera.x + lvW - m;
            if (pl.y < camera.y + m) pl.y = camera.y + m;
            if (pl.y > camera.y + lvH - m) pl.y = camera.y + lvH - m;
        }
    });

    let commanders = [];
    enemies.forEach(e2 => {
        if (e2.elite && e2.elite.aura && e2.hp > 0) commanders.push(e2);
    });

    // ---- [แพตช์บาลานซ์] Performance safeguard: ตัดเก่าสุดเมื่อเกิน cap ----
    while (playerProjectiles.length > 200) playerProjectiles.shift();
    while (enemyProjectiles.length > 300) enemyProjectiles.shift();

    // ---- กระสุนผู้เล่น ----
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
        let p = playerProjectiles[i];
        if (p.type === "MISSILE" && p.target && p.target.hp > 0) {
            let ta = Math.atan2(p.target.y - p.y, p.target.x - p.x);
            let cur = Math.atan2(p.vy, p.vx);
            let diff = Math.atan2(Math.sin(ta - cur), Math.cos(ta - cur));
            let spd = Math.hypot(p.vx, p.vy);
            let na = cur + Math.max(-0.09, Math.min(0.09, diff));
            p.vx = Math.cos(na) * spd;
            p.vy = Math.sin(na) * spd;
        }
        p.x += p.vx; p.y += p.vy;
        if (p.type === "LASER") {
            p.travel += Math.hypot(p.vx, p.vy);
            if (p.travel > 460) { playerProjectiles.splice(i, 1); continue; }
        }
        if (p.type === "SHOTGUN" && Math.hypot(p.x - p.startX, p.y - p.startY) >= 200) { playerProjectiles.splice(i, 1); continue; }
        if (isWallTile(p.x, p.y)) {
            if (p.ricochet > 0 && p.type !== "MISSILE") {
                p.ricochet--;
                p.x -= p.vx; p.y -= p.vy;
                if (!ricochetRedirect(p, null)) {   // [แพตช์] มีศัตรู = บินหา / ไม่มี = ชิ่งกำแพงปกติ
                    if (isWallTile(p.x + Math.abs(p.vx) * 2, p.y)) p.vx = -p.vx;
                    else if (isWallTile(p.x, p.y + Math.abs(p.vy) * 2)) p.vy = -p.vy;
                    else { p.vx = -p.vx; p.vy = -p.vy; }
                }
                createSparks(p.x, p.y, "#00ffcc");
                playSynthSFX("click");
            } else {
                playerProjectiles.splice(i, 1);
                continue;
            }
        }

        let removed = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            let en = enemies[j];
            if (en.hp <= 0) continue;
            if (Math.hypot(p.x - en.x, p.y - en.y) < en.size / 2 + p.size) {

                // ===== LASER: ทะลุ + คริรายตัว + VAMP ครั้งเดียวต่อลำ =====
                if (p.type === "LASER") {
                    if (p.hits[en.uid]) continue;
                    p.hits[en.uid] = true;
                    strikeEnemy(en, p.damage, p.owner, true, p.forcedCrit);
                    createSparks(en.x, en.y, p.color);
                    if (p.owner.hp > 0 && p.owner.incendiaryLevel > 0) {   // [3C] ผีไม่ติดไฟ
                        let cfg = INCENDIARY_LEVELS[p.owner.incendiaryLevel];
                        applyBurnToEnemy(en, p.owner.damage * cfg.dpsPct, cfg.dur);
                    }
                    if (!p.vampDone) { p.vampDone = true; tryVampHeal(p.owner, vampHeal(p.owner)); }
                    if (evolved.laser) {
                        let pa = Math.atan2(p.y - en.y, p.x - en.x);
                        let nx2 = en.x + Math.cos(pa) * 3.5;
                        if (!blockedForEntity(nx2, en.y, en.size)) en.x = nx2;
                        let ny2 = en.y + Math.sin(pa) * 3.5;
                        if (!blockedForEntity(en.x, ny2, en.size)) en.y = ny2;
                    }
                    applyKnockbackToEnemy(en, Math.atan2(p.vy, p.vx), WEAPONS[p.owner.weaponType]);
                    continue;
                }

                // ===== [แพตช์] SHOTGUN = Piece_Bullet: ทะลุ + decay 100→70→50% + cap 3 =====
                if (p.type === "SHOTGUN" && p.hits) {
                    if (p.hits[en.uid]) continue;
                    p.hits[en.uid] = true;
                    p.hitCount = (p.hitCount || 0) + 1;

                    let decayMult = p.hitCount <= 3 ? BAL.BULLET.PELLET_DECAY[p.hitCount - 1] : 0.5;
                    let crit = strikeEnemy(en, p.damage * decayMult, p.owner, true, p.forcedCrit);
                    createSparks(en.x, en.y, p.color);
                    if (p.canVamp) tryVampHeal(p.owner, vampHeal(p.owner));

                    // STUN SHELLS + กรวยแตก (1 ครั้ง/ยิง — เฉพาะเม็ดกลาง)
                    if (p.owner.stunShellsLevel > 0) {
                        let st = en.status;
                        if (!st.pelletBlast || st.pelletBlast.id !== p.blastId) st.pelletBlast = { id: p.blastId, count: 0 };
                        st.pelletBlast.count++;
                        let cfg = STUN_SHELLS_LEVELS[p.owner.stunShellsLevel];
                        if (st.pelletBlast.count >= cfg.pellets && st.stunCd <= 0) {
                            st.stunCd = STUN_SHELLS.cooldown;
                            applyStunToEnemy(en, cfg.stunDur);
                        }
                        if (p.canVamp) {
                            let coneR = BAL.CLS.STUN_CONE_RANGE;
                            let coneDmg = p.damage * BAL.CLS.STUN_CONE_DMG;
                            let dir = Math.atan2(p.vy, p.vx);
                            enemies.forEach(o => {
                                if (o === en || o.hp <= 0) return;
                                let dx = o.x - en.x, dy = o.y - en.y;
                                if (Math.hypot(dx, dy) > coneR) return;
                                let ang = Math.atan2(dy, dx);
                                let diff = Math.atan2(Math.sin(ang - dir), Math.cos(ang - dir));
                                if (Math.abs(diff) < Math.PI / 4) damageEnemy(o, coneDmg);
                            });
                            particles.push({ type: "explosion", x: en.x, y: en.y, radius: coneR, life: 8, maxLife: 8, color: "rgba(255, 238, 102, 0.25)" });
                        }
                    }

                    // [ย้ายแล้ว] THUNDER MAW ไปอยู่ generic block (จุดที่ 2)

                    applyKnockbackToEnemy(en, Math.atan2(p.vy, p.vx), WEAPONS[p.owner.weaponType]);

                    // Cap 3 ตัว/เม็ด แล้วหาย
                    if (p.hitCount >= BAL.BULLET.PELLET_CAP) {
                        playerProjectiles.splice(i, 1);
                        removed = true;
                        break;
                    }
                    continue;
                }

                // ===== กระสุนอื่น (GUN/MISSILE: โดนแล้วหาย) =====
                let isPlayerSrc = (p.type === "GUN" || p.type === "SHOTGUN" || p.type === "MISSILE");
                let crit = strikeEnemy(en, p.damage, p.owner, true, p.forcedCrit);
                createSparks(en.x, en.y, p.color);

                // [แพตช์] THUNDER MAW: สายฟ้าเมื่อคริ — built-in ของ Normal_Bullet (GUN/TURRET)
                if (crit && (p.type === "GUN" || p.type === "TURRET")) {
                    let chained = 0;
                    enemies.forEach(o => {
                        if (o === en || o.hp <= 0 || chained >= BAL.CLS.THUNDER_CHAIN_N) return;
                        if (Math.hypot(o.x - en.x, o.y - en.y) < BAL.CLS.THUNDER_CHAIN_RANGE) {
                            chained++;
                            damageEnemy(o, p.damage * BAL.CLS.THUNDER_CHAIN_DMG);
                            particles.push({ type: "beam", x1: en.x, y1: en.y, x2: o.x, y2: o.y, life: 8, maxLife: 8, color: "#8be9fd" });
                        }
                    });
                }

                // [รอบ 1] VAMP ต่อการโจมตี — [เฟส 2B] รายเจ้าของ: GUN/MISSILE นับทุกนัด / SHOTGUN เฉพาะเม็ดกลาง
                if (isPlayerSrc) {
                    if (p.type === "SHOTGUN") { if (p.canVamp) tryVampHeal(p.owner, vampHeal(p.owner)); }
                    else tryVampHeal(p.owner, vampHeal(p.owner));
                }

                if (p.type === "GUN") {
                    if (p.owner.hp > 0 && (p.owner.incendiaryLevel > 0 || crit)) {   // [3C] ผีไม่ติดไฟ
                        let cfg = p.owner.incendiaryLevel > 0 ? INCENDIARY_LEVELS[p.owner.incendiaryLevel] : { dpsPct: 0.30, dur: 1.5 };
                        applyBurnToEnemy(en, p.owner.damage * cfg.dpsPct * (crit ? 1.5 : 1), cfg.dur);
                    }
                }

                if (p.type === "SHOTGUN" && crit) {
                    let chained = false;
                    enemies.forEach(o => {
                        if (chained || o === en || o.hp <= 0) return;
                        if (Math.hypot(o.x - en.x, o.y - en.y) < 110) {
                            damageEnemy(o, p.damage * 0.5);
                            particles.push({ type: "beam", x1: en.x, y1: en.y, x2: o.x, y2: o.y, life: 8, maxLife: 8, color: "#ffcc00" });
                            chained = true;
                        }
                    });
                }

                if (p.type === "SHOTGUN" && p.owner.stunShellsLevel > 0) {
                    let st = en.status;
                    if (!st.pelletBlast || st.pelletBlast.id !== p.blastId) st.pelletBlast = { id: p.blastId, count: 0 };
                    st.pelletBlast.count++;
                    let cfg = STUN_SHELLS_LEVELS[p.owner.stunShellsLevel];
                    if (st.pelletBlast.count >= cfg.pellets && st.stunCd <= 0) {
                        st.stunCd = STUN_SHELLS.cooldown;
                        applyStunToEnemy(en, cfg.stunDur);
                    }
                }

                if (p.type === "SHOTGUN" && evolved.shotgun) {
                    let chained = 0;
                    enemies.forEach(o => {
                        if (o === en || o.hp <= 0 || chained >= 2) return;
                        if (Math.hypot(o.x - en.x, o.y - en.y) < 130) {
                            chained++;
                            damageEnemy(o, p.damage * 0.4);
                            particles.push({ type: "beam", x1: en.x, y1: en.y, x2: o.x, y2: o.y, life: 8, maxLife: 8, color: "#8be9fd" });
                        }
                    });
                }

                if (p.type === "MISSILE") {
                    particles.push({ type: "explosion", x: p.x, y: p.y, radius: 50, life: 12, maxLife: 12, color: "rgba(255, 0, 85, 0.55)" });
                    playSynthSFX("explosion");
                    enemies.forEach(other => {
                        if (other === en || other.hp <= 0) return;
                        if (Math.hypot(other.x - p.x, other.y - p.y) <= 60) damageEnemy(other, p.damage * 0.5);
                    });
                }

                let kbAngle = Math.atan2(p.vy, p.vx);
                applyKnockbackToEnemy(en, kbAngle, WEAPONS[p.owner.weaponType]);

                // [แพตช์] Ricochet: ชิ่งศัตรู → บินหาเป้าถัดไป / หมด = หาย (จุดเดียวที่ลบกระสุน)
                if (p.ricochet > 0) {
                    p.ricochet--;
                    if (!ricochetRedirect(p, en)) {
                        let nx = p.x - en.x, ny = p.y - en.y;
                        let nl = Math.hypot(nx, ny) || 1;
                        nx /= nl; ny /= nl;
                        let dot = p.vx * nx + p.vy * ny;
                        if (dot < 0) {
                            p.vx -= 2 * dot * nx;
                            p.vy -= 2 * dot * ny;
                        }
                    }
                    createSparks(p.x, p.y, "#00ffcc");
                    playSynthSFX("click");
                } else {
                    playerProjectiles.splice(i, 1);
                    removed = true;
                }
                break;
                // [แพตช์] Ricochet: ชิ่งศัตรูแล้วบินต่อ (กันหายตามเลเวล)
                if (p.ricochet > 0) {
                    p.ricochet--;
                    if (!ricochetRedirect(p, en)) {   // [แพตช์] มีศัตรูถัดไป = บินหาเขา / ไม่มี = สะท้อนออก
                        let nx = p.x - en.x, ny = p.y - en.y;
                        let nl = Math.hypot(nx, ny) || 1;
                        nx /= nl; ny /= nl;
                        let dot = p.vx * nx + p.vy * ny;
                        if (dot < 0) {
                            p.vx -= 2 * dot * nx;
                            p.vy -= 2 * dot * ny;
                        }
                    }
                    createSparks(p.x, p.y, "#00ffcc");
                    playSynthSFX("click");
                } else {
                    playerProjectiles.splice(i, 1);
                    removed = true;
                }
                break;
            }
        }
        if (removed) continue;
    }

    // ---- ไมน์ (VAMP ครั้งเดียวต่อระเบิด) ----
    for (let i = mines.length - 1; i >= 0; i--) {
        let m = mines[i];
        let triggered = false;
        for (let j = 0; j < enemies.length; j++) {
            let en = enemies[j];
            if (en.typeKey === "BLOCK_OBSTACLE" || en.hp <= 0) continue;
            if (Math.hypot(en.x - m.x, en.y - m.y) < en.size / 2 + MINE_CFG.triggerRange) { triggered = true; break; }
        }
        if (!triggered) continue;
        let isShard = m.kind === "SHARD";
        let dmgMult = isShard ? MINE_CFG.shardDmgMult : MINE_CFG.dmgMult;
        particles.push({ type: "explosion", x: m.x, y: m.y, radius: MINE_CFG.radius, life: 16, maxLife: 16, color: isShard ? "rgba(123, 217, 255, 0.55)" : "rgba(255, 85, 0, 0.6)" });
        playSynthSFX("explosion");
        addShake(3, 0.2);
        let mOwn = m.owner || player;   // [เฟส 2B] ไมน์ของใคร
        let mineHitAny = false;
        enemies.forEach(en => {
            if (en.hp <= 0) return;
            if (Math.hypot(en.x - m.x, en.y - m.y) <= MINE_CFG.radius) {
                strikeEnemy(en, mOwn.damage * dmgMult, mOwn, true);
                mineHitAny = true;
                if (isShard) applyFreezeToEnemy(en, SHARD_MINE.freezeDur);
                else {
                    let kbAngle = Math.atan2(en.y - m.y, en.x - m.x);
                    applyKnockbackToEnemy(en, kbAngle, WEAPONS[mOwn.weaponType]);
                }
            }
        });
        if (mineHitAny) tryVampHeal(mOwn, vampHeal(mOwn));
        mines.splice(i, 1);
    }

    // ---- ศัตรู ----
    for (let i = enemies.length - 1; i >= 0; i--) {
        let en = enemies[i];
        let st = en.status || (en.status = createStatus());
        if (st.slow > 0) st.slow -= DT;
        if (st.slow <= 0) st.slowPct = 0;
        if (st.stun > 0) st.stun -= DT;
        if (st.stunCd > 0) st.stunCd -= DT;
        if (st.freeze > 0) st.freeze -= DT;
        if (st.burn > 0) {
            st.burn -= DT;
            en.hp -= st.burnDps * DT;
            if (Math.random() < 0.15) createSparks(en.x, en.y, "#ff9944");
            if (st.burn <= 0) st.burnDps = 0;
        }
        let isFrozen = st.freeze > 0 || st.stun > 0;

        if (en.typeKey === "HEALER" && !isFrozen && frameCount % 90 === 0) {
            let healedAny = false;
            enemies.forEach(o => {
                if (o === en || o.hp <= 0 || o.typeKey === "BLOCK_OBSTACLE") return;
                if (Math.hypot(o.x - en.x, o.y - en.y) < 160 && o.hp < o.maxHp) {
                    o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08);
                    createSparks(o.x, o.y, "#77ff77");
                    healedAny = true;
                }
            });
            if (healedAny) {
                particles.push({ type: "explosion", x: en.x, y: en.y, radius: 160, life: 12, maxLife: 12, color: "rgba(119, 255, 119, 0.10)" });
                playSynthSFX("heal");
            }
        }
        if (en.typeKey === "SHIELDER" && !isFrozen && frameCount % 120 === 0) {
            let gave = false;
            enemies.forEach(o => {
                if (o === en || o.hp <= 0 || o.typeKey === "BLOCK_OBSTACLE") return;
                if (Math.hypot(o.x - en.x, o.y - en.y) < 140) {
                    o.shield = Math.min(o.maxHp * 0.5, (o.shield || 0) + 3 + currentFloor);
                    gave = true;
                }
            });
            if (gave) {
                particles.push({ type: "explosion", x: en.x, y: en.y, radius: 140, life: 12, maxLife: 12, color: "rgba(102, 204, 255, 0.12)" });
                playSynthSFX("heal");
            }
        }

        let tgt = nearestPlayerTo(en.x, en.y) || player;   // [เฟส 2A] สัญญา co-op ข้อ 5: เล็งคนใกล้สุด
        let dist = Math.hypot(tgt.x - en.x, tgt.y - en.y);
        if (en.typeKey !== "BLOCK_OBSTACLE" && tgt && Math.abs(tgt.x - en.x) > 4) en.face = (tgt.x > en.x) ? -1 : 1;   // [มินิแพส] หันหน้าเข้าหาเป้าหมาย

        // ===== [รอบ 4] มอนแฮ็กวาร์ป: ถูกกำแพงกั้น (ไม่มี LoS) 5 วิ = วาร์ปเข้าใกล้ผู้เล่น =====
        if (!en.isBoss && en.typeKey !== "BLOCK_OBSTACLE" && !isFrozen && dist < 400) {
            if (en.repositionCd > 0) en.repositionCd -= DT;
            if (!hasLOS(en.x, en.y, tgt.x, tgt.y)) {
                en.frustration += DT;
                if (en.frustration >= 5 && en.repositionCd <= 0) {
                    let spot = null, fallback = null;
                    for (let t = 0; t < 30 && !spot; t++) {
                        let ang = Math.random() * Math.PI * 2;
                        let d = 200 + Math.random() * 80;
                        let s = findFreeTileNear(tgt.x + Math.cos(ang) * d, tgt.y + Math.sin(ang) * d);
                        if (!s) continue;
                        let mx2 = s.col * TILE_SIZE + TILE_SIZE / 2, my2 = s.row * TILE_SIZE + TILE_SIZE / 2;
                        if (blockedForEntity(mx2, my2, en.size)) continue;
                        if (hasLOS(mx2, my2, tgt.x, tgt.y)) spot = { x: mx2, y: my2 };
                        else if (!fallback) fallback = { x: mx2, y: my2 };
                    }
                    if (!spot) spot = fallback;
                    if (spot) {
                        particles.push({ type: "explosion", x: en.x, y: en.y, radius: en.size, life: 10, maxLife: 10, color: "rgba(0,255,255,0.35)" });
                        en.x = spot.x; en.y = spot.y;
                        particles.push({ type: "explosion", x: en.x, y: en.y, radius: en.size, life: 10, maxLife: 10, color: "rgba(0,255,255,0.35)" });
                        createSparks(en.x, en.y, "#7df9ff");
                        playSynthSFX("warp");
                    }
                    en.frustration = 0;
                    en.repositionCd = 10;
                }
            } else {
                en.frustration = 0;
            }
        }

        // ===== [รอบ 3] เฟส 2: OVERLORD + DEVIL CORE — ดรอปหัวใจใหญ่ =====
        if ((en.typeKey === "BOSS_OVERLORD" || en.typeKey === "BOSS_DEVILCORE") && en.phase === 1 && en.hp > 0 && en.hp <= en.maxHp * 0.5) {
            en.phase = 2;
            en.speed *= (en.typeKey === "BOSS_DEVILCORE" ? 1.2 : 1.3);
            en.pState = "recover"; en.pTimer = 40;
            let isDevil = en.typeKey === "BOSS_DEVILCORE";
            announce(isDevil ? "☠ DEVIL CORE ENRAGED ☠" : "☠ OVERLORD ENRAGED ☠", "#ff5577");
            playSynthSFX("heavy_explosion");
            addHitStop(6); addShake(9, 0.45);
            items.push({ x: en.x, y: en.y - 30, type: "HEART_BIG", icon: "💗", size: 20 });
        }

        // ---- ตาย ----
        if (en.hp <= 0) {
            if (en.parentSpawner && en.parentSpawner.currentAlive) {
                let typeKey = en.typeKey;
                if (en.parentSpawner.currentAlive[typeKey] > 0) en.parentSpawner.currentAlive[typeKey]--;
            }
            if (en.typeKey !== "BLOCK_OBSTACLE") {
                kills++;
                stats.kills++;
                if (stats.kills === 1) unlockAch("first_blood");
                if (stats.kills >= 1000) unlockAch("exterminator");
                killStreak++;
                streakTimer = 3;
                let sMult = runMods.scoreMult * (1 + Math.min(10, killStreak) * 0.1);
                let gained = Math.round(en.score * (en.elite ? 2 : 1) * sMult);
                score += gained;
                let expShare = Math.max(1, Math.round(gained * (1 + BAL.ECO.COOP_SPLIT * (players.length - 1)) / players.length));
                players.forEach(pp => { pp.xp += expShare; });
            }
            playSynthSFX("explosion");
            particles.push({ type: "explosion", x: en.x, y: en.y, radius: en.size, life: 12, maxLife: 12, color: "rgba(255, 68, 0, 0.5)" });

            if (en.typeKey === "SPLITTER") {
                for (let s2 = 0; s2 < 2; s2++) {
                    spawnMinionAt("SPLITTER_SMALL", en.x + (s2 ? 26 : -26), en.y + (Math.random() - 0.5) * 20, en.parentSpawner, false);
                }
                createSparks(en.x, en.y, "#9dff9d");
            }

            if (en.elite && en.elite.explode) {
                particles.push({ type: "explosion", x: en.x, y: en.y, radius: 110, life: 16, maxLife: 16, color: "rgba(255, 146, 61, 0.65)" });
                playSynthSFX("explosion");
                addShake(3, 0.2);
                enemies.forEach(o => {
                    if (o === en || o.hp <= 0) return;
                    if (Math.hypot(o.x - en.x, o.y - en.y) < 110) damageEnemy(o, o.maxHp * 0.15);
                });
                players.forEach(pl => {
                    if (Math.hypot(pl.x - en.x, pl.y - en.y) < 110) damagePlayer(pl, Math.round(15 * enemyDmgMult()));
                });
            }
            if (en.elite && en.elite.gold) {
                for (let g = 0; g < en.elite.gold; g++) {
                    items.push({ x: en.x + (Math.random() - 0.5) * 50, y: en.y + (Math.random() - 0.5) * 50, type: "COIN", icon: "💰", size: 16 });
                }
            }

            if (en.arenaRef) {
                en.arenaRef.remaining--;
                if (en.arenaRef.remaining <= 0 && !en.arenaRef.cleared) {
                    en.arenaRef.cleared = true;
                    let a = en.arenaRef;
                    announce("⚔ ARENA CLEARED — REWARD! ⚔", "#ffd700");
                    items.push({ x: a.x, y: a.y, type: "COIN_BIG", icon: "💵", size: 22, value: 120 + currentFloor * 8 });
                    items.push({ x: a.x + 32, y: a.y, type: "CORE", icon: "🔴", size: 18 });
                    items.push({ x: a.x - 32, y: a.y, type: "HEART", icon: "❤️", size: 14 });
                    particles.push({ type: "explosion", x: a.x, y: a.y, radius: 130, life: 20, maxLife: 20, color: "rgba(255, 215, 0, 0.4)" });
                    playSynthSFX("levelup");
                }
            }

            if (en.isBoss) {
                if (en.parentSpawner) en.parentSpawner.bossKilled = true;
                stats.bosses++;
                if (stats.bosses >= 10) unlockAch("boss_slayer");
                addHitStop(4); addShake(6, 0.35);
                items.push({ x: en.x, y: en.y, type: "EXP", icon: "⚡", size: 20 });
                let isOverlord = en.typeKey === "BOSS_OVERLORD";
                let isDevil = en.typeKey === "BOSS_DEVILCORE";
                items.push({ x: en.x + 26, y: en.y, type: "COIN_BIG", icon: "💵", size: 22, value: isDevil ? 300 + currentFloor * 15 : isOverlord ? 150 + currentFloor * 10 : 50 + currentFloor * 5 });
                let coreCount = isDevil ? 10 : isOverlord ? 5 : 1;
                for (let c2 = 0; c2 < coreCount; c2++) {
                    items.push({ x: en.x + (Math.random() - 0.5) * 80, y: en.y + (Math.random() - 0.5) * 80, type: "CORE", icon: "🔴", size: 18 });
                }
                let extraCoins = isDevil ? 6 : isOverlord ? 4 : 0;
                for (let c3 = 0; c3 < extraCoins; c3++) {
                    items.push({ x: en.x + (Math.random() - 0.5) * 110, y: en.y + (Math.random() - 0.5) * 110, type: "COIN", icon: "💰", size: 16 });
                }
                if (isOverlord) unlockAch("overlord_killer");
                if (isDevil) {
                    unlockAch("devilcore");
                    announce("☠ YOUR MIRROR SHATTERED — 10 CORE ☠", "#ff00aa");
                }
                particles.push({ type: "text", x: en.x, y: en.y - 30, text: isDevil ? "DEVIL CORE TERMINATED" : isOverlord ? "OVERLORD TERMINATED" : "BOSS TERMINATED", life: 70, maxLife: 70, color: "#ff5577", vy: -0.7 });
                if (!portalItemSpawned && allBossesKilled()) {
                    portalItemSpawned = true;
                    items.push({ x: en.x, y: en.y, type: "PORTAL", icon: "🌀", size: 24, delay: 75 });
                    particles.push({ type: "text", x: en.x, y: en.y - 55, text: "WARP GATE ONLINE", life: 90, maxLife: 90, color: "#00ffcc", vy: -0.5 });
                    playSynthSFX("warp");
                }
            } else if (en.typeKey !== "BLOCK_OBSTACLE") {
                rollDrop(en.x, en.y);
            }
            enemies.splice(i, 1);
            checkXp();
            continue;
        }

        let bossIdle = !en.isBoss || en.pState === "idle";
        if (en.isRanged && !isFrozen && bossIdle) {
            en.shootTimer++;
            if (en.shootTimer >= en.shootCooldown && dist < 340) {
                en.shootTimer = 0;
                let a = Math.atan2(tgt.y - en.y, tgt.x - en.x);
                enemyProjectiles.push({ x: en.x, y: en.y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, damage: en.bulletDamage || 8, color: en.bulletColor, size: 6, life: 300, homing: false });
                playSynthSFX("shoot");
            }
        }

        if (en.kbTimer > 0) {
            en.kbTimer--;
            let nx = en.x + en.kbVx;
            if (!blockedForEntity(nx, en.y, en.size)) en.x = nx;
            let ny = en.y + en.kbVy;
            if (!blockedForEntity(en.x, ny, en.size)) en.y = ny;
            en.kbVx *= 0.85; en.kbVy *= 0.85;
        } else if (en.speed > 0) {
            let hold = en.isBoss ? updateBossAI(en, dist) : false;
            if (!hold) {
                let toPlayer = Math.atan2(tgt.y - en.y, tgt.x - en.x);
                // [แพตช์พฤติกรรม] มอนระยะไกล/ซัพพอร์ต ถอยเมื่อผู้เล่นเข้าใกล้ (<200px)
                // ความเร็วถอยต่างกันตาม blueprint: HEALER 1.1 > RANGED 1.0 > SHIELDER 0.9
                if ((en.typeKey === "HEALER" || en.typeKey === "RANGED" || en.typeKey === "SHIELDER") && dist < 200) toPlayer += Math.PI;
                if (frameCount % 30 === 0) {
                    let moved = Math.hypot(en.x - en.lastX, en.y - en.lastY);
                    if (moved < 2 && !isFrozen && dist > en.size + tgt.size) en.stuckTimer += 30;
                    en.lastX = en.x; en.lastY = en.y;
                }
                let moveAngle = toPlayer;
                if (en.detourTimer > 0) {
                    en.detourTimer--;
                    moveAngle = en.detourAngle;
                    if (en.detourTimer % 10 === 0 && !pathBlocked(en.x, en.y, toPlayer, en.size + 30)) en.detourTimer = Math.min(en.detourTimer, 5);
                } else if (pathBlocked(en.x, en.y, toPlayer, en.size + 24)) {
                    let detour = findWalkableDetour(en);
                    if (detour === null) en.detourAngle = toPlayer + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + Math.random() * 0.6);
                    else en.detourAngle = detour;
                    en.detourTimer = 40;
                    moveAngle = en.detourAngle;
                }
                if (en.stuckTimer > 25) {
                    en.stuckTimer = 0;
                    unstuckEntity(en);
                    if (en.detourTimer <= 0) {
                        let detour = findWalkableDetour(en);
                        en.detourAngle = detour !== null ? detour : toPlayer + (Math.random() < 0.5 ? 1 : -1) * Math.PI;
                        en.detourTimer = 45;
                    }
                }
                let slowTotal = Math.min(0.8, st.slowPct + runMods.enemySlowPct);
                let auraBoost = 1;
                if (commanders.length && (!en.elite || !en.elite.aura)) {
                    for (let ci = 0; ci < commanders.length; ci++) {
                        if (Math.hypot(commanders[ci].x - en.x, commanders[ci].y - en.y) < 160) { auraBoost = 1.25; break; }
                    }
                }
                let effSpeed = isFrozen ? 0 : en.speed * (1 - slowTotal) * auraBoost;
                en.moving = effSpeed > 0;   // [มินิแพส] ใช้กับ bob
                let vx = Math.cos(moveAngle) * effSpeed;
                let vy = Math.sin(moveAngle) * effSpeed;
                let nx = en.x + vx;
                if (!blockedForEntity(nx, en.y, en.size)) en.x = nx; else en.stuckTimer += 0.5;
                let ny = en.y + vy;
                if (!blockedForEntity(en.x, ny, en.size)) en.y = ny; else en.stuckTimer += 0.5;
            }
        }

        if (frameCount % 25 === 0) {
            players.forEach(pl => {   // [เฟส 2A] ชนใคร = ดาเมจคนนั้น
                if (Math.hypot(pl.x - en.x, pl.y - en.y) < en.size / 2 + pl.size) damagePlayer(pl, en.damage);
            });
        }

        if (en.typeKey !== "BLOCK_OBSTACLE" && frameCount % 25 === 0) {
            for (let k = 0; k < deployables.length; k++) {
                let dep = deployables[k];
                if (dep.kind === "STAND") continue;
                if (Math.hypot(en.x - dep.x, en.y - dep.y) < en.size / 2 + dep.size / 2) {
                    dep.hp -= en.damage;
                    createSparks(dep.x, dep.y, "#ff9944");
                }
            }
        }
    }

    // ---- กระสุนศัตรู ----
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        let b = enemyProjectiles[i];
        if (b.homing) {
            let ht = nearestPlayerTo(b.x, b.y) || player;   // [เฟส 2A] โฮมหาคนใกล้สุด
            let ta = Math.atan2(ht.y - b.y, ht.x - b.x);
            let cur = Math.atan2(b.vy, b.vx);
            let diff = Math.atan2(Math.sin(ta - cur), Math.cos(ta - cur));
            let spd = Math.hypot(b.vx, b.vy);
            let na = cur + Math.max(-0.045, Math.min(0.045, diff));
            b.vx = Math.cos(na) * spd;
            b.vy = Math.sin(na) * spd;
        }
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.life <= 0 || isWallTile(b.x, b.y)) { enemyProjectiles.splice(i, 1); continue; }
        let hitDep = false;
        for (let k = 0; k < deployables.length; k++) {
            let dep = deployables[k];
            if (dep.kind === "STAND") continue;
            if (Math.hypot(b.x - dep.x, b.y - dep.y) < b.size / 2 + dep.size / 2) {
                dep.hp -= b.damage;
                createSparks(dep.x, dep.y, "#ff9944");
                enemyProjectiles.splice(i, 1);
                hitDep = true;
                break;
            }
        }
        if (hitDep) continue;
        let hitPl = null;   // [เฟส 2A] กระสุนโดนผู้เล่นคนแรกที่สัมผัส
        for (let pi = 0; pi < players.length; pi++) {
            if (players[pi].hp <= 0) continue;   // [3C-fix] ผีไม่กินกระสุน (ไม่ใช่โล่) — ทะลุไปโดนคนที่ยังมีชีวิต
            if (Math.hypot(b.x - players[pi].x, b.y - players[pi].y) < b.size / 2 + players[pi].size) { hitPl = players[pi]; break; }
        }
        if (hitPl) {
            damagePlayer(hitPl, b.damage);
            enemyProjectiles.splice(i, 1);
        }
    }

    updateDeployables();
    processShatters();

    // ---- particles ----
    for (let i = particles.length - 1; i >= 0; i--) {
        let pt = particles[i];
        pt.life--;
        if (pt.type === "spark" || pt.type === "amb") { pt.x += pt.vx; pt.y += pt.vy; }   // [เฟส A2]
        if ((pt.type === "text" || pt.type === "dmg") && pt.vy) pt.y += pt.vy;
        if (pt.type === "dmg" && pt.life <= 0) dmgNumActive--;
        if (pt.life <= 0) particles.splice(i, 1);
    }

    // ---- ไอเทม ---- [เฟส 3A] ผู้เล่นที่ยังมีชีวิตและใกล้สุด = ผู้เก็บ
    for (let i = items.length - 1; i >= 0; i--) {
        let it = items[i];
        let toucher = null, dist = Infinity;
        players.forEach(pl => {
            if (pl.hp <= 0) return;
            let d = Math.hypot(it.x - pl.x, it.y - pl.y);
            if (d < dist) { dist = d; toucher = pl; }
        });

        if (it.type === "PORTAL") {
            if (it.delay > 0) it.delay--;
            else if (toucher && dist < toucher.size + it.size) {
                items.splice(i, 1);
                startWarp();
            }
            continue;
        }
        if (it.type === "DEVIL") {
            if (toucher && dist < toucher.size + it.size) {
                items.splice(i, 1);
                applyDevilDeal(toucher);
            }
            continue;
        }

        if (!runMods.magnetOff && toucher && !toucher.magnetOff && dist < toucher.magnetRadius && dist > 1) {   // [3B-3] แม่เหล็กถูกสาปรายคน
            let a = Math.atan2(toucher.y - it.y, toucher.x - it.x);
            let pull = Math.min(6, 2 + (toucher.magnetRadius - dist) * 0.06);
            it.x += Math.cos(a) * pull;
            it.y += Math.sin(a) * pull;
        }

        if (toucher && dist < toucher.size + it.size) {
            if (it.type === "HEART") {
                let amt = heartHealAmount();
                toucher.hp = Math.min(toucher.maxHp, toucher.hp + amt);
                particles.push({ type: "text", x: it.x, y: it.y, text: "+" + amt + " HP", life: 40, maxLife: 40, color: "#77ff77", vy: -0.6 });
            } else if (it.type === "HEART_BIG") {
                let amt = Math.round(toucher.maxHp * 0.3);
                toucher.hp = Math.min(toucher.maxHp, toucher.hp + amt);
                particles.push({ type: "text", x: it.x, y: it.y, text: "💗 +" + amt + " HP", life: 60, maxLife: 60, color: "#ff7bd9", vy: -0.6 });
                playSynthSFX("levelup");
            } else if (it.type === "COIN") {
                let val = Math.round(MONSTER_DROPS.coinValue * runMods.coinMult * (1 + BAL.ECO.COOP_SPLIT * (players.length - 1)) / players.length);
                players.forEach(pl => { pl.coins += val; });
                particles.push({ type: "text", x: it.x, y: it.y, text: "COIN +" + val, life: 45, maxLife: 45, color: "#ffd700", vy: -0.6 });
                playSynthSFX("click");
                if (players.some(p => p.coins >= 300)) unlockAch("rich");
            } else if (it.type === "COIN_BIG") {
                let bigShare = Math.round(it.value * (1 + BAL.ECO.COOP_SPLIT * (players.length - 1)) / players.length);
                players.forEach(pl => { pl.coins += bigShare; });
                particles.push({ type: "text", x: it.x, y: it.y, text: "💰 +" + it.value + " COINS", life: 60, maxLife: 60, color: "#ffd700", vy: -0.6 });
                playSynthSFX("levelup");
                if (players.some(p => p.coins >= 300)) unlockAch("rich");
            } else if (it.type === "CORE") {
                cores++;
                saveMeta();
                toasts.push({ title: "🔴 +1 CORE", sub: "สะสมถาวร: " + cores + " CORE (ใช้ปลดล็อกที่หน้าเริ่มเกม)", life: 150, maxLife: 150 });
                playSynthSFX("levelup");
            } else if (it.type === "EXP") {
                let gain = Math.max(1, Math.ceil(player.xpNext * BOSS_EXP_PCT));
                let expShare = Math.max(1, Math.round(gain * (1 + BAL.ECO.COOP_SPLIT * (players.length - 1)) / players.length));
                players.forEach(pp => { pp.xp += expShare; });
                particles.push({ type: "text", x: it.x, y: it.y, text: "+" + gain + " XP", life: 55, maxLife: 55, color: "#7bd9ff", vy: -0.6 });
                playSynthSFX("levelup");
                checkXp();
            } else if (it.type === "BUFF_SHIELD") {
                toucher.shield += toucher.maxHp * 2;
                toucher.buffs.shield = BUFF_DUR;
                particles.push({ type: "text", x: it.x, y: it.y, text: "SHIELD x2HP!", life: 55, maxLife: 55, color: "#66ccff", vy: -0.6 });
                playSynthSFX("levelup");
            } else if (it.type === "BUFF_FIRE") {
                toucher.buffs.firerate = BUFF_DUR;
                recalcStats();
                particles.push({ type: "text", x: it.x, y: it.y, text: "FIRERATE +2", life: 55, maxLife: 55, color: "#ffcc00", vy: -0.6 });
                playSynthSFX("levelup");
            } else if (it.type === "BUFF_DMG") {
                toucher.buffs.dmg = BUFF_DUR;
                recalcStats();
                particles.push({ type: "text", x: it.x, y: it.y, text: "DMG +2", life: 55, maxLife: 55, color: "#ff5577", vy: -0.6 });
                playSynthSFX("levelup");
            } else if (it.type === "BUFF_SPD") {
                toucher.buffs.speed = BUFF_DUR;
                recalcStats();
                particles.push({ type: "text", x: it.x, y: it.y, text: "SPEED +2", life: 55, maxLife: 55, color: "#3dff8c", vy: -0.6 });
                playSynthSFX("levelup");
            }
            items.splice(i, 1);
        }
    }
}
// ================== ลูกศรชี้ไอเทมนอกจอ ==================
function drawOffscreenArrows() {
    let colors = { PORTAL: "#00ffcc", CORE: "#ff3c5a", DEVIL: "#c77dff", EXP: "#7bd9ff", COIN_BIG: "#ffd700", ARENA: "#ff923d", HEART_BIG: "#ff7bd9" };
    let m = 26, cx = VIEW_WIDTH / 2, cy = VIEW_HEIGHT / 2;
    let pulse = 0.6 + Math.sin(gameTime * 6) * 0.3;
    let targets = [];
    items.forEach(it => {
        if (colors[it.type]) targets.push(it);
    });
    arenas.forEach(a => { if (!a.cleared) targets.push({ x: a.x, y: a.y, type: "ARENA" }); });
    targets.forEach(t => {
        let sx = (t.x - camera.x) * camZoom, sy = (t.y - camera.y) * camZoom;   // [เฟส 3A-2] พิกัดจอจริงหลังซูม
        if (sx > m && sx < VIEW_WIDTH - m && sy > m && sy < VIEW_HEIGHT - m) return;
        let dx = sx - cx, dy = sy - cy;
        let tx = dx !== 0 ? (VIEW_WIDTH / 2 - m) / Math.abs(dx) : Infinity;
        let ty = dy !== 0 ? (VIEW_HEIGHT / 2 - m) / Math.abs(dy) : Infinity;
        let tt = Math.min(tx, ty);
        let px = cx + dx * tt, py = cy + dy * tt;
        let ang = Math.atan2(dy, dx);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = colors[t.type];
        ctx.beginPath();
        ctx.moveTo(11, 0); ctx.lineTo(-7, -7); ctx.lineTo(-7, 7);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
    });
}