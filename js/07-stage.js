"use strict";

function setupStage() {
    generateMap();
    enemies = []; playerProjectiles = []; enemyProjectiles = []; particles = []; items = []; mines = [];
    deployables = [];
    arenas = [];
    shatterQueue = [];
    portalItemSpawned = false;
    floorClean = true;
    players.forEach(pl => {
        pl.turretCd = 0;
        pl.droneCd = 0;
        pl.trail.length = 0;
        pl.pity = 0;
    });

    // [เฟส 3A] เกิดกลางแผนที่ — co-op ยืนคนละข้าง / เดี่ยวตรงกลางเหมือนเดิม
    players.forEach((pl, i) => {
        pl.x = Math.floor(MAP_COLS / 2) * TILE_SIZE + TILE_SIZE / 2 - (players.length > 1 ? (i === 0 ? 42 : -42) : 0);
        pl.y = Math.floor(MAP_ROWS / 2) * TILE_SIZE + TILE_SIZE / 2;
    });
    let pr = Math.floor(player.y / TILE_SIZE), pc = Math.floor(player.x / TILE_SIZE);
    for (let r = pr - 2; r <= pr + 2; r++) {
        for (let c = pc - 2; c <= pc + 2; c++) {
            if (map[r] && map[r][c] === 1) map[r][c] = 0;
        }
    }

    let isChallenge = currentFloor % 10 === 0;
    let isMegaFloor = !isChallenge && currentFloor % 5 === 0;
    // [แพตช์] OVERLORD/DEVILCORE: +1 ตัวทุกครั้งที่เกิดซ้ำ — cap ที่ BAL.BOSS.MAX_COUNT
    let bossCount = 1;
    if (isChallenge) bossCount = 1 + Math.max(0, currentFloor / 10 - 1) * BAL.BOSS.EXTRA_PER_ROUND;
    else if (isMegaFloor) bossCount = 1 + Math.floor(Math.max(0, currentFloor - 5) / 10) * BAL.BOSS.EXTRA_PER_ROUND;
    bossCount = Math.min(bossCount, BAL.BOSS.MAX_COUNT);
    if (bossCount > 1) announce("⚠ " + bossCount + "x " + (isChallenge ? "DEVIL CORE" : "OVERLORD") + " ⚠", "#ff5577");

    let spawnerTarget = (isChallenge || isMegaFloor) ? bossCount : Math.min(5, 1 + Math.floor((currentFloor - 1) / 5));
    if (!isChallenge && !isMegaFloor) spawnerTarget += players.length - 1;   // [เฟส 4] +1 ต่อคนที่เพิ่ม (ชั้นบอสไม่เพิ่ม)
    spawners = [];
    let guard = 0, minPlayerDist = 420, minSpawnerDist = 300;
    while (spawners.length < spawnerTarget && guard < 3000) {
        guard++;
        if (guard % 500 === 0) {
            minPlayerDist = Math.max(200, minPlayerDist - 80);
            minSpawnerDist = Math.max(150, minSpawnerDist - 60);
        }
        let sr = 2 + Math.floor(Math.random() * (MAP_ROWS - 4));
        let sc = 2 + Math.floor(Math.random() * (MAP_COLS - 4));
        if (map[sr][sc] !== 0) continue;
        let sx = sc * TILE_SIZE + TILE_SIZE / 2, sy = sr * TILE_SIZE + TILE_SIZE / 2;
        if (Math.hypot(sx - player.x, sy - player.y) < minPlayerDist) continue;
        if (spawners.some(sp => Math.hypot(sp.x - sx, sp.y - sy) < minSpawnerDist)) continue;
        spawners.push({ row: sr, col: sc, x: sx, y: sy, spawnTimer: 0, spawnedCount: 0, currentAlive: {}, bossSpawned: false, bossKilled: false, myBossRef: null, isMega: isMegaFloor, isChallenge: isChallenge });
    }

    spawners.forEach(sp => {
        for (let r = sp.row - 1; r <= sp.row + 1; r++) {
            for (let c = sp.col - 1; c <= sp.col + 1; c++) {
                if (r >= 1 && c >= 1 && r < MAP_ROWS - 1 && c < MAP_COLS - 1) map[r][c] = 0;
            }
        }
    });

    let placed = 0; guard = 0;
    while (placed < 10 && guard < 500) {
        guard++;
        let sr = 2 + Math.floor(Math.random() * (MAP_ROWS - 4));
        let sc = 2 + Math.floor(Math.random() * (MAP_COLS - 4));
        if (map[sr][sc] !== 0) continue;
        let sx = sc * TILE_SIZE + TILE_SIZE / 2, sy = sr * TILE_SIZE + TILE_SIZE / 2;
        if (Math.hypot(sx - player.x, sy - player.y) < 200) continue;
        if (spawners.some(sp => Math.hypot(sp.x - sx, sp.y - sy) < 120)) continue;
        let blueprint = ENEMY_TYPES.BLOCK_OBSTACLE;
        enemies.push({
            uid: ++uidSeq, kbVx: 0, kbVy: 0, kbTimer: 0, status: createStatus(), elite: null,
            x: sx, y: sy, typeKey: "BLOCK_OBSTACLE", icon: blueprint.icon,
            hp: blueprint.hp, maxHp: blueprint.hp, speed: 0, size: blueprint.size, score: 0,
            isRanged: false, shootCooldown: 0, shootTimer: 0, bulletColor: "#fff", isBoss: false,
            damage: 0, bulletDamage: 0, shield: 0, stuckTimer: 0, detourTimer: 0, detourAngle: 0,
            lastX: sx, lastY: sy, parentSpawner: null, arenaRef: null,
            frustration: 0, repositionCd: 0
        });
        placed++;
    }

    if (!isChallenge && Math.random() < 0.15) {
        let spot = tryPlaceRoomSpot(430, 950);
        if (spot && carveRoom(spot.row, spot.col, 5, 3, false)) {
            items.push({ x: spot.x, y: spot.y, type: "CORE", icon: "🔴", size: 18 });
            items.push({ x: spot.x + 34, y: spot.y, type: "COIN_BIG", icon: "💵", size: 22, value: 60 + currentFloor * 5 });
            for (let i = 0; i < 6; i++) {
                let rr = spot.row + (Math.floor(Math.random() * 3) - 1);
                let ccx = spot.col + (Math.floor(Math.random() * 5) - 2);
                items.push({ x: ccx * TILE_SIZE + TILE_SIZE / 2, y: rr * TILE_SIZE + TILE_SIZE / 2, type: "COIN", icon: "💰", size: 16 });
            }
            for (let g = 0; g < 2; g++) {
                spawnMinionAt(Math.random() < 0.5 ? "TANK" : "NORMAL", spot.x + (g ? 40 : -40), spot.y + (g ? 40 : -40), null, true);
            }
            particles.push({ type: "text", x: spot.x, y: spot.y - 60, text: "💎 VAULT", life: 100, maxLife: 100, color: "#ffd700", vy: -0.3 });
        }
    }
    if (!isChallenge && Math.random() < 0.13) {
        let spot = tryPlaceRoomSpot(430, 950);
        if (spot && carveRoom(spot.row, spot.col, 7, 5, true)) {
            let arena = { x: spot.x, y: spot.y, remaining: 4, cleared: false };
            arenas.push(arena);
            let keys = ["NORMAL", "SPEEDY", "RANGED", "TANK", "SHIELDER", "SPLITTER"];
            for (let g = 0; g < 4; g++) {
                let ang = (g / 4) * Math.PI * 2;
                let en = spawnMinionAt(keys[Math.floor(Math.random() * keys.length)],
                    spot.x + Math.cos(ang) * 80, spot.y + Math.sin(ang) * 60, null, true);
                if (en) en.arenaRef = arena;
            }
            particles.push({ type: "text", x: spot.x, y: spot.y - 70, text: "⚔ ARENA", life: 100, maxLife: 100, color: "#ff923d", vy: -0.3 });
        }
    }

    if (metaUnlocks.shield) players.forEach(pl => { pl.shield = Math.max(pl.shield, Math.floor(pl.maxHp * 0.5)); });

    if (runMods.treasureFloor) {
        runMods.treasureFloor = false;
        let put = 0, g2 = 0;
        while (put < 5 && g2 < 200) {
            g2++;
            let spot = findFreeTileNear(player.x + (Math.random() - 0.5) * 900, player.y + (Math.random() - 0.5) * 900);
            if (!spot) continue;
            let mx = spot.col * TILE_SIZE + TILE_SIZE / 2, my = spot.row * TILE_SIZE + TILE_SIZE / 2;
            if (Math.hypot(mx - player.x, my - player.y) < 200) continue;
            items.push({ x: mx, y: my, type: "COIN", icon: "💰", size: 16 });
            put++;
        }
    }

    if (Math.random() < 0.55) {
        let g3 = 0;
        while (g3 < 200) {
            g3++;
            let spot = findFreeTileNear(player.x + (Math.random() - 0.5) * 1000, player.y + (Math.random() - 0.5) * 1000);
            if (!spot) continue;
            let mx = spot.col * TILE_SIZE + TILE_SIZE / 2, my = spot.row * TILE_SIZE + TILE_SIZE / 2;
            if (Math.hypot(mx - player.x, my - player.y) < 320) continue;
            items.push({ x: mx, y: my, type: "DEVIL", icon: "🃏", size: 20 });
            break;
        }
    }
}

