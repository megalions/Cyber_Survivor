"use strict";

// ================== ผู้เล่นโดนตี / จบเกม ==================
// [เฟส 2A] รับผู้เล่นเป็นพารามิเตอร์ — ดาเมจ/โล่/i-frame/ฟื้นชีพ เป็นของรายคน
function damagePlayer(pl, amount) {
    if (!pl || isGameOver || isWarping) return;
    if (pl.hp <= 0) return;   // [3C-fix] ผีไม่โดนดาเมจ — ไม่รี-ประกาศ DOWN ไม่เผา clean-floor ไม่กิน killStreak
    if (!(amount > 0)) return;   // [v13-2] ดาเมจ 0 (หิน BLOCK_OBSTACLE) — ไม่กระพริบ/ไม่เสียง/ไม่เขย่า/ไม่เผา clean-floor
    runChal.hitThisRun = true;   // [v28] FLAWLESS — โดนดาเมจจริงแม้แต่ครั้งเดียว = เสียสิทธิ์ทั้งรัน (โล่กินให้ก็นับว่าโดน)
    if (pl.isInvulnerable || pl.hurtTimer > 0) return;
    amount *= runMods.dmgTakenMult;
    if (runMods.enemyCrit > 0 && Math.random() < runMods.enemyCrit) {
    amount *= runMods.dmgTakenMult;
    if (pl.berserkT > 0) amount *= 1 + BAL.SKILL.BERSERK_TAKEN_MULT;   // [v16] เลือดร้อน — โดนตีหนักขึ้น
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
    if (runChal && !runChal.hitThisRun && currentFloor > 1) unlockRunChal("flawless");   // [v28] จบรันโดยไม่เคยโดนดาเมจ (อย่างน้อยผ่าน 1 ชั้น — กันตายโง่ๆ ชั้น 1 ก็ได้เหรียญ)
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
    maybeHighScoreEntry();   // [v20] เข้าเกณฑ์ 20 อันดับ = ถามชื่อ (จอพับเพิ่ม 5 วินาที)
    document.getElementById("gameover-screen").classList.remove("hidden");
    let gnav = [];   // [มินิแพส-nav] กด REBOOT ได้ไม่ต้องเมาส์
    document.querySelectorAll("#gameover-screen button.btn").forEach(el => gnav.push(el));
    setUiNavDom(gnav, 0);
}

// ================== [v20] HIGH SCORE — บันทึกตอนตาย/ยอมแพ้ (รีเฟรชหน้าจอ = ไม่บันทึก) ==================
function qualifiesHighScore() {
    return score > 0 && (stats.highscores.length < 20 || score > stats.highscores[stats.highscores.length - 1].s);
}
function maybeHighScoreEntry() {
    if (!qualifiesHighScore()) return;
    let hs = document.getElementById("highscore-entry");
    if (!hs) return;
    hs.classList.remove("hidden");
    document.getElementById("hs-name").value = "";
    document.getElementById("hs-name").focus();   // พิมพ์ได้ทันที
    // จับเวลา 5 วินาที — หมดเวลา = บันทึกด้วย AAA (สไตล์อาร์เคด)
    hsEntryDeadline = performance.now() + 5000;
    if (hsEntryTimer) cancelAnimationFrame(hsEntryTimer);
    (function tick() {
        if (hs.classList.contains("hidden")) return;   // บันทึก/ยกเลิกไปแล้ว
        let left = Math.ceil((hsEntryDeadline - performance.now()) / 1000);
        let t = document.getElementById("hs-timer");
        if (t) t.textContent = left > 0 ? "บันทึกภายใน " + left + " วิ — หมดเวลา = AAA" : "หมดเวลา!";
        if (left <= 0) { hsSaveName(); return; }
        hsEntryTimer = requestAnimationFrame(tick);
    })();
}
let hsEntryDeadline = 0, hsEntryTimer = 0;
function hsSaveName() {
    let hs = document.getElementById("highscore-entry");
    if (!hs || hs.classList.contains("hidden")) return;
    hs.classList.add("hidden");
    let raw = (document.getElementById("hs-name").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);   // [ข้อกำหนด] อังกฤษพิมพ์ใหญ่สูงสุด 8 ตัว
    let name = raw || "AAA";
    let d = new Date();
    // [v27] เหรียญ challenge ของรันนี้ติดไปกับ entry — อ่านง่าย: "1. JO 482138 F28 🩸🧭💰"
    let medals = "";
    if (runChal) for (let id in runChal.got) if (runChal.got[id] && CHAL_ICON[id]) medals += CHAL_ICON[id];
    stats.highscores.push({ n: name, s: score, f: currentFloor, k: kills, m: medals,
        d: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") });
    stats.highscores.sort((a, b) => b.s - a.s);
    stats.highscores = stats.highscores.slice(0, 20);
    saveMeta();
    playSynthSFX("levelup");
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

