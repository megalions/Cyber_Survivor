"use strict";

// ================== RENDER ==================
function render() {
    if (isWarping) { renderWarp(); return; }
    let th = getTheme();
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    if (!player) return;

    // [เฟส 3A-2] กล้อง: กึ่งกลางผู้เล่นที่มีชีวิต + ซูมยืด-หดให้เห็นทุกคน (คนเดียว = ซูม 1 เหมือนเดิม)
    let minX = player.x, maxX = player.x, minY = player.y, maxY = player.y;
    players.forEach(pl => {
        if (pl.hp <= 0) return;
        minX = Math.min(minX, pl.x); maxX = Math.max(maxX, pl.x);
        minY = Math.min(minY, pl.y); maxY = Math.max(maxY, pl.y);
    });
    let camCX = (minX + maxX) / 2, camCY = (minY + maxY) / 2;
    camZoom = Math.max(0.55, Math.min(1, Math.min(VIEW_WIDTH / (maxX - minX + 360), VIEW_HEIGHT / (maxY - minY + 320))));
    let viewW = VIEW_WIDTH / camZoom, viewH = VIEW_HEIGHT / camZoom;
    camera.x = Math.max(0, Math.min(camCX - viewW / 2, MAP_COLS * TILE_SIZE - viewW));
    camera.y = Math.max(0, Math.min(camCY - viewH / 2, MAP_ROWS * TILE_SIZE - viewH));

    if (shakeT > 0) {
        let s = shakeMag * Math.min(1, shakeT * 3);
        camera.x += (Math.random() - 0.5) * 2 * s;
        camera.y += (Math.random() - 0.5) * 2 * s;
    }

    ctx.save();
    ctx.scale(camZoom, camZoom);   // [เฟส 3A-2] โลกทั้งใบวาดในสเกลนี้ — ปิดก่อน HUD
    drawThemeBg(th, viewW, viewH);   // [เฟส A2] ภาพพื้นหลังต่อธีม (ถ้ามี)

    let c0 = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    let c1 = Math.min(MAP_COLS - 1, Math.ceil((camera.x + viewW) / TILE_SIZE));
    let r0 = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    let r1 = Math.min(MAP_ROWS - 1, Math.ceil((camera.y + viewH) / TILE_SIZE));
    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            let sx = c * TILE_SIZE - camera.x, sy = r * TILE_SIZE - camera.y;
            if (map[r][c] === 1) {
                let wImg = SPRITES["WALL_" + th.name];   // [เฟส A2+] ภาพกำแพงต่อธีม
                if (wImg && wImg.complete && wImg.naturalWidth > 0) {
                    ctx.drawImage(wImg, sx, sy, TILE_SIZE, TILE_SIZE);
                } else {
                    ctx.fillStyle = th.wallA;
                    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = th.wallB;
                    ctx.fillRect(sx + 3, sy + 3, TILE_SIZE - 6, TILE_SIZE - 6);
                    ctx.fillStyle = th.grid;                    // [เฟส A2] ขอบบนกำแพง (แสงจากพื้นห้อง)
                    ctx.fillRect(sx, sy, TILE_SIZE, 2);
                }
            } else {
                ctx.strokeStyle = th.grid;
                ctx.strokeRect(sx + 0.5, sy + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
                if ((r * 7 + c * 13) % 6 === 0) {           // [เฟส A2] จุดประกายพื้น (ตำแหน่งคงที่ต่อช่อง)
                    ctx.globalAlpha = 0.25;
                    ctx.fillStyle = th.accent;
                    ctx.fillRect(sx + ((c * 11) % 28) + 6, sy + ((r * 17) % 28) + 6, 2, 2);
                    ctx.globalAlpha = 1;
                }
            }
        }
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // ---- spawner ----
    spawners.forEach(sp => {
        let sx = sp.x - camera.x, sy = sp.y - camera.y;
        if (sx < -40 || sy < -40 || sx > viewW + 40 || sy > viewH + 40) return;
        let pulse = Math.sin(gameTime * 4) * 0.5 + 0.5;
        if (sp.bossKilled) {
            ctx.strokeStyle = "rgba(61, 255, 140, 0.4)";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "#3dff8c";
            ctx.font = "13px serif";
            ctx.fillText("✔", sx, sy);
        } else {
            let col = sp.isChallenge ? "255, 0, 170" : sp.isMega ? "255, 0, 85" : "255, 56, 96";
            ctx.strokeStyle = "rgba(" + col + ", " + (0.4 + pulse * 0.5) + ")";
            ctx.lineWidth = (sp.isMega || sp.isChallenge) ? 3 : 2;
            ctx.beginPath(); ctx.arc(sx, sy, ((sp.isMega || sp.isChallenge) ? 20 : 14) + pulse * 5, 0, Math.PI * 2); ctx.stroke();
            ctx.font = ((sp.isMega || sp.isChallenge) ? 20 : 15) + "px serif";
            ctx.fillText(sp.isChallenge ? "👹" : sp.isMega ? "👾" : "☢", sx, sy);
        }
    });

    // ---- สนามประลอง ----
    arenas.forEach(a => {
        if (a.cleared) return;
        let sx = a.x - camera.x, sy = a.y - camera.y;
        if (sx < -60 || sy < -60 || sx > viewW + 60 || sy > viewH + 60) return;
        let pulse = Math.sin(gameTime * 3) * 0.5 + 0.5;
        ctx.strokeStyle = "rgba(255, 146, 61, " + (0.2 + pulse * 0.25) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, 26 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.font = "22px serif";
        ctx.fillText("⚔", sx, sy);
        ctx.fillStyle = "#ff923d";
        ctx.font = "bold 10px Courier New";
        ctx.fillText("ARENA " + a.remaining, sx, sy + 24);
    });

    // ---- ไมน์ ----
    mines.forEach(m => {
        let sx = m.x - camera.x, sy = m.y - camera.y;
        if (sx < -40 || sy < -40 || sx > viewW + 40 || sy > viewH + 40) return;
        ctx.font = "18px serif";
        ctx.fillText("💣", sx, sy);
        let isShard = m.kind === "SHARD";
        ctx.strokeStyle = (isShard ? "rgba(123, 217, 255, " : "rgba(255, 170, 0, ") + (0.25 + Math.sin(gameTime * 8) * 0.2) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, isShard ? 12 : 14, 0, Math.PI * 2); ctx.stroke();
    });

    // ---- deployables ----
    deployables.forEach(dep => {
        let sx = dep.x - camera.x, sy = dep.y - camera.y;
        if (sx < -170 || sy < -170 || sx > viewW + 170 || sy > viewH + 170) return;

        if (dep.kind === "STAND") {
            let pulse = Math.sin(gameTime * 3) * 0.5 + 0.5;
            ctx.strokeStyle = "rgba(170, 120, 255, " + (0.14 + pulse * 0.10) + ")";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 7]);
            ctx.beginPath(); ctx.arc(sx, sy, DEPLOY.auraRadius, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.4;
            let stOwn = dep.owner || player;   // [เฟส A1-fix] สไปรต์ของ "เจ้าของ STAND" (เดิมล็อกเป็น P1 ตลอด)
            drawSpriteOrIcon(stOwn.icon, stOwn.weaponType, sx, sy, 26);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = "rgba(201, 166, 255, " + (0.3 + pulse * 0.2) + ")";
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(sx, sy, 17, 0, Math.PI * 2); ctx.stroke();
            return;
        }

        if (dep.kind === "DRONE") {
            drawSpriteOrIcon(dep.queen ? "🐝" : "🛸", dep.queen ? "DEPLOY_DRONE_QUEEN" : "DEPLOY_DRONE", sx, sy, dep.queen ? 30 : 22);   // [เฟส A1-fix]
            if (dep.queen) {
                ctx.strokeStyle = "rgba(255, 210, 61, " + (0.3 + Math.sin(gameTime * 5) * 0.2) + ")";
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(sx, sy, 20, 0, Math.PI * 2); ctx.stroke();
            }
            if (droneOverdrive > 0) {
                ctx.strokeStyle = "rgba(255, 204, 0, " + (0.4 + Math.sin(gameTime * 12) * 0.3) + ")";
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.stroke();
            }
        } else {
            let frac = Math.max(0, Math.min(1, dep.life / DEPLOY.life));
            ctx.strokeStyle = "rgba(255, 204, 0, " + (0.2 + frac * 0.45) + ")";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
            ctx.stroke();
            drawSpriteOrIcon("🗼", "DEPLOY_TURRET", sx, sy, 26);   // [เฟส A1-fix]
        }
        if (dep.hp < dep.maxHp) {
            let w = 26, pct = Math.max(0, dep.hp / dep.maxHp);
            ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
            ctx.fillRect(sx - w / 2, sy - 25, w, 3);
            ctx.fillStyle = "#66ccff";
            ctx.fillRect(sx - w / 2, sy - 25, w * pct, 3);
        }
    });

    // ---- ไอเทม ----
    items.forEach((it, idx) => {
        let sx = it.x - camera.x;
        let sy = it.y - camera.y + Math.sin(gameTime * 3 + idx * 1.3) * 3;
        if (sx < -40 || sy < -40 || sx > viewW + 40 || sy > viewH + 40) return;
        if (it.type === "PORTAL") {
            let ready = it.delay <= 0;
            let pulse = Math.sin(gameTime * 6) * 0.5 + 0.5;
            ctx.strokeStyle = ready ? "rgba(0, 255, 204, " + (0.5 + pulse * 0.5) + ")" : "rgba(120, 130, 150, 0.5)";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(sx, sy, 18 + (ready ? pulse * 7 : 0), 0, Math.PI * 2); ctx.stroke();
            ctx.font = "26px serif";
            ctx.fillText("🌀", sx, sy);
            if (ready) {
                ctx.fillStyle = "#00ffcc";
                ctx.font = "bold 11px Courier New";
                ctx.fillText("WARP", sx, sy + 30);
            }
            return;
        }
        ctx.font = (it.size + 6) + "px serif";
        ctx.fillText(it.icon, sx, sy);
        if (it.type === "COIN" || it.type === "EXP" || it.type === "COIN_BIG") {
            let col = it.type === "EXP" ? "123, 217, 255" : "255, 215, 0";
            ctx.strokeStyle = "rgba(" + col + ", " + (0.35 + Math.sin(gameTime * 5) * 0.3) + ")";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sx, sy, it.size, 0, Math.PI * 2); ctx.stroke();
        } else if (it.type === "CORE") {
            ctx.strokeStyle = "rgba(255, 60, 90, " + (0.45 + Math.sin(gameTime * 6) * 0.35) + ")";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(sx, sy, it.size, 0, Math.PI * 2); ctx.stroke();
        } else if (it.type === "DEVIL") {
            ctx.strokeStyle = "rgba(170, 60, 255, " + (0.4 + Math.sin(gameTime * 4) * 0.3) + ")";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(sx, sy, it.size, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "#c77dff";
            ctx.font = "bold 10px Courier New";
            ctx.fillText("?", sx, sy + 30);
        } else if (it.type === "HEART_BIG") {
            ctx.strokeStyle = "rgba(255, 123, 217, " + (0.45 + Math.sin(gameTime * 5) * 0.35) + ")";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(sx, sy, it.size, 0, Math.PI * 2); ctx.stroke();
        } else if (it.type.indexOf("BUFF_") === 0) {
            ctx.strokeStyle = it.color;
            ctx.globalAlpha = 0.35 + Math.sin(gameTime * 5) * 0.3;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sx, sy, it.size, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
        }
    });

    // ---- กระสุนศัตรู ----
    enemyProjectiles.forEach(b => {
        let sx = b.x - camera.x, sy = b.y - camera.y;
        if (sx < -20 || sy < -20 || sx > viewW + 20 || sy > viewH + 20) return;
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(sx, sy, b.size, 0, Math.PI * 2); ctx.fill();
    });

    // ---- ศัตรู ----
    enemies.forEach(en => {
        let sx = en.x - camera.x, sy = en.y - camera.y;
        if (sx < -100 || sy < -100 || sx > viewW + 100 || sy > viewH + 100) return;
        let st = en.status;
        if (st) {
            if (st.freeze > 0) {
                ctx.strokeStyle = "rgba(150, 220, 255, 0.6)";
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(sx, sy, en.size / 2 + 4, 0, Math.PI * 2); ctx.stroke();
            } else if (st.slow > 0) {
                ctx.strokeStyle = "rgba(170, 120, 255, 0.6)";
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(sx, sy, en.size / 2 + 3, 0, Math.PI * 2); ctx.stroke();
            }
            if (st.stun > 0) {
                ctx.strokeStyle = "#ffe066";
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(sx, sy, en.size / 2 + 6, 0, Math.PI * 2); ctx.stroke();
            }
        }
        if (en.elite) {
            ctx.strokeStyle = en.elite.color;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.arc(sx, sy, en.size / 2 + 6, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = en.elite.color;
            ctx.font = "bold 9px Courier New";
            ctx.fillText("★" + en.elite.th, sx, sy - en.size / 2 - 14);
        }
        // [รอบ 4] มอนกำลังหงุดหงิด (ใกล้แฮ็กวาร์ป) — เตือนด้วย "!"
        if (en.frustration >= 3 && !en.isBoss) {
            ctx.fillStyle = "#7df9ff";
            ctx.font = "bold 12px Courier New";
            ctx.fillText("!", sx, sy - en.size / 2 - 12);
        }
        if (en.isBoss && en.pState === "tele") {
            let blink = Math.sin(gameTime * 22) > 0;
            let devOwn = (en.typeKey === "BOSS_DEVILCORE" && en.teleOwner !== undefined && players[en.teleOwner]) ? en.teleOwner : -1;
            if (devOwn >= 0) {
                ctx.strokeStyle = PC_COLORS[devOwn] || "#ff5577";
                ctx.globalAlpha = blink ? 0.95 : 0.3;
            } else {
                ctx.strokeStyle = blink ? "rgba(255, 80, 80, 0.95)" : "rgba(255, 80, 80, 0.3)";
                ctx.globalAlpha = 1;
            }
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(sx, sy, en.size / 2 + 10, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
            if (devOwn >= 0) {   // [3C] บอกเจ้าของท่า + ชื่อท่า
                let MOVE_TH = { charge: "ชาร์จ", burst: "กระจาย", summon: "อัญเชิญ", teleport: "เทเลพอร์ต", spiral: "สไปรัล", slashNova: "โนวา", homing: "โฮม", fan: "พัดกระสุน", beam: "ลำแสง" };
                ctx.fillStyle = PC_COLORS[devOwn] || "#ff5577";
                ctx.font = "bold 12px Courier New";
                ctx.fillText("P" + (devOwn + 1) + " · " + (MOVE_TH[en.teleKind] || en.teleKind), sx, sy - en.size / 2 - 22);
            }
            if (en.teleKind === "charge") {
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + Math.cos(en.pAngle) * 170, sy + Math.sin(en.pAngle) * 170);
                ctx.stroke();
            }
        }
        if ((en.typeKey === "BOSS_OVERLORD" || en.typeKey === "BOSS_DEVILCORE") && en.phase === 2) {
            ctx.strokeStyle = en.typeKey === "BOSS_DEVILCORE" ? "rgba(255, 0, 170, " + (0.2 + Math.sin(gameTime * 5) * 0.12) + ")"
                                                              : "rgba(255, 0, 60, " + (0.2 + Math.sin(gameTime * 5) * 0.12) + ")";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sx, sy, en.size / 2 + 26, 0, Math.PI * 2); ctx.stroke();
        }
        if (en.typeKey === "BOSS_DEVILCORE") {
            ctx.strokeStyle = "rgba(255, 0, 170, " + (0.25 + Math.sin(gameTime * 4) * 0.15) + ")";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sx, sy, en.size / 2 + 14, 0, Math.PI * 2); ctx.stroke();
        }
        // [มินิแพส] bob เมื่อเดิน + กลับด้านหันเข้าหาเป้าหมาย (รูปเดิมหันซ้าย)
        let eBob = 0;
        if (en.moving && st && !st.freeze && !st.stun) eBob = Math.sin(gameTime * 10 + (en.uid % 10)) * Math.min(4, en.size * 0.06);
        ctx.save();
        ctx.translate(sx, sy - eBob);
        ctx.scale(en.face || 1, 1);
        drawSpriteOrIcon(en.icon, en.typeKey, 0, 0, en.size, animFrame(en.typeKey, en.moving, en.uid));   // [เฟส A1+A3] + เฟรมเดิน
        ctx.restore();
        if (en.hp < en.maxHp || en.isBoss || en.shield > 0) {
            let w = en.isBoss ? 64 : Math.max(20, en.size);
            let h = en.isBoss ? 6 : 3;
            let pct = Math.max(0, en.hp / en.maxHp);
            let by = sy - en.size / 2 - (en.isBoss ? 14 : 8);
            ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
            ctx.fillRect(sx - w / 2, by, w, h);
            ctx.fillStyle = en.isBoss ? "#ff3860" : "#7dff9a";
            ctx.fillRect(sx - w / 2, by, w * pct, h);
            if (en.shield > 0) {
                let sh = Math.max(2, h - 1);
                let sby = by - sh - 2;
                ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
                ctx.fillRect(sx - w / 2, sby, w, sh);
                ctx.fillStyle = "#66ccff";
                ctx.fillRect(sx - w / 2, sby, w * Math.min(1, en.shield / Math.max(1, en.maxHp)), sh);
            }
        }
    });

    // ---- กระสุนผู้เล่น ----
    playerProjectiles.forEach(p => {
        let sx = p.x - camera.x, sy = p.y - camera.y;
        if (sx < -30 || sy < -30 || sx > viewW + 30 || sy > viewH + 30) return;
        if (p.type === "LASER") {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(sx - p.vx * 2.2, sy - p.vy * 2.2);
            ctx.lineTo(sx, sy);
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === "MISSILE") {
            // [แพตช์] จรวด 🚀 หมุนตามทิศบิน (emoji/sprite ชี้ขึ้น-ขวา 45° — ปรับ Math.PI/4 ถ้า sprite หันอื่น)
            let velAng = Math.atan2(p.vy, p.vx);
            // หางไอพ่น
            ctx.strokeStyle = "rgba(255, 0, 85, 0.35)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(sx - Math.cos(velAng) * 4, sy - Math.sin(velAng) * 4);
            ctx.lineTo(sx - Math.cos(velAng) * 18, sy - Math.sin(velAng) * 18);
            ctx.stroke();
            // ตัวจรวด
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(velAng + Math.PI / 4);
            drawSpriteOrIcon("🚀", "MISSILE", 0, 0, Math.round(p.size * 1.5));
            ctx.restore();
        } else {
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, Math.PI * 2); ctx.fill();
        }
    });

        // ---- ผู้เล่น (ทุกคน) ----
    players.forEach((pl, pi) => {
        let psx = pl.x - camera.x, psy = pl.y - camera.y;
        let downed = pl.hp <= 0;
        if (downed) ctx.globalAlpha = 0.45;
        if (pl.dashCritTimer > 0) {
            let pulse = Math.sin(gameTime * 14) * 0.5 + 0.5;
            ctx.strokeStyle = "rgba(255, 146, 61, " + (0.35 + pulse * 0.4) + ")";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.arc(psx, psy, 27, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "#ff923d";
            ctx.font = "bold 9px Courier New";
            ctx.fillText("CRIT!", psx, psy - 34);
        }
        if (!downed) {
            ctx.strokeStyle = "rgba(0, 255, 204, 0.35)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(psx + Math.cos(pl.angle) * 16, psy + Math.sin(pl.angle) * 16);
            ctx.lineTo(psx + Math.cos(pl.angle) * 52, psy + Math.sin(pl.angle) * 52);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        if (downed) {
            drawSpriteOrIcon(pl.icon, pl.weaponType, psx, psy, 26);   // [เฟส A1] โปร่งตาม globalAlpha อยู่แล้ว
            ctx.font = "13px serif";
            ctx.fillText("💀", psx + 16, psy - 12);
        } else if (!(pl.hurtTimer > 0 && Math.floor(frameCount / 4) % 2 === 0)) {
            // [มินิแพส] bob เมื่อเดิน + กลับด้านหันเข้าหาเป้าเล็ง
            let pBob = pl.moving ? Math.sin(gameTime * 10 + pi) * 2.5 : 0;
            ctx.save();
            ctx.translate(psx, psy - pBob);
            ctx.scale(pl.face || 1, 1);
            drawSpriteOrIcon(pl.icon, pl.weaponType, 0, 0, 26, animFrame(pl.weaponType, pl.moving, pi));   // [เฟส A1+A3]
            ctx.restore();
        }
        if (pl.shield > 0) {
            ctx.strokeStyle = "rgba(0, 180, 255, 0.85)";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(psx, psy, 22, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "#9bdfff";
            ctx.font = "10px Courier New";
            ctx.fillText("◉ " + Math.ceil(pl.shield), psx, psy - 30);
        }
        if (players.length > 1) {   // [เฟส 3A] ป้ายผู้เล่น
            ctx.fillStyle = PC_COLORS[pi] || "#00ffcc";
            ctx.font = "bold 10px Courier New";
            ctx.fillText("P" + (pi + 1), psx, psy - 42);
        }
        ctx.globalAlpha = 1;
    });

    // ---- เอฟเฟกต์ ----
    particles.forEach(pt => {
        let sx = pt.x - camera.x, sy = pt.y - camera.y;
        let t = Math.max(0, pt.life / pt.maxLife);
        if (pt.type === "spark") {
            ctx.globalAlpha = t;
            ctx.fillStyle = pt.color;
            ctx.fillRect(sx - pt.size / 2, sy - pt.size / 2, pt.size, pt.size);
        } else if (pt.type === "amb") {   // [เฟส A2] ฝุ่นบรรยากาศธีม
            ctx.globalAlpha = t * 0.35;
            ctx.fillStyle = pt.color;
            ctx.fillRect(sx - pt.size / 2, sy - pt.size / 2, pt.size, pt.size);
        } else if (pt.type === "explosion") {
            ctx.globalAlpha = t;
            ctx.fillStyle = pt.color;
            ctx.beginPath(); ctx.arc(sx, sy, pt.radius * (1.1 - t * 0.35), 0, Math.PI * 2); ctx.fill();
        } else if (pt.type === "slash") {
            ctx.globalAlpha = t;
            ctx.strokeStyle = pt.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(sx, sy, pt.radius * (0.92 + (1 - t) * 0.12), pt.angle - pt.arc / 2, pt.angle + pt.arc / 2);
            ctx.stroke();
        } else if (pt.type === "slowWave") {
            ctx.globalAlpha = t * (pt.faint ? 0.14 : 0.32);
            ctx.strokeStyle = "rgba(170, 130, 255, 0.6)";
            ctx.lineWidth = 2;
            let rad = pt.radius + (pt.maxRadius - pt.radius) * (1 - t);
            let arcRad = (pt.arcDeg * Math.PI) / 180;
            ctx.beginPath();
            ctx.arc(sx, sy, rad, pt.angle - arcRad / 2, pt.angle + arcRad / 2);
            ctx.stroke();
        } else if (pt.type === "beam") {
            ctx.globalAlpha = t;
            ctx.strokeStyle = pt.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(pt.x1 - camera.x, pt.y1 - camera.y);
            ctx.lineTo(pt.x2 - camera.x, pt.y2 - camera.y);
            ctx.stroke();
        } else if (pt.type === "dmg") {
            ctx.globalAlpha = Math.min(1, t * 1.6);
            ctx.fillStyle = pt.color;
            ctx.font = pt.crit ? "bold 16px Courier New" : "bold 11px Courier New";
            ctx.fillText(pt.text, sx, sy);
        } else if (pt.type === "text") {
            ctx.globalAlpha = Math.min(1, t * 1.5);
            ctx.fillStyle = pt.color;
            ctx.font = "bold 13px Courier New";
            ctx.fillText(pt.text, sx, sy);
        }
    });
    ctx.globalAlpha = 1;

    ctx.restore();   // [เฟส 3A-2] จบสเกลโลก — กลับพิกัดจอจริงก่อน HUD/ลูกศร/minimap

    // [เฟส A2] vignette — ขอบจอมืดลงเพิ่มความลึก (เฉพาะโลก ไม่โดน HUD/การ์ด)
    let vg = ctx.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.45,
                                      VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    drawOffscreenArrows();
    renderHUD();
    renderTouchUI();
    renderMinimap();
}

function renderWarp() {
    ctx.fillStyle = "#02030a";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    let cx = VIEW_WIDTH / 2, cy = VIEW_HEIGHT / 2;
    ctx.lineWidth = 2;
    warpStars.forEach(s => {
        let x1 = cx + Math.cos(s.a) * s.d, y1 = cy + Math.sin(s.a) * s.d;
        let x2 = cx + Math.cos(s.a) * Math.max(0, s.d - s.spd * 6), y2 = cy + Math.sin(s.a) * Math.max(0, s.d - s.spd * 6);
        ctx.strokeStyle = "rgba(0, 255, 204, " + Math.min(1, s.spd / 14) + ")";
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 22px Courier New";
    ctx.fillText("WARPING...", cx, cy - 90);
    ctx.font = "12px Courier New";
    ctx.fillStyle = "#8fa3b8";
    let nf = currentFloor + 1;
    let tag = nf % 10 === 0 ? " — DEVIL CORE AHEAD" : (nf % 5 === 0 ? " — OVERLORD AHEAD" : " LOADING");
    ctx.fillText("FLOOR " + nf + tag, cx, cy - 66);
    let p = 1 - warpTimer / WARP_DURATION;
    ctx.fillStyle = "rgba(5, 8, 16, 0.8)";
    ctx.fillRect(cx - 120, cy + 70, 240, 12);
    ctx.fillStyle = "#00ffcc";
    ctx.fillRect(cx - 118, cy + 72, 236 * p, 8);
    ctx.textBaseline = "alphabetic";
}

// ================== [เฟส 1] การ์ดผู้เล่น (มุมซ้ายบน วางต่อกัน) ==================
// [แพตช์ UI] การ์ดยืดหดตามจำนวนผู้เล่น: 1-3 คน = 300px / 4 คน = 240px (ไม่ทับ UI ขวา)
function cardDims() {
    if (players.length >= 4) return { w: 240, h: 96, gap: 10 };
    return { w: 300, h: 112, gap: 12 };
}
function dashKeyLabel(i) {
    let s = inputSlots[i];
    if (!s) return "";
    return s.device === "pad" ? "PAD" : keyLabel(s.binds.dash);
}
function renderPlayerCard(i, pl) {
    let cd = cardDims();
    let x = 10 + i * (cd.w + cd.gap), y = 10;
    let compact = players.length >= 4;
    let pc = PC_COLORS[i] || "#00ffcc";
    ctx.fillStyle = "rgba(5, 8, 16, 0.82)";
    ctx.fillRect(x, y, cd.w, cd.h);
    ctx.strokeStyle = pc;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, cd.w - 1, cd.h - 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // แถว 1: ไอคอน + P# + LV + ปุ่ม AUTO (compact: ไม่โชว์ชื่อคลาส)
    drawSpriteOrIcon(pl.icon, pl.weaponType, x + 18, y + 14, compact ? 20 : 24);   // [แก้] รูปก่อน emoji
    ctx.font = "bold 10px Courier New";
    ctx.fillStyle = pc;
    //ctx.fillText("P" + (i + 1), x + 24, y + 14);
    ctx.font = "bold 10px Courier New";
    ctx.fillStyle = pc;
    ctx.fillText("P" + (i + 1), x + (compact ? 32 : 36), y + 14);
    if (!compact) {
        ctx.font = "bold 11px Courier New";
        ctx.fillText(WEAPONS[pl.weaponType].name, x + 52, y + 16);
        ctx.fillStyle = "#ffd700";
        ctx.fillText("LV " + pl.level, x + 170, y + 16);
    } else {
        ctx.fillStyle = "#ffd700";
        ctx.fillText("LV" + pl.level, x + 46, y + 14);
    }
    let ax = x + cd.w - 58, ay = y + 4, aw = 54, ah = 14;
    let on = !!pl.autoAtk;
    ctx.fillStyle = on ? "rgba(0,255,204,0.15)" : "rgba(85,96,122,0.2)";
    ctx.fillRect(ax, ay, aw, ah);
    ctx.strokeStyle = on ? "#00ffcc" : "#55607a";
    ctx.lineWidth = 1;
    ctx.strokeRect(ax + 0.5, ay + 0.5, aw - 1, ah - 1);
    ctx.fillStyle = on ? "#00ffcc" : "#8fa3b8";
    ctx.font = "bold 8px Courier New";
    ctx.textAlign = "center";
    ctx.fillText("AUTO " + (on ? "ON" : "OFF"), ax + aw / 2, ay + 10);
    ctx.textAlign = "left";
    hudCardRects[i] = { autoX: ax, autoY: ay, autoW: aw, autoH: ah };

    // แถว 2: HP
    let by = y + 20;
    let hpPct = Math.max(0, pl.hp / pl.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x + 6, by, cd.w - 12, 8);
    ctx.fillStyle = hpPct > 0.5 ? "#3dff8c" : hpPct > 0.25 ? "#ffd23d" : "#ff3860";
    ctx.fillRect(x + 6, by, (cd.w - 12) * hpPct, 8);
    ctx.fillStyle = "#e8fff9";
    ctx.font = compact ? "8px Courier New" : "9px Courier New";
    ctx.fillText("HP " + Math.ceil(pl.hp) + "/" + pl.maxHp + (pl.shield > 0 ? " ◉" + Math.ceil(pl.shield) : ""), x + 8, by + 7);

    // แถว 3: XP
    by += 10;
    let xpPct = Math.min(1, pl.xp / pl.xpNext);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x + 6, by, cd.w - 12, 6);
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(x + 6, by, (cd.w - 12) * xpPct, 6);
    if (!compact) {
        ctx.fillStyle = "#fff3c4";
        ctx.font = "8px Courier New";
        ctx.fillText("XP " + Math.floor(pl.xp) + "/" + pl.xpNext, x + 8, by + 5);
    }

    // แถว 4: เหรียญ + คริ (compact: รวมบรรทัด)
    by += compact ? 15 : 18;
    ctx.font = compact ? "8px Courier New" : "10px Courier New";
    ctx.fillStyle = "#ffd700";
    ctx.fillText("💰" + Math.floor(pl.coins), x + 6, by);
    if (!compact && ((pl.levels.CRIT_CIRCUIT || 0) + (pl.levels.OVERCHARGE || 0) > 0 || metaUnlocks.crit)) {
        ctx.fillStyle = "#ff923d";
        ctx.fillText("🎯 " + Math.round(getCritChance(pl) * 100) + "% ×" + getCritMult(pl).toFixed(1), x + 110, by);
    }

    // แถว 5: แดช + สกิล (compact: ชื่อสั้น)
    if (!compact) {
        by += 13;
        let dashReady = pl.dashCooldown <= 0;
        ctx.fillStyle = dashReady ? "#00ffcc" : "#55607a";
        ctx.fillText(dashReady ? "⇢DASH " + dashKeyLabel(i) : "⇢DASH " + Math.ceil(pl.dashCooldown / 60) + "s", x + 8, by);
        let skReady = pl.skillCd <= 0;
        ctx.fillStyle = skReady ? "#ffcc00" : "#55607a";
        ctx.fillText(skReady ? "⚡" + CLASS_SKILLS[pl.weaponType].name : "⚡" + Math.ceil(pl.skillCd) + "s", x + 140, by);
    }

    // แถว 6: บัฟ + หน่วยรบ (compact: ไอคอนอย่างเดียว)
    if (!compact) {
        by += 13;
        ctx.font = "10px Courier New";
        let seg = "";
        if (pl.buffs.shield > 0) seg += "🛡" + Math.ceil(pl.buffs.shield) + " ";
        if (pl.buffs.firerate > 0) seg += "⏩ ";
        if (pl.buffs.dmg > 0) seg += "💥 ";
        if (pl.buffs.speed > 0) seg += "👟 ";
        if (droneOverdrive > 0) seg += "🔥OV ";
        if (seg) { ctx.fillStyle = "#ffcc00"; ctx.fillText(seg, x + 8, by); }
        let seg2 = "";
        if (pl.turretLevel > 0) seg2 += "🗼" + countDeployKind("TURRET", pl) + "/" + pl.turretLevel + " ";
        if (pl.standLevel > 0) seg2 += "👁" + countDeployKind("STAND", pl) + " ";
        if (pl.droneTarget > 0) seg2 += "🛸" + countDeployKind("DRONE", pl) + "/" + pl.droneTarget + " ";
        if (pl.mineLevel > 0 || pl.shardMineLevel > 0) {
            let own = 0;
            mines.forEach(m => { if ((m.owner || player) === pl) own++; });
            seg2 += "💣" + own + "/" + mineCap(pl);
        }
        if (seg2) { ctx.fillStyle = "#9fd6ff"; ctx.fillText(seg2, x + 155, by); }
    } else {
        // compact: รวมหน่วยรบเป็นไอคอนเดียว
        by += 10;
        ctx.font = "8px Courier New";
        let seg2 = "";
        if (pl.turretLevel > 0) seg2 += "🗼" + countDeployKind("TURRET", pl);
        if (pl.standLevel > 0) seg2 += "👁";
        if (pl.droneTarget > 0) seg2 += "🛸" + countDeployKind("DRONE", pl);
        if (pl.mineLevel > 0 || pl.shardMineLevel > 0) {
            let own = 0;
            mines.forEach(m => { if ((m.owner || player) === pl) own++; });
            seg2 += "💣" + own + "/" + mineCap(pl);
        }
        if (pl.curses && pl.curses.length) seg2 += " 🃏×" + pl.curses.length;
        if (seg2) { ctx.fillStyle = "#9fd6ff"; ctx.fillText(seg2, x + 6, by); }
    }

    // แถว 7: Curse (เฉพาะไม่ compact)
    if (!compact) {
        by += 13;
        if (pl.curses && pl.curses.length) {
            ctx.fillStyle = "#ff5577";
            ctx.font = "9px Courier New";
            let txt = "🃏 " + pl.curses.slice(-2).join(" · ");
            if (txt.length > 40) txt = txt.slice(0, 39) + "…";
            ctx.fillText(txt, x + 8, by);
        }
    }
}

function renderHUD() {
    ctx.textBaseline = "alphabetic";

    let boss = null, bd = Infinity;
    enemies.forEach(en => {   // [เฟส 3A] ระยะจากผู้เล่นที่ใกล้สุด
        if (!en.isBoss) return;
        let np = nearestPlayerTo(en.x, en.y);
        let d = np ? Math.hypot(np.x - en.x, np.y - en.y) : Infinity;
        if (d < bd) { bd = d; boss = en; }
    });
    if (boss && bd < 620) {
        let w = 320, bx = (VIEW_WIDTH - w) / 2, by = 12;
        let pct = Math.max(0, boss.hp / boss.maxHp);
        ctx.textAlign = "center";
        let nameCol = boss.typeKey === "BOSS_DEVILCORE" ? "#ff55bb" : boss.typeKey === "BOSS_OVERLORD" ? "#ff5577" : "#ff9db1";
        ctx.fillStyle = nameCol;
        ctx.font = "bold 12px Courier New";
        ctx.fillText(BOSS_NAMES[boss.typeKey] + (boss.phase === 2 ? " // ENRAGED" : ""), VIEW_WIDTH / 2, by - 1);
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(bx, by + 3, w, 10);
        ctx.fillStyle = "#ff3860";
        ctx.fillRect(bx + 1, by + 4, (w - 2) * pct, 8);
        if (boss.shield > 0) {
            ctx.fillStyle = "#66ccff";
            ctx.fillRect(bx + 1, by + 1, (w - 2) * Math.min(1, boss.shield / boss.maxHp), 2);
        }
    }

    let toastY = 58;
    for (let i = toasts.length - 1; i >= 0; i--) {
        let tt = toasts[i];
        tt.life--;
        if (tt.life <= 0) { toasts.splice(i, 1); continue; }
        let alpha = Math.min(1, tt.life / 30);
        ctx.globalAlpha = alpha;
        ctx.textAlign = "center";
        ctx.fillStyle = "#00ffcc";
        ctx.font = "bold 13px Courier New";
        ctx.fillText(tt.title, VIEW_WIDTH / 2, toastY);
        ctx.fillStyle = "#8fa3b8";
        ctx.font = "11px Courier New";
        ctx.fillText(tt.sub, VIEW_WIDTH / 2, toastY + 15);
        ctx.globalAlpha = 1;
        toastY += 34;
    }
    // [เฟส 2C] การ์ดผู้เล่นทุกคน: มุมซ้ายบน วางต่อกัน
    hudCardRects.length = 0;
    players.forEach((pl, i) => renderPlayerCard(i, pl));
    ctx.textAlign = "right";
    ctx.font = "bold 13px Courier New";
    ctx.fillStyle = "#8fa3b8";
    ctx.fillText("FLOOR " + currentFloor + " · " + getTheme().name, VIEW_WIDTH - 14, 56);
    let modY = 72;
    if (runMods.list.length > 0) {
        ctx.font = "10px Courier New";
        ctx.fillStyle = "#c77dff";
        // [แพตช์ UI] สรุป mods ที่ซ้ำเป็น "GREED×5"
        let modCounts = {};
        runMods.list.forEach(m => { modCounts[m] = (modCounts[m] || 0) + 1; });
        let modTxt = Object.keys(modCounts).map(k => modCounts[k] > 1 ? k + "×" + modCounts[k] : k).join(" ");
        ctx.fillText(modTxt, VIEW_WIDTH - 14, modY);
        modY += 14;
    }
    ctx.font = "bold 13px Courier New";
    ctx.fillStyle = "#cffcff";
    ctx.fillText("SCORE " + score, VIEW_WIDTH - 14, modY); modY += 18;
    let bk = spawners.filter(s => s.bossKilled).length;
    ctx.fillStyle = (spawners.length > 0 && bk >= spawners.length) ? "#3dff8c" : "#ff5577";
    ctx.fillText("BOSS " + bk + "/" + spawners.length, VIEW_WIDTH - 14, modY); modY += 18;

    if (killStreak >= 3) {
        ctx.fillStyle = "#ffcc00";
        ctx.font = "bold 13px Courier New";
        ctx.fillText("COMBO x" + killStreak + (killStreak >= 10 ? " 🎯+10%" : "") + " (+" + (Math.min(10, killStreak) * 10) + "%)", VIEW_WIDTH - 14, modY);
    }

    if (sfxVolIdx === 2) {
        ctx.font = "10px Courier New";
        ctx.fillStyle = "#55607a";
        ctx.fillText("🔇 MUTE [M]", VIEW_WIDTH - 14, VIEW_HEIGHT - 104);
    }

    if (portalItemSpawned) {
        ctx.textAlign = "center";
        ctx.fillStyle = Math.sin(gameTime * 6) > 0 ? "#00ffcc" : "#0a6655";
        ctx.font = "bold 14px Courier New";
        ctx.fillText("🌀 WARP GATE OPEN 🌀", VIEW_WIDTH / 2, VIEW_HEIGHT - 18);
    }
    ctx.textAlign = "left";
}

function renderMinimap() {
    let mw = 110, mh = 88;
    let mx = VIEW_WIDTH - mw - 10, my = VIEW_HEIGHT - mh - 10;
    ctx.fillStyle = "rgba(5, 8, 16, 0.85)";
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = "#272a3d";
    ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
    let sx = mw / (MAP_COLS * TILE_SIZE), sy = mh / (MAP_ROWS * TILE_SIZE);
    enemies.forEach(en => {
        if (!en.isBoss) return;
        ctx.fillStyle = en.typeKey === "BOSS_DEVILCORE" ? "#ff00aa" : en.typeKey === "BOSS_OVERLORD" ? "#ff00ff" : "#ff3860";
        let s2 = (en.typeKey === "BOSS_OVERLORD" || en.typeKey === "BOSS_DEVILCORE") ? 3 : 2;
        ctx.fillRect(mx + en.x * sx - s2, my + en.y * sy - s2, s2 * 2, s2 * 2);
    });
    spawners.forEach(sp => {
        ctx.fillStyle = sp.bossKilled ? "#3dff8c" : (sp.isChallenge ? "#ff00aa" : "#ff923d");
        ctx.fillRect(mx + sp.x * sx - 1.5, my + sp.y * sy - 1.5, 3, 3);
    });
    arenas.forEach(a => {
        if (a.cleared) return;
        ctx.fillStyle = "#ff923d";
        ctx.fillRect(mx + a.x * sx - 2, my + a.y * sy - 2, 4, 4);
    });
    deployables.forEach(dep => {
        ctx.fillStyle = dep.kind === "TURRET" ? "#66ccff" : dep.kind === "DRONE" ? (dep.queen ? "#ffd23d" : "#9fd6ff") : "#c9a6ff";
        ctx.fillRect(mx + dep.x * sx - 1, my + dep.y * sy - 1, 2, 2);
    });
    items.forEach(it => {
        if (it.type !== "PORTAL" && it.type !== "DEVIL") return;
        ctx.fillStyle = it.type === "PORTAL" ? (Math.sin(gameTime * 6) > 0 ? "#00ffcc" : "#0a6655") : "#c77dff";
        ctx.fillRect(mx + it.x * sx - 2, my + it.y * sy - 2, 4, 4);
    });
    players.forEach((pl, pi) => {   // [เฟส 3A] จุดผู้เล่นทุกคนบน minimap
        ctx.fillStyle = PC_COLORS[pi] || "#e8fff9";
        ctx.fillRect(mx + pl.x * sx - 1.5, my + pl.y * sy - 1.5, 3, 3);
    });
}

