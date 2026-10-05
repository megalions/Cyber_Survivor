"use strict";

// ================== [v31] Responsive viewport ==================
function resizeGame() {
    let cw = window.innerWidth, ch = window.innerHeight;
    if (cw < 10 || ch < 10) return;
    let ar = cw / ch;
    if (ar >= 16 / 9) {                     // แนวนอน: สูงคง 720 กว้างฟรีตามจอ
        VIEW_HEIGHT = 720;
        VIEW_WIDTH = Math.round(720 * ar);
    } else {                                // แคบกว่า: ยึดกว้างขั้นต่ำ แนวตั้งยาวตามสัดส่วน แต่ cap สูง
        VIEW_WIDTH = VIEW_MIN_W;
        VIEW_HEIGHT = Math.round(VIEW_MIN_W / ar);
        if (VIEW_HEIGHT > VIEW_MAX_H) { VIEW_HEIGHT = VIEW_MAX_H; VIEW_WIDTH = Math.round(VIEW_MAX_H * ar); }
    }
    // DPR: จอ retina คมเต็ม (cap 2 กัน 4K กินแรง) — touch perfLevel 2 = ลดเหลือ 1 (ผูก perf monitor)
    let dpr = (touchMode && perfLevel >= 2) ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    RENDER_SCALE = dpr;
    canvas.width = Math.round(VIEW_WIDTH * dpr);
    canvas.height = Math.round(VIEW_HEIGHT * dpr);
    canvas.style.width = cw + "px";   // ยืด CSS เต็มจอเป๊ะสัดส่วน (VIEW คำนวณจาก AR จอ → ไม่มีภาพบิด)
    canvas.style.height = ch + "px";
}

