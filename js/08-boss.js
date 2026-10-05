"use strict";

// ================== BOSS AI ==================
function startBossTele(en, kind) {
    en.pState = "tele";
    en.teleKind = kind;
    // [รอบ 3] telegraph เฟส 2: 30 -> 40 เฟรม (หน้าต่างตอบสนองกว้างขึ้นตอนดาเมจหนัก)
    en.pTimer = en.phase === 2 ? BAL.BOSS_SKILL.TELEGRAPH_P2 : BAL.BOSS_SKILL.TELEGRAPH;   // [v10-6]
    let bt = nearestPlayerTo(en.x, en.y) || player;   // [เฟส 2A]
    en.pAngle = Math.atan2(bt.y - en.y, bt.x - en.x);
    playSynthSFX("click");
}
function bossBullet(en, ang, spd, opt) {
    opt = opt || {};
    enemyProjectiles.push({
        x: en.x, y: en.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        damage: opt.damage || en.bulletDamage || 12, color: opt.color || en.bulletColor || "#ff7777",
        size: opt.size || 6, life: opt.life || 300, homing: !!opt.homing
    });
}
function executeBossAttack(en) {
    let recT = en.phase === 2 ? BAL.BOSS_SKILL.RECOVER_P2 : BAL.BOSS_SKILL.RECOVER;   // [v10-7]
    switch (en.teleKind) {
        case "charge":
            en.pState = "dash"; en.pTimer = BAL.BOSS_SKILL.DASH_FRAMES;
            let sp = en.speed * BAL.BOSS_SKILL.DASH_SPEED * (en.phase === 2 ? BAL.BOSS_SKILL.DASH_SPEED_P2 : 1);   // [v10-8]
            en.dashVx = Math.cos(en.pAngle) * sp;
            en.dashVy = Math.sin(en.pAngle) * sp;
            playSynthSFX("missile_heavy");
            break;
        case "burst": {
            let n = en.typeKey === "BOSS_OVERLORD" ? (en.phase === 2 ? BAL.BOSS_SKILL.BURST_N + 8 : BAL.BOSS_SKILL.BURST_N + 2) : BAL.BOSS_SKILL.BURST_N;   // [v10-9] OVERLORD = 12/18
            // [v18-7] CYBERMAGE/DEVILCORE: วงดูดพลังหดเข้า 2 รอบก่อนปล่อย (OVERLORD ข้าม — มีพอร์ทัลของตัวเองแล้ว)
            if (en.typeKey !== "BOSS_OVERLORD") {
                particles.push({ type: "ring", x: en.x, y: en.y, radius: en.size + 34, maxRadius: en.size * 0.4, life: 10, maxLife: 10, color: "#00ffff", width: 2 });   // หดเข้า (radius > maxRadius)
                particles.push({ type: "ring", x: en.x, y: en.y, radius: en.size + 20, maxRadius: en.size * 0.4, life: 14, maxLife: 14, color: "#ffffff", width: 1.5 });
            }
            for (let i = 0; i < n; i++) bossBullet(en, (i / n) * Math.PI * 2 + Math.random() * 0.2, BAL.BOSS_SKILL.BULLET_SPD);
            playSynthSFX("heavy_explosion");
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "summon": {
            let k = en.typeKey === "BOSS_OVERLORD" ? (en.phase === 2 ? BAL.BOSS_SKILL.SUMMON_N_P2 : BAL.BOSS_SKILL.SUMMON_N) : (en.typeKey === "BOSS_MELEE" ? BAL.BOSS_SKILL.SUMMON_N : BAL.BOSS_SKILL.SUMMON_N - 1);   // [v10-10] CYBERMAGE/DEVILCORE = 2
            if (enemies.length < BAL.BOSS_SKILL.SUMMON_CAP) {   // [v14]
                let smCol = en.typeKey === "BOSS_MELEE" ? "#3dff8c" : "#ff5577";   // [v18-8] ฟักไข่เขียว (DRAGON) / อัญเชิญแดง (ตัวอื่น)
                for (let i = 0; i < k; i++) {
                    let mx = en.x + (Math.random() - 0.5) * 90, my = en.y + (Math.random() - 0.5) * 90;
                    let key = Math.random() < 0.5 ? "NORMAL" : (Math.random() < 0.5 ? "SPEEDY" : "RANGED");
                    let m = spawnMinionAt(key, mx, my, en.parentSpawner, false);
                    particles.push({ type: "ring", x: mx, y: my, radius: 4, maxRadius: 34, life: 12, maxLife: 12, color: smCol, width: 2 });   // มอนเกิดพร้อมวงเรืองแสง
                }
                createSparks(en.x, en.y, smCol);
                particles.push({ type: "ring", x: en.x, y: en.y, radius: en.size, maxRadius: 6, life: 14, maxLife: 14, color: smCol, width: 2 });   // แสงหดเข้าที่ตัวบอส
            }
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "teleport": {
            let ang = Math.random() * Math.PI * 2, d = BAL.BOSS_SKILL.TELEPORT_MIN + Math.random() * BAL.BOSS_SKILL.TELEPORT_VAR;   // [v14]
            let tt = nearestPlayerTo(en.x, en.y) || player;   // [เฟส 2A]
            let spot = findFreeTileNear(tt.x + Math.cos(ang) * d, tt.y + Math.sin(ang) * d);
            if (spot) {
                // [v18-6] teleport แยกสไตล์: CYBERMAGE = สลาย/ประกอบพิกเซลฟ้า | OVERLORD = บิดอวกาศ + กระแทกพื้น
                if (en.typeKey === "BOSS_CYBERMAGE") {
                    for (let i = 0; i < 14; i++) {   // สลายร่าง: จุดพิกเซลกระจายออก
                        let pa = Math.random() * Math.PI * 2, ps = 1 + Math.random() * 2.5;
                        particles.push({ type: "spark", x: en.x + (Math.random() - 0.5) * en.size * 0.7, y: en.y + (Math.random() - 0.5) * en.size * 0.7, vx: Math.cos(pa) * ps, vy: Math.sin(pa) * ps, size: 2 + Math.random() * 2.5, life: 12 + Math.random() * 8, color: "#00ffff" });
                    }
                } else if (en.typeKey === "BOSS_OVERLORD") {
                    for (let i = 0; i < 3; i++) particles.push({ type: "ring", x: en.x, y: en.y, radius: en.size * (1.1 - i * 0.3), maxRadius: 6, life: 12 + i * 4, maxLife: 12 + i * 4, color: i % 2 ? "#ffffff" : "#ff0055", width: 2 });   // บิด: วงหดเข้าหาตัว
                }
                en.x = spot.col * TILE_SIZE + TILE_SIZE / 2;
                en.y = spot.row * TILE_SIZE + TILE_SIZE / 2;
                if (en.typeKey === "BOSS_CYBERMAGE") {
                    for (let i = 0; i < 14; i++) {   // ประกอบร่าง: จุดพิกเซลวิ่งเข้าหากัน (ใกล้ศูนย์กลาง)
                        let pa = Math.random() * Math.PI * 2, pr = 20 + Math.random() * 30;
                        particles.push({ type: "spark", x: en.x + Math.cos(pa) * pr, y: en.y + Math.sin(pa) * pr, vx: -Math.cos(pa) * 1.8, vy: -Math.sin(pa) * 1.8, size: 2 + Math.random() * 2.5, life: 10 + Math.random() * 6, color: "#00ffff" });
                    }
                    en.mageAngle = Math.atan2(tt.y - en.y, tt.x - en.x);   // [v17] เวท MAGE หลังวาร์ป
                    en.mageKind = Math.random() < 0.6 ? "fire" : "frost";
                    mageCast(en, tt);
                } else if (en.typeKey === "BOSS_OVERLORD") {
                    particles.push({ type: "ring", x: en.x, y: en.y, radius: 16, maxRadius: en.size * 1.4, life: 16, maxLife: 16, color: "#ff0055", width: 3.5 });   // กระแทกพื้น: วงแดงขยายใหญ่
                    addShake(4, 0.25);
                    for (let i = 0; i < BAL.BOSS_SKILL.TELEPORT_RING_N; i++) bossBullet(en, (i / BAL.BOSS_SKILL.TELEPORT_RING_N) * Math.PI * 2, BAL.BOSS_SKILL.RING_SPD);   // [v14]
                }
            }
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "spiral":
            en.pState = "spiral"; en.pTimer = BAL.BOSS_SKILL.SPIRAL_DURATION; en.spiralAng = Math.random() * 6.28;   // [v10-11]
            break;
        case "slashNova": {
            particles.push({ type: "slash", x: en.x, y: en.y, radius: BAL.BOSS_SKILL.SLASH_RADIUS, angle: 0, arc: Math.PI * 2, life: 12, maxLife: 12, color: "rgba(255, 0, 170, 0.4)" });
            playSynthSFX("heavy_explosion");
            players.forEach(pl => {   // [เฟส 2A] โดนทุกคนที่อยู่ในรัศมี
                if (Math.hypot(pl.x - en.x, pl.y - en.y) < BAL.BOSS_SKILL.SLASH_RADIUS + pl.size) damagePlayer(pl, en.damage);   // [v10-12]
            });
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "homing": {
            let hm = nearestPlayerTo(en.x, en.y) || player;   // [เฟส 2A]
            for (let i = 0; i < BAL.BOSS_SKILL.HOMING_N; i++) {
                let ang = Math.atan2(hm.y - en.y, hm.x - en.x) + (i - (BAL.BOSS_SKILL.HOMING_N - 1) / 2) * BAL.BOSS_SKILL.HOMING_SPREAD;   // [v14]
                bossBullet(en, ang, BAL.BOSS_SKILL.HOMING_SPD, { homing: true, size: 7, life: 260, color: "#ff5577" });   // [v10-13]
                // [v18-10] trail จรวด: จุดส้มตามหลังมิสไซล์บอส (เห็นว่าเป็นโฮมมิสไซล์ ไม่ใช่ลูกกลมเฉยๆ)
                for (let s = 0; s < 3; s++) {
                    particles.push({ type: "spark", x: en.x + Math.cos(ang) * 14, y: en.y + Math.sin(ang) * 14, vx: -Math.cos(ang) * (0.5 + s * 0.4) + (Math.random() - 0.5), vy: -Math.sin(ang) * (0.5 + s * 0.4) + (Math.random() - 0.5), size: 2 + Math.random() * 2, life: 10 + Math.random() * 6, color: s === 0 ? "#ff7733" : "#ffaa33" });
                }
            }
            playSynthSFX("missile");
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "fan": {
            // [v10-5] พัดกระสุน: 9 เม็ดกระจายจากมุมที่ล็อกตอนเตือน (เดิมท่าเปล่า — มีแต่เสียง)
            let fn = BAL.BOSS_SKILL.FAN_N;
            // [v18-9] ฟีลลูกซอง: ถอยหลังตามแรงระเบิด (recoil สั้นๆ ผ่าน knockback ของตัวเอง) + เปลวส้มที่จุดยิง
            en.kbVx = -Math.cos(en.pAngle) * 3;
            en.kbVy = -Math.sin(en.pAngle) * 3;
            en.kbTimer = 6;
            for (let f = 0; f < 5; f++) {
                let fa = en.pAngle + (Math.random() - 0.5) * BAL.BOSS_SKILL.FAN_SPREAD * fn;
                particles.push({ type: "spark", x: en.x + Math.cos(en.pAngle) * en.size * 0.4, y: en.y + Math.sin(en.pAngle) * en.size * 0.4, vx: Math.cos(fa) * 3, vy: Math.sin(fa) * 3, size: 2.5 + Math.random() * 2, life: 8 + Math.random() * 5, color: "#ffaa33" });
            }
            for (let i = 0; i < fn; i++) {
                let ang = en.pAngle + (i - (fn - 1) / 2) * BAL.BOSS_SKILL.FAN_SPREAD;
                bossBullet(en, ang, BAL.BOSS_SKILL.FAN_SPD);
            }
            playSynthSFX("shotgun");
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "beam": {
            let bm = nearestPlayerTo(en.x, en.y) || player;   // [เฟส 2A]
            let base = Math.atan2(bm.y - en.y, bm.x - en.x);
            for (let i = -1; i <= 1; i++) {
                bossBullet(en, base + i * BAL.BOSS_SKILL.BEAM_SPREAD, BAL.BOSS_SKILL.BEAM_SPD, { size: 14, damage: (en.bulletDamage || 16) * BAL.BOSS_SKILL.BEAM_DMG_MULT, color: "#ff2e88", life: 200 });   // [v14]
            }
            playSynthSFX("missile_screamer");
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
    }
}
function updateBossAI(en, dist) {
    if (en.pState === "tele") {
        en.pTimer--;
        if (en.pTimer <= 0) executeBossAttack(en);
        return true;
    }
    if (en.pState === "dash") {
        en.pTimer--;
        // [รอบ 4] ชาร์จชนกำแพง = ทุกกำแพงเปิดทางแล้วฝ่าต่อ (ยกเว้นขอบแผนที่)
        let nx = en.x + en.dashVx;
        if (!blockedForEntity(nx, en.y, en.size)) en.x = nx;
        else {
            bossSmashWalls(en);
            if (!blockedForEntity(nx, en.y, en.size)) en.x = nx;
            else en.pTimer = 0;
        }
        let ny = en.y + en.dashVy;
        if (!blockedForEntity(en.x, ny, en.size)) en.y = ny;
        else {
            bossSmashWalls(en);
            if (!blockedForEntity(en.x, ny, en.size)) en.y = ny;
            else en.pTimer = 0;
        }
        particles.push({ type: "spark", x: en.x, y: en.y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, size: 3, life: 8, color: "#ff7777" });
        if (en.pTimer <= 0) { en.pState = "recover"; en.pTimer = BAL.BOSS_SKILL.DASH_RECOVER; }   // [v14]
        return true;
    }
    if (en.pState === "recover") {
        en.pTimer--;
        if (en.pTimer <= 0) en.pState = "idle";
        return true;
    }
    if (en.pState === "spiral") {
        en.pTimer--;
        if (en.pTimer % BAL.BOSS_SKILL.SPIRAL_RATE === 0) {
            let shots = en.phase === 2 ? BAL.BOSS_SKILL.SPIRAL_SHOTS_P2 : BAL.BOSS_SKILL.SPIRAL_SHOTS;
            for (let s = 0; s < shots; s++) bossBullet(en, en.spiralAng + s * (Math.PI * 2 / shots), BAL.BOSS_SKILL.SPIRAL_SPD);   // [v14]
            en.spiralAng += en.phase === 2 ? BAL.BOSS_SKILL.SPIRAL_TURN_P2 : BAL.BOSS_SKILL.SPIRAL_TURN;
            playSynthSFX("shoot");
        }
        if (en.pTimer <= 0) { en.pState = "recover"; en.pTimer = en.phase === 2 ? BAL.BOSS_SKILL.RECOVER_P2 : BAL.BOSS_SKILL.RECOVER; }   // [v10-15]
        return true;
    }
    en.pCd--;
    if (en.pCd <= 0 && dist < BAL.BOSS_SKILL.SKILL_RANGE) {   // [v14]
        let roll = Math.random();
        if (en.typeKey === "BOSS_MELEE") {
            startBossTele(en, roll < 0.6 ? "charge" : "summon");
        } else if (en.typeKey === "BOSS_CYBERMAGE") {
            startBossTele(en, roll < 0.5 ? "burst" : roll < 0.8 ? "teleport" : "summon");
            en.atkIdx = (en.atkIdx || 0) + 1;   // [v18-1] ดวงตาที่สามกระพริบแรงขึ้นตามจำนวนท่า
        } else if (en.typeKey === "BOSS_OVERLORD") {
            let list = en.phase === 2 ? ["burst", "charge", "spiral", "summon", "teleport"] : ["burst", "charge", "summon", "spiral"];
            startBossTele(en, list[en.atkIdx % list.length]);
            en.atkIdx++;
        } else if (en.typeKey === "BOSS_DEVILCORE") {
            // [3C] โคลนทีมรวมใจ: รวมชุดท่าของทุคคลาสในทีม + จำเจ้าของท่าไว้บอกสีตอนเตือน
            let list = [], owners = [];
            let addMoves = (moves, pi) => {
                moves.forEach(m => {
                    if (list.indexOf(m) < 0) { list.push(m); owners.push(pi); }
                });
            };
            players.forEach((pl, pi) => {
                switch (pl.weaponType) {
                    case "SWORD":   addMoves(["charge", "slashNova", "summon"], pi); break;
                    case "GUN":     addMoves(["homing", "burst", "charge"], pi); break;
                    case "SHOTGUN": addMoves(["fan", "charge", "summon"], pi); break;
                    case "LASER":   addMoves(["beam", "burst", "teleport"], pi); break;
                    default:        addMoves(["summon", "homing", "charge"], pi); break;
                }
            });
            players.forEach((pl, pi) => { if (pl.standLevel > 0) addMoves(["slashNova"], pi); });
            if (list.length === 0) { list = ["summon", "homing", "charge"]; owners = [0]; }
            let mi = en.atkIdx % list.length;
            en.teleOwner = owners[mi];
            startBossTele(en, list[mi]);
            en.atkIdx++;
        }
        en.pCd = Math.round((BAL.BOSS_SKILL.CD_BASE + Math.random() * BAL.BOSS_SKILL.CD_VAR) * (en.phase === 2 ? BAL.BOSS_SKILL.CD_PHASE2 : 1));   // [v10-16]
    }
    return false;
}