// ================== การเกิดศัตรู ==================
function spawnMinionAt(randomKey, x, y, sp, forceElite) {
    let blueprint = ENEMY_TYPES[randomKey];
    let hpMultiplier = (1 + BAL.MON.HP_PER_FLOOR * (currentFloor - 1)) * runMods.enemyHpMult * (1 + BAL.MON.HP_COOP * (players.length - 1));
    let elite = null;
    let ec = Math.min(BAL.MON.ELITE_MAX, BAL.MON.ELITE_BASE + BAL.MON.ELITE_GROWTH * Math.max(0, currentFloor - 10));
    if (forceElite || Math.random() < ec) elite = ELITE_AFFIXES[Math.floor(Math.random() * ELITE_AFFIXES.length)];
    if (elite && elite.hpMult) hpMultiplier *= elite.hpMult;
    let spd = blueprint.speed * runMods.enemySpeedMult;
    if (elite && elite.spdMult) spd *= elite.spdMult;
    let monsterObj = {
        uid: ++uidSeq, kbVx: 0, kbVy: 0, kbTimer: 0, status: createStatus(), elite: elite,
        x: x, y: y, typeKey: randomKey, icon: blueprint.icon,
        hp: blueprint.hp * hpMultiplier, maxHp: blueprint.hp * hpMultiplier,
        speed: spd, size: blueprint.size, score: blueprint.score,
        isRanged: blueprint.isRanged, shootCooldown: blueprint.shootCooldown || 0,
        shootTimer: 0, bulletColor: blueprint.bulletColor || "#fff", isBoss: false,
        // [รอบ 2] ดาเมจศัตรูโตตามชั้น (แคป x3.5)
        damage: Math.round((blueprint.damage || 10) * enemyDmgMult()),
        bulletDamage: blueprint.bulletDamage ? Math.round(blueprint.bulletDamage * enemyDmgMult()) : 0,
        shield: 0, stuckTimer: 0, detourTimer: 0, detourAngle: 0, lastX: x, lastY: y,
        parentSpawner: sp, arenaRef: null,
        frustration: 0, repositionCd: 0   // [รอบ 4] ระบบแฮ็กวาร์ป
    };
    if (sp) sp.currentAlive[randomKey] = (sp.currentAlive[randomKey] || 0) + 1;
    enemies.push(monsterObj);
    return monsterObj;
}

