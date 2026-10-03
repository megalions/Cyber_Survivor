"use strict";

// ================== BOSS AI ==================
function startBossTele(en, kind) {
    en.pState = "tele";
    en.teleKind = kind;
    // [รอบ 3] telegraph เฟส 2: 30 -> 40 เฟรม (หน้าต่างตอบสนองกว้างขึ้นตอนดาเมจหนัก)
    en.pTimer = en.phase === 2 ? 40 : 45;
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
    let recT = en.phase === 2 ? 42 : 25;
    switch (en.teleKind) {
        case "charge":
            en.pState = "dash"; en.pTimer = 24;
            let sp = en.speed * 4.5 * (en.phase === 2 ? 1.25 : 1);
            en.dashVx = Math.cos(en.pAngle) * sp;
            en.dashVy = Math.sin(en.pAngle) * sp;
            playSynthSFX("missile_heavy");
            break;
        case "burst": {
            let n = en.typeKey === "BOSS_OVERLORD" ? (en.phase === 2 ? 18 : 12) : 10;
            for (let i = 0; i < n; i++) bossBullet(en, (i / n) * Math.PI * 2 + Math.random() * 0.2, 3.6);
            playSynthSFX("heavy_explosion");
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "summon": {
            let k = en.typeKey === "BOSS_OVERLORD" ? (en.phase === 2 ? 4 : 3) : (en.typeKey === "BOSS_MELEE" ? 3 : 2);
            if (enemies.length < 45) {
                for (let i = 0; i < k; i++) {
                    let key = Math.random() < 0.5 ? "NORMAL" : (Math.random() < 0.5 ? "SPEEDY" : "RANGED");
                    spawnMinionAt(key, en.x + (Math.random() - 0.5) * 90, en.y + (Math.random() - 0.5) * 90, en.parentSpawner, false);
                }
                createSparks(en.x, en.y, "#ff5577");
            }
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "teleport": {
            let ang = Math.random() * Math.PI * 2, d = 180 + Math.random() * 90;
            let tt = nearestPlayerTo(en.x, en.y) || player;   // [เฟส 2A]
            let spot = findFreeTileNear(tt.x + Math.cos(ang) * d, tt.y + Math.sin(ang) * d);
            if (spot) {
                particles.push({ type: "explosion", x: en.x, y: en.y, radius: en.size, life: 12, maxLife: 12, color: "rgba(0,255,255,0.5)" });
                en.x = spot.col * TILE_SIZE + TILE_SIZE / 2;
                en.y = spot.row * TILE_SIZE + TILE_SIZE / 2;
                particles.push({ type: "explosion", x: en.x, y: en.y, radius: en.size, life: 12, maxLife: 12, color: "rgba(0,255,255,0.5)" });
                if (en.typeKey === "BOSS_OVERLORD") {
                    for (let i = 0; i < 8; i++) bossBullet(en, (i / 8) * Math.PI * 2, 3.2);
                }
            }
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "spiral":
            en.pState = "spiral"; en.pTimer = 90; en.spiralAng = Math.random() * 6.28;
            break;
        case "slashNova": {
            particles.push({ type: "slash", x: en.x, y: en.y, radius: 175, angle: 0, arc: Math.PI * 2, life: 12, maxLife: 12, color: "rgba(255, 0, 170, 0.4)" });
            playSynthSFX("heavy_explosion");
            players.forEach(pl => {   // [เฟส 2A] โดนทุกคนที่อยู่ในรัศมี
                if (Math.hypot(pl.x - en.x, pl.y - en.y) < 175 + pl.size) damagePlayer(pl, en.damage);
            });
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "homing": {
            let hm = nearestPlayerTo(en.x, en.y) || player;   // [เฟส 2A]
            for (let i = 0; i < 4; i++) {
                let ang = Math.atan2(hm.y - en.y, hm.x - en.x) + (i - 1.5) * 0.35;
                bossBullet(en, ang, 3.2, { homing: true, size: 7, life: 260, color: "#ff5577" });
            }
            playSynthSFX("missile");
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "fan": {
            playSynthSFX("shotgun");
            en.pState = "recover"; en.pTimer = recT;
            break;
        }
        case "beam": {
            let bm = nearestPlayerTo(en.x, en.y) || player;   // [เฟส 2A]
            let base = Math.atan2(bm.y - en.y, bm.x - en.x);
            for (let i = -1; i <= 1; i++) {
                bossBullet(en, base + i * 0.25, 8, { size: 14, damage: (en.bulletDamage || 16) * 1.5, color: "#ff2e88", life: 200 });
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
        if (en.pTimer <= 0) { en.pState = "recover"; en.pTimer = 30; }
        return true;
    }
    if (en.pState === "recover") {
        en.pTimer--;
        if (en.pTimer <= 0) en.pState = "idle";
        return true;
    }
    if (en.pState === "spiral") {
        en.pTimer--;
        if (en.pTimer % 6 === 0) {
            let shots = en.phase === 2 ? 3 : 2;
            for (let s = 0; s < shots; s++) bossBullet(en, en.spiralAng + s * (Math.PI * 2 / shots), 3.0);
            en.spiralAng += en.phase === 2 ? 0.5 : 0.38;
            playSynthSFX("shoot");
        }
        if (en.pTimer <= 0) { en.pState = "recover"; en.pTimer = en.phase === 2 ? 42 : 25; }
        return true;
    }
    en.pCd--;
    if (en.pCd <= 0 && dist < 640) {
        let roll = Math.random();
        if (en.typeKey === "BOSS_MELEE") {
            startBossTele(en, roll < 0.6 ? "charge" : "summon");
        } else if (en.typeKey === "BOSS_CYBERMAGE") {
            startBossTele(en, roll < 0.5 ? "burst" : roll < 0.8 ? "teleport" : "summon");
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
        en.pCd = Math.round((200 + Math.random() * 80) * (en.phase === 2 ? 0.6 : 1));
    }
    return false;
}

