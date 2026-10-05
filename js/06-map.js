"use strict";

// ================== แผนที่ + LoS (ใช้กับ AI มอนเท่านั้น — ดาบยังทะลุกำแพง) ==================
function generateMap() {
    map = [];
    for (let r = 0; r < MAP_ROWS; r++) {
        map[r] = [];
        for (let c = 0; c < MAP_COLS; c++) {
            if (r === 0 || c === 0 || r === MAP_ROWS - 1 || c === MAP_COLS - 1) map[r][c] = 1;
            else map[r][c] = Math.random() < 0.04 ? 1 : 0;
        }
    }
}
function isWallTile(px, py) {
    let c = Math.floor(px / TILE_SIZE), r = Math.floor(py / TILE_SIZE);
    if (r < 0 || c < 0 || r >= MAP_ROWS || c >= MAP_COLS) return true;
    return map[r][c] === 1;
}
// [รอบ 4] หินที่ตายแล้ว (hp<=0) ไม่ถือเป็นสิ่งกีดขวาง — ให้บอสฝ่าผ่านหน่วยที่เพิ่งโดนทุลได้ทันที
function blockedForEntity(x, y, size) {
    size = Math.min(size, TILE_SIZE - 4);   // [มินิแพส] footprint เดิน = ไม่เกิน 1 ช่อง (แยกจากขนาดภาพ/hitbox)
    let h = size / 2 - 2;
    if (isWallTile(x - h, y - h) || isWallTile(x + h, y - h) || isWallTile(x - h, y + h) || isWallTile(x + h, y + h)) return true;
    for (let i = 0; i < enemies.length; i++) {
        let en = enemies[i];
        if (en.typeKey !== "BLOCK_OBSTACLE" || en.hp <= 0) continue;
        if (Math.hypot(en.x - x, en.y - y) < en.size / 2 + size / 2) return true;
    }
    return false;
}
function pathBlocked(x, y, ang, dist) {
    for (let s = 0.4; s <= 1.001; s += 0.3) {
        let px = x + Math.cos(ang) * dist * s;
        let py = y + Math.sin(ang) * dist * s;
        if (isWallTile(px, py)) return true;
        for (let i = 0; i < enemies.length; i++) {
            let en = enemies[i];
            if (en.typeKey !== "BLOCK_OBSTACLE" || en.hp <= 0) continue;
            if (Math.hypot(en.x - px, en.y - py) < en.size / 2 + 12) return true;
        }
    }
    return false;
}
// [รอบ 4] เส้นสายตา (เฉพาะกำแพง tile — หินไม่บัง) ใช้ตรวจว่ามอน "มองเห็น" ผู้เล่นไหม
function hasLOS(x1, y1, x2, y2) {
    let d = Math.hypot(x2 - x1, y2 - y1);
    let steps = Math.max(1, Math.ceil(d / 24));
    for (let i = 1; i < steps; i++) {
        let t = i / steps;
        if (isWallTile(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
    }
    return true;
}
function findWalkableDetour(en) {
    let tgt = nearestPlayerTo(en.x, en.y) || player;   // [เฟส 2A] มุ่งผู้เล่นใกล้สุด
    let base = Math.atan2(tgt.y - en.y, tgt.x - en.x);
    let look = en.size + 30;
    let candidates = [base - 0.6, base + 0.6, base - 1.2, base + 1.2, base - 1.8, base + 1.8, base + Math.PI];
    for (let i = 0; i < candidates.length; i++) {
        if (!pathBlocked(en.x, en.y, candidates[i], look)) return candidates[i];
    }
    return null;
}
function unstuckEntity(en) {
    if (!blockedForEntity(en.x, en.y, en.size)) return;
    let bestA = null, bestD = Infinity;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        for (let d = 6; d <= 66; d += 6) {
            let nx = en.x + Math.cos(a) * d, ny = en.y + Math.sin(a) * d;
            if (!blockedForEntity(nx, ny, en.size)) {
                if (d < bestD) { bestD = d; bestA = a; }
                break;
            }
        }
    }
    if (bestA !== null) {
        en.x += Math.cos(bestA) * 5;
        en.y += Math.sin(bestA) * 5;
    } else {
        let spot = findFreeTileNear(en.x, en.y);
        if (spot) { en.x = spot.col * TILE_SIZE + TILE_SIZE / 2; en.y = spot.row * TILE_SIZE + TILE_SIZE / 2; }
    }
}
function findFreeTileNear(px, py) {
    let r0 = Math.floor(py / TILE_SIZE), c0 = Math.floor(px / TILE_SIZE);
    for (let rad = 0; rad <= 4; rad++) {
        for (let dr = -rad; dr <= rad; dr++) {
            for (let dc = -rad; dc <= rad; dc++) {
                if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
                let r = r0 + dr, c = c0 + dc;
                if (r < 1 || c < 1 || r >= MAP_ROWS - 1 || c >= MAP_COLS - 1) continue;
                if (map[r][c] === 0) return { row: r, col: c };
            }
        }
    }
    return null;
}

// ================== [รอบ 4] บอสทุกกำแพง (WALL BREAKER) ==================
function bossSmashWalls(en) {
    let dx = Math.cos(en.pAngle), dy = Math.sin(en.pAngle);
    let perpX = -dy, perpY = dx;
    let smashed = false;
    // เปิดทางเดินหน้าบอส: กว้าง ~2 ช่อง ลึก ~3 ช่อง (ห้ามแตะขอบแผนที่)
    for (let d = 20; d <= 120; d += 20) {
        for (let s = -20; s <= 20; s += 20) {
            let px = en.x + dx * d + perpX * s;
            let py = en.y + dy * d + perpY * s;
            let c = Math.floor(px / TILE_SIZE), r = Math.floor(py / TILE_SIZE);
            if (r <= 0 || c <= 0 || r >= MAP_ROWS - 1 || c >= MAP_COLS - 1) continue;
            if (map[r][c] === 1) {
                map[r][c] = 0;
                smashed = true;
                let wx = c * TILE_SIZE + 20, wy = r * TILE_SIZE + 20;
                for (let i = 0; i < 3; i++) {
                    particles.push({ type: "spark", x: wx + (Math.random() - 0.5) * 30, y: wy + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, size: 3 + Math.random() * 3, life: 14, color: "#9bb0c9" });
                }
                // [v18-5] รอยแตกขาวแตกกระจายจากจุดชน (beam สั้น 4 เส้นทิศสุ่ม)
                for (let i = 0; i < 4; i++) {
                    let ca = Math.random() * Math.PI * 2;
                    let cl = 12 + Math.random() * 16;
                    particles.push({ type: "beam", x1: wx, y1: wy, x2: wx + Math.cos(ca) * cl, y2: wy + Math.sin(ca) * cl, life: 16, maxLife: 16, color: "#dfe8f5" });
                }
            }
        }
    }
    // หินในแนวชาร์จ = แตกตายทันที
    for (let i = 0; i < enemies.length; i++) {
        let o = enemies[i];
        if (o.typeKey !== "BLOCK_OBSTACLE" || o.hp <= 0) continue;
        let relX = o.x - en.x, relY = o.y - en.y;
        let along = relX * dx + relY * dy;
        let perp = Math.abs(relX * perpX + relY * perpY);
        if (along > 0 && along < 150 && perp < en.size / 2 + 24) {
            o.hp = 0;
            smashed = true;
        }
    }
    if (smashed) {
        addShake(5, 0.3);
        playSynthSFX("heavy_explosion");
        particles.push({ type: "text", x: en.x, y: en.y - en.size / 2 - 20, text: "WALL BREAKER!", life: 55, maxLife: 55, color: "#ff923d", vy: -0.5 });
    }
}

// ================== ห้องพิเศษ ==================
function carveRoom(cr, cc, iw, ih, wide) {
    let r0 = cr - ((ih / 2) | 0) - 1, r1 = cr + ((ih / 2) | 0) + 1;
    let c0 = cc - ((iw / 2) | 0) - 1, c1 = cc + ((iw / 2) | 0) + 1;
    if (r0 < 1 || c0 < 1 || r1 >= MAP_ROWS - 1 || c1 >= MAP_COLS - 1) return false;
    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            let border = (r === r0 || r === r1 || c === c0 || c === c1);
            map[r][c] = border ? 1 : 0;
        }
    }
    let side = Math.floor(Math.random() * 4);
    if (side === 0) { map[r0][cc] = 0; if (wide) { map[r0][cc - 1] = 0; map[r0][cc + 1] = 0; } }
    else if (side === 1) { map[r1][cc] = 0; if (wide) { map[r1][cc - 1] = 0; map[r1][cc + 1] = 0; } }
    else if (side === 2) { map[cr][c0] = 0; if (wide) { map[cr - 1][c0] = 0; map[cr + 1][c0] = 0; } }
    else { map[cr][c1] = 0; if (wide) { map[cr - 1][c1] = 0; map[cr + 1][c1] = 0; } }
    return true;
}
function tryPlaceRoomSpot(minDist, maxDist) {
    for (let t = 0; t < 40; t++) {
        let cr = 6 + Math.floor(Math.random() * (MAP_ROWS - 12));
        let cc = 8 + Math.floor(Math.random() * (MAP_COLS - 16));
        let cx = cc * TILE_SIZE + TILE_SIZE / 2, cy = cr * TILE_SIZE + TILE_SIZE / 2;
        let d = Math.hypot(cx - player.x, cy - player.y);
        if (d < minDist || d > maxDist) continue;
        if (spawners.some(sp => Math.hypot(sp.x - cx, sp.y - cy) < 260)) continue;
        let clash = false;
        enemies.forEach(e2 => {
            if (e2.typeKey === "BLOCK_OBSTACLE" && Math.hypot(e2.x - cx, e2.y - cy) < 190) clash = true;
        });
        if (clash) continue;
        return { row: cr, col: cc, x: cx, y: cy };
    }
    return null;
}