function spawnEnemyAt(sp) {
    let roll = Math.random();
    let randomKey;
    if (roll < 0.34) randomKey = "NORMAL";
    else if (roll < 0.48) randomKey = "SPEEDY";
    else if (roll < 0.63) randomKey = "RANGED";
    else if (roll < 0.71) randomKey = "TANK";
    else if (roll < 0.80) randomKey = "HEALER";
    else if (roll < 0.90) randomKey = "SPLITTER";
    else randomKey = "SHIELDER";
    spawnMinionAt(randomKey, sp.x + (Math.random() - 0.5) * 20, sp.y + (Math.random() - 0.5) * 20, sp, false);
}

function handleSpawners() {
    spawners.forEach(sp => {
        if (sp.bossKilled) return;
        sp.spawnTimer++;
        let spawnRate = sp.bossSpawned ? BAL.MON.SPAWN_RATE_BOSS : BAL.MON.SPAWN_RATE;   // [แก้] หลังบอสเกิด ช้าลง
        if (sp.spawnTimer >= spawnRate) {
            sp.spawnTimer = 0;
            let totalAlive = 0;
            for (let i = 0; i < enemies.length; i++) {
                let en = enemies[i];
                if (!en.isBoss && en.typeKey !== "BLOCK_OBSTACLE" && en.parentSpawner) totalAlive++;
            }
            let cap = Math.round((BAL.MON.CAP_BASE + BAL.MON.CAP_PER_PLAYER * (players.length - 1)) * runMods.spawnCapMult);
            if (totalAlive < cap) {
                spawnEnemyAt(sp);
                sp.spawnedCount++;
            }
        }
    });

    // [แพตช์] OVERLORD/DEVILCORE เท่านั้น: เกิดพร้อมกัน / ฟลอร์ปกติ: เกิดรายตัวตาม spawner
    if (spawners.some(sp => sp.isChallenge || sp.isMega)) {
        let anyReady = false;
        spawners.forEach(sp => {
            if (!sp.bossKilled && !sp.bossSpawned && sp.spawnedCount >= BAL.MON.SPAWNS_TO_BOSS) anyReady = true;
        });
        if (anyReady) {
            spawners.forEach(sp => {
                if (!sp.bossSpawned && !sp.bossKilled) spawnBoss(sp);
            });
            addShake(6, 0.4);
        }
    } else {
        spawners.forEach(sp => {
            if (sp.spawnedCount >= BAL.MON.SPAWNS_TO_BOSS && !sp.bossSpawned) spawnBoss(sp);
        });
    }
}

