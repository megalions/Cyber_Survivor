"use strict";

// ================== ผู้เล่นโดนตี / จบเกม ==================
// [เฟส 2A] รับผู้เล่นเป็นพารามิเตอร์ — ดาเมจ/โล่/i-frame/ฟื้นชีพ เป็นของรายคน
function damagePlayer(pl, amount) {
    if (!pl || isGameOver || isWarping) return;
    if (pl.hp <= 0) return;   // [3C-fix] ผีไม่โดนดาเมจ — ไม่รี-ประกาศ DOWN ไม่เผา clean-floor ไม่กิน killStreak
    if (!(amount > 0)) return;   // [v13-2] ดาเมจ 0 (หิน BLOCK_OBSTACLE) — ไม่กระพริบ/ไม่เสียง/ไม่เขย่า/ไม่เผา clean-floor
    if (pl.isInvulnerable || pl.hurtTimer > 0) return;
    amount *= runMods.dmgTakenMult;
    if (runMods.enemyCrit > 0 && Math.random() < runMods.enemyCrit) {
        amount *= 2;
        particles.push({ type: "text", x: pl.x, y: pl.y - 48, text: "CRIT!", life: 40, maxLife: 40, color: "#ff3860", vy: -0.8 });
    }
    floorClean = false;
    killStreak = 0;
    let dmg = amount;
    if (pl.shield > 0) {
        let absorbed = Math.min(pl.shield, dmg);
        pl.shield -= absorbed;
        dmg -= absorbed;
        createSparks(pl.x, pl.y, "#00ccff");
        if (dmg <= 0) return;
    }
    pl.hp -= dmg;
    pl.hurtTimer = BAL.PLR.HURT_TIMER;
    playSynthSFX("hurt");
    createSparks(pl.x, pl.y, "#ff0055");
    addShake(3, 0.15);
    if (pl.hp <= 0) {
        if (metaUnlocks.revive && !pl.usedRevive) {
            pl.usedRevive = true;
            pl.hp = Math.floor(pl.maxHp * 0.5);
            pl.hurtTimer = 120;
            pl.shield = Math.max(pl.shield, 50);
            announce("💠 PHOENIX PROTOCOL ACTIVATED", "#66ccff");
            playSynthSFX("warp");
            addHitStop(5); addShake(8, 0.4);
            particles.push({ type: "explosion", x: pl.x, y: pl.y, radius: 150, life: 20, maxLife: 20, color: "rgba(102, 204, 255, 0.6)" });
            return;
        }
        pl.hp = 0;
        if (players.length > 1 && players.some(p => p.hp > 0)) {
            // [3C] ผี STAND: ดาเมจ 10% ของร่างก่อนตาย (aspd/crit/crit-dmg ใช้ของจริงต่อ)
            pl.ghostDmg = Math.max(1, Math.round(pl.damage * 0.1));
            pl.attackCooldown = 40;
            announce("💀 P" + (players.indexOf(pl) + 1) + " DOWN — ผียิงช่วยจนถึงขึ้นชั้น", "#ff5577");
            addHitStop(3); addShake(7, 0.35);
            playSynthSFX("heavy_explosion");
        } else {
            gameOver();
        }
    }
}
function gameOver() {
    isGameOver = true;
    stopMusic();   // [เฟส A4]
    playSynthSFX("heavy_explosion");
    addHitStop(6); addShake(10, 0.5);
    stats.runs++;
    if (score > stats.bestScore) stats.bestScore = score;
    saveMeta();
    clearSavedRun();
    document.getElementById("gameover-stats").innerHTML =
        "ไปถึงชั้น: " + currentFloor + " (สูงสุดเคย: " + stats.bestFloor + ")<br>คะแนน: " + score +
        "<br>เหรียญคงเหลือ: " + players.map((pl, i) => "P" + (i + 1) + " " + Math.floor(pl.coins)).join(" / ") + " | CORE สะสม: " + cores +
        "<br>เลเวล: " + player.level + " | กำจัดศัตรู: " + kills + " | คริรวม: " + stats.crits;
    document.getElementById("gameover-screen").classList.remove("hidden");
    let gnav = [];   // [มินิแพส-nav] กด REBOOT ได้ไม่ต้องเมาส์
    document.querySelectorAll("#gameover-screen button.btn").forEach(el => gnav.push(el));
    setUiNavDom(gnav, 0);
}

// ================== ดรอป ==================
function rollDrop(x, y) {
    let cc = MONSTER_DROPS.coinChance * (metaUnlocks.luck ? 1.4 : 1);
    let r = Math.random();
    if (r < cc) {
        items.push({ x: x, y: y, type: "COIN", icon: "💰", size: 16 });
    } else if (!runMods.noHearts && r < cc + MONSTER_DROPS.heartChance) {
        items.push({ x: x, y: y, type: "HEART", icon: "❤️", size: 14 });
    } else if (r < cc + MONSTER_DROPS.heartChance + MONSTER_DROPS.buffChance) {
        let bd = BUFF_DROPS[Math.floor(Math.random() * BUFF_DROPS.length)];
        items.push({ x: x, y: y, type: bd.type, icon: bd.icon, size: 18, color: bd.color });
    }
}

