"use strict";

// ================== ไมน์ ==================
function canPlaceMineAt(x, y) {
    for (let i = 0; i < mines.length; i++) {
        if (Math.hypot(mines[i].x - x, mines[i].y - y) < MINE_CFG.minSpacing) return false;
    }
    return true;
}
// [ไมน์ v2] Cap ไมน์บนสนาม: 5/10/15 ตามเลเวล MINE DROP (SHARD นับรวม)
// เคสพิเศษ: มีแต่ SHARD MINE โดยไม่มี MINE DROP = ใช้ cap 5
function mineCap(pl) {
    pl = pl || player;
    let lv = pl.mineLevel;
    if (lv <= 0 && pl.shardMineLevel > 0) lv = 1;
    return lv * BAL.CLS.MINE_CAP;
}
// สนามเต็ม = รีไซเคิลไมน์เก่าสุด (ตำแหน่งเก่ามักห่างศัตรูแล้ว แลกไม่ใหม่ที่โยนใส่เป้าปัจจุบัน)
function recycleOldestMine() {
    if (mines.length === 0) return;
    let oldest = mines.shift();
    createSparks(oldest.x, oldest.y, "#55607a");
}
function tryPlaceMine(px, py, kind, pl) {
    pl = pl || player;   // [เฟส 2B]
    let spot = findFreeTileNear(px, py);
    if (spot) {
        let mx = spot.col * TILE_SIZE + TILE_SIZE / 2, my = spot.row * TILE_SIZE + TILE_SIZE / 2;
        if (canPlaceMineAt(mx, my)) {
            if (mines.length >= mineCap(pl)) recycleOldestMine();
            mines.push({ row: spot.row, col: spot.col, x: mx, y: my, size: 24, kind: kind, owner: pl });
            createSparks(mx, my, kind === "SHARD" ? "#7bd9ff" : "#ffaa00");
            return true;
        }
    }
    for (let t = 0; t < 8; t++) {
        let s2 = findFreeTileNear(px + (Math.random() - 0.5) * 170, py + (Math.random() - 0.5) * 170);
        if (!s2) continue;
        let mx = s2.col * TILE_SIZE + TILE_SIZE / 2, my = s2.row * TILE_SIZE + TILE_SIZE / 2;
        if (canPlaceMineAt(mx, my)) {
            if (mines.length >= mineCap(pl)) recycleOldestMine();
            mines.push({ row: s2.row, col: s2.col, x: mx, y: my, size: 24, kind: kind, owner: pl });
            createSparks(mx, my, kind === "SHARD" ? "#7bd9ff" : "#ffaa00");
            return true;
        }
    }
    return false;
}
function dropShotgunMines(pl) {
    pl = pl || player;   // [เฟส 2B]
    let kinds = [];
    for (let i = 0; i < pl.mineLevel; i++) kinds.push("NORMAL");
    for (let i = 0; i < pl.shardMineLevel; i++) kinds.push("SHARD");
    if (kinds.length === 0) return;
    let targets = enemies
        .filter(en => en.typeKey !== "BLOCK_OBSTACLE" && en.hp > 0)
        .sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y))
        .slice(0, kinds.length);
    kinds.forEach((kind, idx) => {
        let px, py;
        if (idx < targets.length) {
            let t = targets[idx];
            let ang = Math.atan2(t.y - pl.y, t.x - pl.x);
            let d = Math.min(220, Math.max(60, Math.hypot(t.x - pl.x, t.y - pl.y) * 0.7));
            px = pl.x + Math.cos(ang) * d;
            py = pl.y + Math.sin(ang) * d;
        } else {
            px = pl.x + (Math.random() - 0.5) * 180;
            py = pl.y + (Math.random() - 0.5) * 180;
        }
        tryPlaceMine(px, py, kind, pl);
    });
}