// ================== RENDER ==================
function render() {
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);   // [v31] พิกัดโลกทั้งจอ = VIEW_* (canvas จริง = VIEW×DPR)
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
    let mapW = MAP_COLS * TILE_SIZE, mapH = MAP_ROWS * TILE_SIZE;   // [v31]
    camera.x = viewW >= mapW ? (mapW - viewW) / 2 : Math.max(0, Math.min(camCX - viewW / 2, mapW - viewW));   // จอกว้างกว่าแผนที่ = กึ่งกลาง กันล็อคชิดซ้าย
    camera.y = viewH >= mapH ? (mapH - viewH) / 2 : Math.max(0, Math.min(camCY - viewH / 2, mapH - viewH));

    if (shakeT > 0) {
        let s = shakeMag * Math.min(1, shakeT * 3);
        camera.x += (Math.random() - 0.5) * 2 * s;
        camera.y += (Math.random() - 0.5) * 2 * s;
    }

    ctx.save();
    ctx.scale(camZoom, camZoom);   // [เฟส 3A-2] โลกทั้งใบวาดในสเกลนี้ — ปิดก่อน HUD
    drawThemeBg(th, viewW, viewH);   // [เฟส A2] ภาพพื้นหลังต่อธีม (ถ้ามี)

    if (!map || !map.length || !map[0]) { ctx.restore(); return; }   // [v24→v25] map ยังไม่ถูกสร้าง — คืน ctx ก่อนออก
    let c0 = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    let c1 = Math.min(MAP_COLS - 1, Math.ceil((camera.x + viewW) / TILE_SIZE));   // [v25] บรรทัดนี้หายไประหว่างแอปพลาย v24 — ต้นเหตุ "c1 is not defined"
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
        if (b.frostZone) {   // [v17] จุดเวทน้ำแข็ง — วงค้างก่อนระเบิด
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = b.color;
            ctx.beginPath(); ctx.arc(sx, sy, b.size, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sx, sy, b.size + 5 + Math.sin(gameTime * 12) * 3, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
            return;
        }
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
        // [v17] MAGE กำลังร่าย: วงเตือนรอบตัว + ลำหรือจุดเกิดเวท (สีตามธาตุ)
        if (en.typeKey === "MAGE" && en.mageTele > 0) {
            let isFire = en.mageKind === "fire";
            let wCol = isFire ? "255, 119, 51" : "125, 249, 255";
            let prog = 1 - en.mageTele / BAL.MON.MAGE_TELEGRAPH;
            ctx.strokeStyle = "rgba(" + wCol + ", " + (0.35 + prog * 0.45) + ")";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.arc(sx, sy, en.size / 2 + 8 + prog * 4, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            if (isFire) {
                let fx = sx + Math.cos(en.mageAngle) * 24, fy = sy + Math.sin(en.mageAngle) * 24;
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(sx + Math.cos(en.mageAngle) * 190, sy + Math.sin(en.mageAngle) * 190);
                ctx.globalAlpha = 0.3 + prog * 0.3;
                ctx.stroke();
                ctx.globalAlpha = 1;
            } else {
                let zx = en.x + Math.cos(en.mageAngle) * BAL.MON.MAGE_FROST_DIST - camera.x;
                let zy = en.y + Math.sin(en.mageAngle) * BAL.MON.MAGE_FROST_DIST - camera.y;
                ctx.strokeStyle = "rgba(" + wCol + ", " + (0.25 + prog * 0.45) + ")";
                ctx.beginPath(); ctx.arc(zx, zy, 90 * (1 - prog * 0.25), 0, Math.PI * 2); ctx.stroke();   // วงจุดเกิดเวท หดเข้าเรื่อยๆ
            }
        }
        // [v18-3] OVERLORD ร่าย spiral (tele และระหว่าง spiral): พอร์ทัล 2 วงหมุนสวนทาง
        if (en.typeKey === "BOSS_OVERLORD" && (en.pState === "tele" && en.teleKind === "spiral" || en.pState === "spiral")) {
            let poR = en.size / 2 + 12;
            for (let ring = 0; ring < 2; ring++) {
                let dir = ring === 0 ? 1 : -1;
                let rCol = ring === 0 ? "255, 0, 85" : "255, 120, 180";
                ctx.strokeStyle = "rgba(" + rCol + ", " + (en.pState === "spiral" ? 0.55 : 0.35) + ")";
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                let start = gameTime * 2.4 * dir;
                ctx.arc(sx, sy, poR + ring * 7, start, start + Math.PI * 1.5);   // วงเว้นช่อง = เห็นการหมุน
                ctx.stroke();
            }
        }
        // [v18-2] DRAGON กำลังชาร์จ: คลื่นความร้อนบนพื้น 3 เส้นหยักโปร่งตามแนวพุ่ง
        if (en.typeKey === "BOSS_MELEE" && en.pState === "tele" && en.teleKind === "charge") {
            let hProg = 1 - en.pTimer / (en.phase === 2 ? BAL.BOSS_SKILL.TELEGRAPH_P2 : BAL.BOSS_SKILL.TELEGRAPH);
            for (let w = 0; w < 3; w++) {
                let wd = 60 + w * 55 + hProg * 30;
                ctx.strokeStyle = "rgba(255, 120, 40, " + (0.30 - w * 0.07 + hProg * 0.15) + ")";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let s = -1; s <= 1; s += 0.15) {   // เส้นหยัก (sine) ขวางแนวพุ่ง
                    let px = sx + Math.cos(en.pAngle) * wd + Math.cos(en.pAngle + Math.PI / 2) * s * 38;
                    let py = sy + Math.sin(en.pAngle) * wd + Math.sin(en.pAngle + Math.PI / 2) * s * 38;
                    let off = Math.sin(s * 6 + gameTime * 10) * 3;
                    px += Math.cos(en.pAngle + Math.PI / 2) * off;
                    py += Math.sin(en.pAngle + Math.PI / 2) * off;
                    if (s === -1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
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

        // ================== [v18-1] Passive aura: ตัวตนของบอสทั้ง 4 ตัว ==================
        // DRAGON: เกล็ดเรืองแสงทองเมื่อโกรธ (HP<50%) — บอกสถานะไม่ต้องดูบาร์
        if (en.typeKey === "BOSS_MELEE" && en.hp < en.maxHp * 0.5) {
            let dPulse = Math.sin(gameTime * 6) * 0.5 + 0.5;
            ctx.strokeStyle = "rgba(255, 200, 60, " + (0.30 + dPulse * 0.35) + ")";
            ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) {   // เกล็ด 6 ชิ้นรอบตัว กระพริบสลับจังหวะ
                let ga = (i / 6) * Math.PI * 2 + gameTime * 0.5;
                if ((i + Math.floor(gameTime * 4)) % 2 !== 0) continue;
                let gx = sx + Math.cos(ga) * (en.size / 2 + 8), gy = sy + Math.sin(ga) * (en.size / 2 + 8);
                ctx.beginPath();
                ctx.arc(gx, gy, 5, ga - 0.5, ga + 0.5);
                ctx.stroke();
            }
        }
        // CYBERMAGE: ดวงตาที่สามบนหน้าผาก — กระพริบแรงขึ้นตามจำนวนท่าที่ใช้ (atkIdx)
        if (en.typeKey === "BOSS_CYBERMAGE") {
            let eyeStr = 0.25 + Math.min(0.5, (en.atkIdx || 0) * 0.08) + Math.sin(gameTime * 5) * 0.15;
            let er = 4 + Math.sin(gameTime * 3) * 1;
            ctx.strokeStyle = "rgba(0, 255, 255, " + Math.max(0, eyeStr) + ")";
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(sx, sy - en.size / 2 - 8, er, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "rgba(0, 255, 255, " + Math.max(0, eyeStr - 0.1) + ")";
            ctx.beginPath(); ctx.arc(sx, sy - en.size / 2 - 8, er * 0.45, 0, Math.PI * 2); ctx.fill();
        }
        // OVERLORD: ยมทูตน้อย 3 ดวงวนรอบตัว + อนุภาคดำ-แดงตกลง (เฟส 2 = มงกุฎดำขอบแดง)
        if (en.typeKey === "BOSS_OVERLORD") {
            for (let i = 0; i < 3; i++) {
                let oa = (i / 3) * Math.PI * 2 + gameTime * 1.2;
                let ox = sx + Math.cos(oa) * (en.size / 2 + 20), oy = sy + Math.sin(oa) * (en.size / 2 + 20);
                ctx.fillStyle = "rgba(255, 40, 40, " + (0.5 + Math.sin(gameTime * 7 + i * 2) * 0.3) + ")";
                ctx.beginPath(); ctx.arc(ox, oy, 3.5, 0, Math.PI * 2); ctx.fill();
            }
            if (en.phase === 2) {   // มงกุฎศพ + เถ้าดำตก
                ctx.strokeStyle = "rgba(255, 30, 30, 0.8)";
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(sx, sy - en.size / 2 - 14, 9, Math.PI, Math.PI * 2); ctx.stroke();   // ครึ่งวง = มงกุฎ
                ctx.beginPath(); ctx.moveTo(sx - 9, sy - en.size / 2 - 14); ctx.lineTo(sx - 9, sy - en.size / 2 - 20); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(sx + 9, sy - en.size / 2 - 14); ctx.lineTo(sx + 9, sy - en.size / 2 - 20); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(sx, sy - en.size / 2 - 14); ctx.lineTo(sx, sy - en.size / 2 - 22); ctx.stroke();
            }
        }
        // DEVILCORE: ออร่ารุ้งทีมรวมใจ — วงแหวนสีตามจำนวนผู้เล่น (แต่ละสี = 1 คนที่โคลน) + เฟส 2 หมุนเร็วขึ้น
        if (en.typeKey === "BOSS_DEVILCORE" && players.length > 1) {
            let spin = gameTime * (en.phase === 2 ? 2.2 : 1.0);
            for (let i = 0; i < players.length; i++) {
                let ra = (i / players.length) * Math.PI * 2 + spin;
                let rx = sx + Math.cos(ra) * (en.size / 2 + 26), ry = sy + Math.sin(ra) * (en.size / 2 + 26);
                ctx.fillStyle = PC_COLORS[i] || "#00ffcc";
                ctx.globalAlpha = 0.55 + Math.sin(gameTime * 6 + i) * 0.25;
                ctx.beginPath(); ctx.arc(rx, ry, 4, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
        // [v18-4] ระหว่างพุ่ง: DRAGON = เปลวไอพ่นหาง / OVERLORD = วงแหวนพลังหมุนวนตาม
        if (en.isBoss && en.pState === "dash") {
            if (en.typeKey === "BOSS_MELEE") {
                let ba = Math.atan2(-en.dashVy, -en.dashVx);   // ทิศหาง = ตรงข้ามการพุ่ง
                for (let f = 0; f < 2; f++) {
                    let fl = 20 + f * 18 + Math.sin(gameTime * 20 + f) * 6;
                    ctx.strokeStyle = f === 0 ? "rgba(255, 110, 30, 0.5)" : "rgba(255, 190, 60, 0.35)";
                    ctx.lineWidth = f === 0 ? 4 : 2.5;
                    ctx.beginPath();
                    ctx.moveTo(sx + Math.cos(ba) * en.size * 0.4, sy + Math.sin(ba) * en.size * 0.4);
                    ctx.lineTo(sx + Math.cos(ba) * (en.size * 0.4 + fl), sy + Math.sin(ba) * (en.size * 0.4 + fl));
                    ctx.stroke();
                }
            } else if (en.typeKey === "BOSS_OVERLORD") {
                for (let i = 0; i < 3; i++) {
                    let ra = gameTime * 6 + (i / 3) * Math.PI * 2;
                    let rr = en.size / 2 + 6 + i * 5;
                    ctx.strokeStyle = "rgba(255, 0, 85, " + (0.45 - i * 0.12) + ")";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(sx, sy, rr, ra, ra + 1.4);   // ส่วนโค้งหมุนวน 3 ชั้น
                    ctx.stroke();
                }
            }
        }
        // [มินิแพส] bob เมื่อเดิน + กลับด้านหันเข้าหาเป้าหมาย (รูปเดิมหันซ้าย)
        let eBob = 0;
        if (en.moving && st && !st.freeze && !st.stun) eBob = Math.sin(gameTime * 10 + (en.uid % 10)) * Math.min(4, en.size * 0.06);
        ctx.save();
        ctx.translate(sx, sy - eBob);
        ctx.scale(en.face || 1, 1);
        drawSpriteOrIcon(en.icon, en.typeKey, 0, 0, en.size, animFrame(en.typeKey, en.moving, en.uid));   // [เฟส A1+A3] + เฟรมเดิน
        ctx.restore();
        if (en.hitFlash > 0) {   // [v15-C] วาบขาวตอนโดนตี — feedback ร่วมทุกคลาส (ฟื้น 4 เฟรม จาก 0.64 → 0)
            ctx.globalAlpha = 0.16 * en.hitFlash;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath(); ctx.arc(sx, sy - eBob, en.size / 2 + 3, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
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
        if (pl.berserkT > 0 && !downed) {   // [v16] ออร่าไฟแดงลุก + ตัวเลขถอยหลัง
            let bPulse = Math.sin(gameTime * 10) * 0.5 + 0.5;
            ctx.globalAlpha = 0.10 + bPulse * 0.10;
            ctx.fillStyle = "#ff3c1e";
            ctx.beginPath(); ctx.arc(psx, psy, 26 + bPulse * 5, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = "rgba(255, 80, 40, " + (0.45 + bPulse * 0.35) + ")";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 5]);
            ctx.beginPath(); ctx.arc(psx, psy, 26 + bPulse * 5, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "#ff5522";
            ctx.font = "bold 9px Courier New";
            ctx.fillText("🔥" + Math.ceil(pl.berserkT), psx, psy - 52);
        }
        if (pl.shield > 0) {
            let shB = pl.buffs || {};   // [v25] กัน buffs หาย (จุดเดียวที่ยังอ่านตรง)
            let shBlink = (shB.shield > 0 && shB.shield <= 5);   // [v22] โล่บัฟใกล้หมด ≤5 วิ = กระพริบ
            if (!shBlink || Math.floor(gameTime * 6) % 2 === 0) {   // กระพริบ ~3 ครั้ง/วิ — หาย-โชว์สลับ
                ctx.strokeStyle = "rgba(0, 180, 255, 0.85)";
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(psx, psy, 22, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = "#9bdfff";
                ctx.font = "10px Courier New";
                ctx.fillText("◉ " + Math.ceil(pl.shield), psx, psy - 30);
            }
        }
        if (players.length > 1) {   // [เฟส 3A] ป้ายผู้เล่น
            ctx.fillStyle = PC_COLORS[pi] || "#00ffcc";
            ctx.font = "bold 10px Courier New";
            ctx.fillText("P" + (pi + 1), psx, psy - 42);
        }
        // [v20-8] แถบ HP/EXP/CD ใต้เท้า — จาง 50% เมื่อเต็ม (ข้อมูลรบตามตัว การ์ดเหลือตัวตน)
        if (!downed) {
            let bw = 34, bx = psx - bw / 2;
            let hpFull = pl.hp >= pl.maxHp - 0.5;
            let xpFull = pl.xp >= pl.xpNext - 0.5;
            ctx.globalAlpha = (hpFull && xpFull && pl.shield <= 0) ? 0.5 : 1;   // เต็มหมด = จางครึ่ง
            // HP
            let hpY = psy + 18;
            let hpPct = Math.max(0, pl.hp / pl.maxHp);
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(bx, hpY, bw, 4);
            ctx.fillStyle = hpPct > 0.5 ? "#3dff8c" : hpPct > 0.25 ? "#ffd23d" : "#ff3860";
            ctx.fillRect(bx, hpY, bw * hpPct, 4);
            if (pl.shield > 0) {   // แถบโล่บางเหนือ HP
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(bx, hpY - 3, bw, 2);
                ctx.fillStyle = "#66ccff";
                ctx.fillRect(bx, hpY - 3, bw * Math.min(1, pl.shield / pl.maxHp), 2);
            }
            // EXP
            let xpY = psy + 24;
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(bx, xpY, bw, 2);
            ctx.fillStyle = "#ffcc00";
            ctx.fillRect(bx, xpY, bw * Math.min(1, pl.xp / pl.xpNext), 2);
            // CD แดช/สกิล — ไอคอนเล็กใต้แถบ: เขียว=พร้อม / เทา+ตัวเลขวิ
            let cdY = psy + 34;
            ctx.font = "9px Courier New";
            ctx.textAlign = "center";
            if (pl.dashCooldown <= 0) { ctx.fillStyle = "#00ffcc"; ctx.fillText("⇢", psx - 9, cdY); }
            else { ctx.fillStyle = "#55607a"; ctx.fillText(Math.ceil(pl.dashCooldown / 60) + "", psx - 9, cdY); }
            if (pl.skillCd <= 0) { ctx.fillStyle = "#ffcc00"; ctx.fillText("⚡", psx + 9, cdY); }
            else { ctx.fillStyle = "#55607a"; ctx.fillText(Math.ceil(pl.skillCd) + "", psx + 9, cdY); }
            ctx.textAlign = "left";
            ctx.globalAlpha = 1;
        }
        let stB = pl.buffs || {};   // [v24] กัน buffs หาย — render รายเฟรม ห้ามพังเด็ดขาด
        if (!downed && (pl.berserkT > 0 || pl.burnT > 0 || pl.slowT > 0 || stB.firerate > 0 || stB.dmg > 0 || stB.speed > 0 || droneOverdrive > 0)) {   // [v22→v24]
            let stTxt = "";
            if (pl.berserkT > 0) stTxt += "🔥" + Math.ceil(pl.berserkT) + " ";
            if (pl.burnT > 0) stTxt += "♨" + Math.ceil(pl.burnT) + " ";
            if (pl.slowT > 0) stTxt += "❄" + Math.ceil(pl.slowT) + " ";
            if (stB.firerate > 0) stTxt += "⏩" + Math.ceil(stB.firerate) + " ";
            if (stB.dmg > 0) stTxt += "💥" + Math.ceil(stB.dmg) + " ";
            if (stB.speed > 0) stTxt += "👟" + Math.ceil(stB.speed) + " ";
            if (droneOverdrive > 0) stTxt += "⚡OV ";
            if (stTxt) {
                ctx.font = "10px Courier New";
                ctx.fillStyle = "#ffcc00";
                ctx.textAlign = "center";
                ctx.fillText(stTxt, psx, psy - 52);
                ctx.textAlign = "left";
            }
        }
        if (!downed && pl.slowT > 0) {   // [v17→v21] เหลือวงฟ้าโปร่งตอนสโลว์ — ไอคอน ❄♨ ย้ายไปบรรทัดสถานะ v20-9 แล้ว (เดิมซ้อน 2 ตำแหน่ง)
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = "#7df9ff";
            ctx.beginPath(); ctx.arc(psx, psy, 24, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = downed ? 0.45 : 1;
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
        } else if (pt.type === "ring") {   // [v15] วงคลื่นกระแทกขยาย — รับสีได้ (slowWave ล็อกสีม่วงอยู่)
            ctx.globalAlpha = t * 0.7;
            ctx.strokeStyle = pt.color;
            ctx.lineWidth = pt.width || 2;
            let rad = pt.radius + (pt.maxRadius - pt.radius) * (1 - t);
            ctx.beginPath();
            ctx.arc(sx, sy, rad, 0, Math.PI * 2);
            ctx.stroke();
        } else if (pt.type === "wedge") {   // [v15] เนื้อพัดโปร่งเต็ม arc ของดาบ
            ctx.globalAlpha = t * 0.30;
            ctx.fillStyle = pt.color;
            let rad = pt.radius * (0.94 + (1 - t) * 0.10);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.arc(sx, sy, rad, pt.angle - pt.arc / 2, pt.angle + pt.arc / 2);
            ctx.closePath();
            ctx.fill();
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
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);   // [v31]
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
// [v20-6] การ์ดจิ๋วแนวตั้ง: รูป/P#/LV/เงิน/ปุ่ม AUTO — ข้อมูลละเอียดย้ายไป TAB หมด
// HP/EXP/CD ย้ายไปใต้เท้าตัวละคร (v20-8)
function cardDims() {
    return { w: 168, h: 30, gap: 5 };   // [v20] การ์ดจิ๋ว — 4 คนรวมสูงแค่ 135px ไม่ชนอะไร
}
function dashKeyLabel(i) {
    let s = inputSlots[i];
    if (!s) return "";
    return s.device === "pad" ? "PAD" : keyLabel(s.binds.dash);
}
function renderPlayerCard(i, pl) {
    let cd = cardDims();
    let x = 10, y = 10 + i * (cd.h + cd.gap);
    let pc = PC_COLORS[i] || "#00ffcc";
    ctx.fillStyle = "rgba(5, 8, 16, 0.82)";
    ctx.fillRect(x, y, cd.w, cd.h);
    ctx.strokeStyle = pc;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, cd.w - 1, cd.h - 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    // [v23] ภาพครึ่งตัว: โชว์ครึ่งบน 60% ของรูป (ช่วงอก→หัว) — คลิปในกรอบการ์ด / ผี = ภาพหรี่ + 💀 บนภาพ
    let sprSize = 20 * (SPRITE_SCALE[pl.weaponType] || 1);   // ขนาดวาดจริง (drawSpriteOrIcon คูณ SPRITE_SCALE ให้อีกที)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cd.w, 2 + sprSize * 0.6);   // โซนภาพสูง = ห่างขอบบน 2px + 60% ของรูป
    ctx.clip();
    if (pl.hp <= 0) ctx.globalAlpha = 0.4;
    drawSpriteOrIcon(pl.icon, pl.weaponType, x + 18, y + 2 + sprSize / 2, 20);
    ctx.restore();
    if (pl.hp <= 0) {
        ctx.font = "10px serif";
        ctx.fillText("💀", x + 28, y + 9);
    }
    ctx.font = "bold 10px Courier New";
    ctx.fillStyle = pc;
    ctx.fillText("P" + (i + 1), x + 42, y + cd.h / 2);
    ctx.fillStyle = "#ffd700";
    ctx.fillText("LV" + pl.level, x + 64, y + cd.h / 2);
    ctx.fillText("💰" + Math.floor(pl.coins), x + 94, y + cd.h / 2);
    // ปุ่มจิ๋ว [A] — เมาส์คลิกสลับ AUTO (เหมือนระบบ hudCardRects เดิม)
    let ax = x + cd.w - 26, ay = y + 7, aw = 20, ah = 16;
    let on = !!pl.autoAtk;
    ctx.fillStyle = on ? "rgba(0,255,204,0.15)" : "rgba(85,96,122,0.2)";
    ctx.fillRect(ax, ay, aw, ah);
    ctx.strokeStyle = on ? "#00ffcc" : "#55607a";
    ctx.lineWidth = 1;
    ctx.strokeRect(ax + 0.5, ay + 0.5, aw - 1, ah - 1);
    ctx.fillStyle = on ? "#00ffcc" : "#8fa3b8";
    ctx.font = "bold 8px Courier New";
    ctx.textAlign = "center";
    ctx.fillText("A", ax + aw / 2, ay + ah / 2 + 1);
    ctx.textAlign = "left";
    hudCardRects[i] = { autoX: ax, autoY: ay, autoW: aw, autoH: ah };
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

    // [v20-10] ป้าย 20 อันดับไหลขึ้น — เฉพาะหน้าเมนู (ไม่มี player) ตรงกลางล่างของจอ
    if (!player && stats.highscores && stats.highscores.length > 0) {
        let rows = stats.highscores.slice(0, 20);
        let rowH = 15;
        let visRows = 8;   // โชว์พร้อมกัน 8 แถว แล้ววนไหลขึ้นเรื่อยๆ
        let cyc = rows.length * rowH + 90;   // ความยาวรอบวน (มีช่องว่างท้าย)
        let off = (performance.now() / 40) % cyc;   // ไหลขึ้น ~25px/วินาที
        ctx.textAlign = "center";
        ctx.font = "11px Courier New";
        for (let i = 0; i < rows.length; i++) {
            let y = VIEW_HEIGHT - 40 + i * rowH - off;   // เริ่มใต้จอแล้วไหลขึ้น
            if (y < VIEW_HEIGHT - 40 - visRows * rowH || y > VIEW_HEIGHT - 28) continue;   // คลิปเฉพาะหน้าต่างแสดง
            let r = rows[i];
            let txt = (i + 1) + ". " + r.n.padEnd(8) + " " + String(r.s).padStart(7) + "  F" + r.f;
            ctx.fillStyle = i === 0 ? "#ffd700" : i < 3 ? "#00ffcc" : "#8fa3b8";
            ctx.fillText(txt, VIEW_WIDTH / 2, y);
        }
        ctx.fillStyle = "#55607a";
        ctx.font = "bold 11px Courier New";
        ctx.fillText("— HIGH SCORE —", VIEW_WIDTH / 2, VIEW_HEIGHT - 40 - visRows * rowH - 8);
        ctx.textAlign = "left";
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
        if (pl.hp <= 0) return;   // [v13-4] ผีไม่ขึ้นจุด — ลอยตามเพื่อนตลอด จุดซ้อนกันรก
        ctx.fillStyle = PC_COLORS[pi] || "#e8fff9";
        ctx.fillRect(mx + pl.x * sx - 1.5, my + pl.y * sy - 1.5, 3, 3);
    });
}