function spawnBoss(sp) {
    sp.bossSpawned = true;
    let randomKey = sp.isChallenge ? "BOSS_DEVILCORE" : sp.isMega ? "BOSS_OVERLORD" : (Math.random() < 0.5 ? "BOSS_MELEE" : "BOSS_CYBERMAGE");
    let blueprint = ENEMY_TYPES[randomKey];
    // [รอบ 3] HP บอส: 1.32^min(ชั้น-1,12) x 1.15^(เกินชั้น 13) — ต้นเกมเหมือนเดิม ปลายเกมไม่บวมระเบิด
    let fl = currentFloor - 1;
    let growth = Math.pow(BAL.BOSS.HP_A, Math.min(fl, BAL.BOSS.HP_A_CAP)) * Math.pow(BAL.BOSS.HP_B, Math.max(0, fl - BAL.BOSS.HP_A_CAP));
    let bossHp = Math.floor(blueprint.hp * growth * runMods.bossHpMult * (sp.isMega ? BAL.BOSS.MEGA_MULT : 1) * (1 + BAL.BOSS.HP_COOP * (players.length - 1)));
    let bossShield = 0;
    if (randomKey === "BOSS_CYBERMAGE") bossShield = 10 + BOSS_SHIELD_LINEAR * (currentFloor - 1);
    if (randomKey === "BOSS_OVERLORD") bossShield = 30 + 15 * Math.floor(currentFloor / 5);
    if (randomKey === "BOSS_DEVILCORE") bossShield = 40 + 25 * Math.floor(currentFloor / 10);
    let monsterObj = {
        uid: ++uidSeq, kbVx: 0, kbVy: 0, kbTimer: 0, status: createStatus(), elite: null,
        x: sp.x, y: sp.y, typeKey: randomKey, icon: blueprint.icon,
        hp: bossHp, maxHp: bossHp,
        speed: blueprint.speed * runMods.enemySpeedMult, size: blueprint.size, score: blueprint.score,
        isRanged: blueprint.isRanged, shootCooldown: blueprint.shootCooldown || 0,
        shootTimer: 0, bulletColor: blueprint.bulletColor || "#fff", isBoss: true,
        damage: Math.round((blueprint.damage || 10) * enemyDmgMult()),
        bulletDamage: blueprint.bulletDamage ? Math.round(blueprint.bulletDamage * enemyDmgMult()) : 0,
        shield: bossShield, stuckTimer: 0, detourTimer: 0, detourAngle: 0, lastX: sp.x, lastY: sp.y,
        parentSpawner: sp, arenaRef: null,
        pState: "idle", pTimer: 0, pCd: 160, pAngle: 0, teleKind: "", dashVx: 0, dashVy: 0,
        spiralAng: 0, phase: 1, atkIdx: 0,
        frustration: 0, repositionCd: 0
    };
    sp.myBossRef = monsterObj;
    enemies.push(monsterObj);
    playSynthSFX("heavy_explosion");
    addShake(4, 0.3);
    if (randomKey === "BOSS_OVERLORD") announce("☠ OVERLORD DETECTED ☠", "#ff5577");
    if (randomKey === "BOSS_DEVILCORE") announce("☠ DEVIL CORE — โคลน" + (players.length > 1 ? "ทีมรวมใจ (รวมท่าทุกคน)" : "บิลด์คุณ") + " ☠", "#ff00aa");
}

