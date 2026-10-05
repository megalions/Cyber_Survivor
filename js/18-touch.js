"use strict";
// ================== TOUCH CONTROLLER [เฟส 5] ==================
// Virtual joystick (ซ้ายล่าง) + ปุ่ม DASH/SKILL (ขวาล่าง) + AUTO lock ON
// เปิดเมื่อแตะหน้าจอครั้งแรก | single-player only | auto-reduce VFX เมื่อ FPS ต่ำ

touchMode = false;
let touchMove = { x: 0, y: 0 };
let joyId = null;
let joyCenter = { x: 0, y: 0 };
let joyPos = { x: 0, y: 0 };
const JOY_MAX = 55;

let perfLevel = 0;   // 0=ปกติ 1=ลด VFX 2=ลด VFX+ปิง particle
let perfFrames = 0, perfTimer = 0;

function activateTouchMode() {
    if (touchMode) return;
    touchMode = true;
    inputSlots[0].device = "touch";
    ["touchDash", "touchSkill", "touchPause"].forEach(id => {
        let el = document.getElementById(id);
        if (el) el.style.display = "flex";
    });
    announce("📱 TOUCH MODE — AUTO ATK locked ON", "#8fa3b8");
}

// ---- Joystick (โซนซ้าย 45% ของ canvas) ----
function canvasPos(t) {
    let r = canvas.getBoundingClientRect();
    return {   // [v31] พิกัด VIEW โลก (canvas จริง = VIEW×DPR)
        x: (t.clientX - r.left) * (VIEW_WIDTH / r.width),
        y: (t.clientY - r.top) * (VIEW_HEIGHT / r.height)
    };
}

canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    activateTouchMode();
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        let p = canvasPos(t);
        if (p.x < VIEW_WIDTH * 0.45 && joyId === null) {
            joyId = t.identifier;
            joyCenter = p;
            joyPos = p;
        }
    }
}, { passive: false });

canvas.addEventListener("touchmove", e => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        if (t.identifier === joyId) {
            let p = canvasPos(t);
            joyPos = p;
            let dx = p.x - joyCenter.x, dy = p.y - joyCenter.y;
            let d = Math.hypot(dx, dy);
            if (d > 5) {
                let clamp = Math.min(1, d / JOY_MAX);
                touchMove.x = (dx / d) * clamp;
                touchMove.y = (dy / d) * clamp;
            } else {
                touchMove.x = 0; touchMove.y = 0;
            }
        }
    }
}, { passive: false });

function endTouch(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyId) {
            joyId = null;
            touchMove = { x: 0, y: 0 };
        }
    }
}
canvas.addEventListener("touchend", endTouch, { passive: false });
canvas.addEventListener("touchcancel", endTouch, { passive: false });

// ---- ปุ่ม ----
document.getElementById("touchDash").addEventListener("touchstart", e => {
    e.preventDefault();
    if (player && !isPaused && !isGameOver && !isWarping) executeDash();
}, { passive: false });

document.getElementById("touchSkill").addEventListener("touchstart", e => {
    e.preventDefault();
    if (player && !isPaused && !isGameOver && !isWarping) castSkill(player);
}, { passive: false });

document.getElementById("touchPause").addEventListener("touchstart", e => {
    e.preventDefault();
    if (isSettingsOpen) { closeSettings(); return; }
    if (isBuildMenu) { closeBuildMenu(); return; }
    if (!player || isShopping || isGameOver || isWarping) return;
    if (!document.getElementById("upgrade-screen").classList.contains("hidden")) return;
    if (isPauseMenu) closePauseMenu(); else openPauseMenu();
}, { passive: false });

// ---- FPS monitor + auto-reduce ----
function updateTouchPerf() {
    if (!touchMode) return;
    perfFrames++;
    perfTimer += FIXED_DT;
    if (perfTimer >= 3) {
        let fps = perfFrames / perfTimer;
        if (fps < 45 && perfLevel < 2) {
            perfLevel++;
            if (perfLevel === 1) {
                swordVfxOn = false;
                dmgNumbersOn = false;
            }
            if (perfLevel === 2) {
                announce("⚡ PERFORMANCE MODE — ลดเอฟเฟกต์ + ความละเอียด", "#8fa3b8");
                resizeGame();   // [v31] DPR ลดเหลือ 1 (เช็ค perfLevel ภายใน resizeGame)
            }
        }
        perfFrames = 0; perfTimer = 0;
    }
}

// ---- วาด joystick บน canvas ----
function renderTouchUI() {
    if (!touchMode || joyId === null) return;
    ctx.strokeStyle = "rgba(0, 255, 204, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joyCenter.x, joyCenter.y, JOY_MAX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(0, 255, 204, 0.12)";
    ctx.beginPath();
    ctx.arc(joyCenter.x, joyCenter.y, JOY_MAX, 0, Math.PI * 2);
    ctx.fill();
    // นิ้ว
    ctx.fillStyle = "rgba(0, 255, 204, 0.5)";
    ctx.beginPath();
    ctx.arc(joyPos.x, joyPos.y, 18, 0, Math.PI * 2);
    ctx.fill();
    // ปุ่ม cooldown
    if (player) {
        let dashEl = document.getElementById("touchDash");
        let skillEl = document.getElementById("touchSkill");
        if (dashEl) dashEl.style.opacity = player.dashCooldown <= 0 ? "1" : "0.3";
        if (skillEl) skillEl.style.opacity = player.skillCd <= 0 ? "1" : "0.3";
    }
}