// ================== Deployables ==================
function countDeployKind(kind, pl) {   // [เฟส 2B] นับเฉพาะของเจ้าของ (ไม่ส่ง pl = นับทุกชิ้น)
    let n = 0;
    for (let i = 0; i < deployables.length; i++) {
        let d = deployables[i];
        if (d.kind !== kind) continue;
        if (pl && d.owner && d.owner !== pl) continue;
        n++;
    }
    return n;
}
function deployOne(kind, pl) {
    pl = pl || player;   // [เฟส 2B]
    if (kind === "STAND") {
        deployables.push({
            kind: "STAND", x: pl.x, y: pl.y, size: 20,
            hp: 1, maxHp: 1, life: Infinity,
            angle: pl.angle, attackCd: 0, owner: pl
        });
        createSparks(pl.x, pl.y, "#c9a6ff");
        return;
    }
    let hp = Math.max(1, Math.floor(pl.maxHp * DEPLOY.hpPct));
    if (kind === "DRONE") {
        let isQueen = evolved.drone && countDeployKind("DRONE", pl) === 0;
        if (isQueen) hp *= 2;
        deployables.push({
            kind: "DRONE", queen: isQueen, x: pl.x, y: pl.y,
            size: isQueen ? 30 : 20,
            hp: hp, maxHp: hp, life: 999999, angle: 0, attackCd: 20,
            orbitAngle: Math.random() * Math.PI * 2, orbitR: isQueen ? 72 : 55, owner: pl
        });
        createSparks(pl.x, pl.y, isQueen ? "#ffd23d" : "#9fd6ff");
        return;
    }
    let ang = Math.random() * Math.PI * 2;
    let d = 55 + Math.random() * 45;
    let spot = findFreeTileNear(pl.x + Math.cos(ang) * d, pl.y + Math.sin(ang) * d);
    if (!spot) spot = findFreeTileNear(pl.x, pl.y);
    if (!spot) return;
    let x = spot.col * TILE_SIZE + TILE_SIZE / 2, y = spot.row * TILE_SIZE + TILE_SIZE / 2;
    deployables.push({ kind: kind, x: x, y: y, size: DEPLOY.size, hp: hp, maxHp: hp, life: DEPLOY.life, angle: 0, attackCd: 20, owner: pl });
    createSparks(x, y, kind === "TURRET" ? "#66ccff" : "#ffcc66");
}
function onDeployableLost(kind, pl) {
    pl = pl || player;   // [เฟส 2B]
    if (kind === "TURRET") { if (countDeployKind("TURRET", pl) < pl.turretLevel) pl.turretCd = DEPLOY.cd; }
    else if (kind === "DRONE") { if (countDeployKind("DRONE", pl) < pl.droneTarget) pl.droneCd = DEPLOY.droneCd; }
}
function handleDeployment() {
    players.forEach(pl => {   // [เฟส 2B] รายเจ้าของ (ตอนนี้ 1 คน — พฤติกรรมเหมือนเดิม)
        if (pl.hp <= 0) return;   // [v13-1] ผีหยุดเกิดหน่วยใหม่ — ของที่อยู่แล้วสู้ต่อจนพังตามธรรมชาติ / ชุบตอนขึ้นชั้นแล้วกลับมาปกติ
        if (pl.turretLevel > 0) {
            let count = countDeployKind("TURRET", pl);
            if (count < pl.turretLevel) {
                if (pl.turretCd > 0) pl.turretCd -= DT;
                if (pl.turretCd <= 0) {
                    deployOne("TURRET", pl);
                    if (countDeployKind("TURRET", pl) < pl.turretLevel) pl.turretCd = DEPLOY.cd;
                }
            }
        }
        if (pl.standLevel > 0 && countDeployKind("STAND", pl) === 0) deployOne("STAND", pl);
        if (pl.droneTarget > 0) {
            let count = countDeployKind("DRONE", pl);
            if (count < pl.droneTarget) {
                if (pl.droneCd > 0) pl.droneCd -= DT;
                if (pl.droneCd <= 0) {
                    deployOne("DRONE", pl);
                    if (countDeployKind("DRONE", pl) < pl.droneTarget) pl.droneCd = DEPLOY.droneCd;
                }
            }
        }
    });
}
function updateDeployables() {
    for (let i = deployables.length - 1; i >= 0; i--) {
        let dep = deployables[i];
        let eternal = (dep.kind === "DRONE" || dep.kind === "STAND");
        if (!eternal) dep.life -= DT;
        if (dep.attackCd > 0) dep.attackCd--;

        if (dep.hp > 0 && (eternal || dep.life > 0)) {

            if (dep.kind === "STAND") {
                let own = dep.owner || player;   // [เฟส 2B]
                let trail = own.trail;
                let tIdx = Math.max(0, trail.length - 1 - DEPLOY.standDelay);
                let tx = trail.length ? trail[tIdx].x : own.x;
                let ty = trail.length ? trail[tIdx].y : own.y;
                dep.x += (tx - dep.x) * 0.25;
                dep.y += (ty - dep.y) * 0.25;

                enemies.forEach(en => {
                    if (en.typeKey === "BLOCK_OBSTACLE" || en.hp <= 0) return;
                    if (Math.hypot(en.x - dep.x, en.y - dep.y) <= DEPLOY.auraRadius + en.size / 2) {
                        applySlowToEnemy(en, DEPLOY.auraSlow, DEPLOY.auraTick, false);
                    }
                });

                let reach = own.bulletSize + 30;   // [v10-18] ตามเจ้าของ STAND — เดิมใช้ player (P1) ซึ่ง co-op อาจไม่ใช่คนนี้
                let target = null, best = Infinity;
                enemies.forEach(en => {
                    if (en.typeKey === "BLOCK_OBSTACLE" || en.hp <= 0) return;
                    let dd = Math.hypot(en.x - dep.x, en.y - dep.y);
                    if (dd <= reach + en.size / 2 && dd < best) { best = dd; target = en; }
                });
                if (target) {
                    dep.angle = Math.atan2(target.y - dep.y, target.x - dep.x);
                    if (dep.attackCd <= 0) {
                        swordSwing(dep.x, dep.y, dep.angle, own.damage * own.standDmgPct, own, true, false);
                        dep.attackCd = own.maxCooldown;
                    }
                }
                continue;
            }

            if (dep.kind === "DRONE") {
                let own = dep.owner || player;   // [เฟส 2B]
                dep.orbitAngle += DT * (dep.queen ? 1.2 : 1.7);
                dep.x = own.x + Math.cos(dep.orbitAngle) * (dep.orbitR || 55);
                dep.y = own.y + Math.sin(dep.orbitAngle) * (dep.orbitR || 55);
            }

            let reach = dep.kind === "TURRET" ? DEPLOY.turretRange : DEPLOY.droneRange;
            let target = null, best = Infinity;
            enemies.forEach(en => {
                if (en.typeKey === "BLOCK_OBSTACLE" || en.hp <= 0) return;
                let dd = Math.hypot(en.x - dep.x, en.y - dep.y);
                if (dd <= reach + en.size / 2 && dd < best) { best = dd; target = en; }
            });
            if (target) {
                dep.angle = Math.atan2(target.y - dep.y, target.x - dep.x);
                if (dep.attackCd <= 0) {
                    let own = dep.owner || player;   // [เฟส 2B]
                    let dmgPct = dep.kind === "DRONE"
                        ? (dep.queen ? 0.45 : (evolved.drone ? 0.15 : (own.titan ? 0.3 : 0.2)))
                        : DEPLOY.dmgPct;
                    let dmg = own.damage * dmgPct;
                    playerProjectiles.push({
                        x: dep.x, y: dep.y,
                        vx: Math.cos(dep.angle) * DEPLOY.bulletSpd, vy: Math.sin(dep.angle) * DEPLOY.bulletSpd,
                        damage: dmg, size: dep.queen ? 8 : 5,
                        color: dep.queen ? "#ffd23d" : (dep.kind === "DRONE" ? "#9fd6ff" : "#66ccff"),
                        type: "TURRET",
                        owner: own
                    });
                    playSynthSFX("turret");
                    if (dep.kind === "DRONE") dep.attackCd = Math.max(2, Math.round(own.maxCooldown * (droneOverdrive > 0 ? 0.25 : 1)));
                    else dep.attackCd = own.maxCooldown;
                }
            }
        }

        if ((dep.hp <= 0 && dep.kind !== "STAND") || (!eternal && dep.life <= 0)) {   // [3C-fix] โดรนตาย = เก็บศพ + ตั้ง CD เกิดใหม่ (เดิม "eternal" กันการเก็บทั้งที่ hp หมด — บั๊กแฝงตั้งแต่ v1)
            let destroyed = dep.hp <= 0;
            particles.push({ type: "explosion", x: dep.x, y: dep.y, radius: 42, life: 14, maxLife: 14, color: destroyed ? "rgba(255, 85, 0, 0.6)" : "rgba(150, 160, 180, 0.5)" });
            playSynthSFX(destroyed ? "explosion" : "hit");
            deployables.splice(i, 1);
            onDeployableLost(dep.kind, dep.owner);   // [เฟส 2B]
        }
    }
    handleDeployment();
}

