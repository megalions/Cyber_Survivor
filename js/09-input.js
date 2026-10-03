"use strict";
// ================== อินพุต [เฟส 1]: คอนโทรลเลอร์เสมือน + ผูกปุ่ม + จอย ==================
// โมเดล: ผู้เล่นแต่ละคน = 1 "ช่อง" (slot) ผูกอุปกรณ์ (kb1/kb2/pad)
// เกมอ่านค่ารวมจาก inputMove/inputAttackHeld/inputAimVec เท่านั้น
// เฟส 1 ยังมีผู้เล่นเดียว: เฉพาะ slot 0 คุม player (getSlotPlayer) — slot อื่นรอเฟส 2

const INPUT_ACTIONS = ["up", "down", "left", "right", "dash", "skill", "toggleAuto", "attack"];
const ACTION_TH = {
    up: "ขึ้น", down: "ลง", left: "ซ้าย", right: "ขวา",
    dash: "แดช", skill: "สกิล", toggleAuto: "สลับ AUTO", attack: "โจมตี (กดค้าง)",
    pause: "พักเกม (Start)"
};
const DEVICE_TH = { kb1: "คีย์บอร์ด A (เมาส์เล็ง)", kb2: "คีย์บอร์ด B", pad: "จอยเกมแพด" };

const DEFAULT_SLOTS = [
    { device: "kb1", binds: { up: "w", down: "s", left: "a", right: "d", dash: " ", skill: "e", toggleAuto: "q", attack: "mousedown" } },
    { device: "kb2", binds: { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", dash: "k", skill: "l", toggleAuto: "p", attack: "j" } },
    { device: "pad",  binds: { attack: 0, dash: 1, skill: 2, toggleAuto: 3, pause: 9 } },
    { device: "pad",  binds: { attack: 0, dash: 1, skill: 2, toggleAuto: 3, pause: 9 } }
];
const PAD_DZ = 0.25;   // dead zone

let inputSlots = null;      // โหลดจาก localStorage หรือ default
let rebinding = null;       // { slot, action } ระหว่างผูกปุ่มใหม่
let isSettingsOpen = false;
let padPrev = [];           // สถานะปุ่มจอยเฟรมก่อน (edge-detect)
let padLive = [];           // ค่าจอยปัจจุบันของแต่ละ slot

function defaultInputSlots() { return JSON.parse(JSON.stringify(DEFAULT_SLOTS)); }
function loadInputSlots() {
    try {
        let d = JSON.parse(localStorage.getItem("cyberKeysV1"));
        if (d && d.slots && d.slots.length === 4) return d.slots;
    } catch (e) {}
    return defaultInputSlots();
}
function saveInputSlots() {
    try { localStorage.setItem("cyberKeysV1", JSON.stringify({ slots: inputSlots })); } catch (e) {}
}
inputSlots = loadInputSlots();

function keyLabel(k) {
    if (k === " ") return "SPACE";
    if (k === "mousedown") return "คลิกเมาส์";
    return ("" + k).toUpperCase();
}
// [เฟส 3A] ตรวจปุ่มผูก: ห้ามปุ่มระบบ / ห้ามซ้ำในผู้เล่นเดียวกัน / ห้ามซ้ำข้ามผู้เล่น
function validateBindKey(slot, action, k) {
    let reserved = { f: "เต็มจอ", m: "เสียง", n: "เลขดาเมจ", v: "เอฟเฟกต์ดาบ", tab: "ดูบิลด์", enter: "ยืนยันเมนู", escape: "ระบบ" };
    if (reserved[k]) return "ปุ่ม " + keyLabel(k) + " เป็นปุ่มของระบบ (" + reserved[k] + ") — เลือกปุ่มอื่น";
    let b = inputSlots[slot].binds;
    for (let a in b) {
        if (a !== action && b[a] === k) return "ปุ่ม " + keyLabel(k) + " ซ้ำกับ '" + (ACTION_TH[a] || a) + "' ของผู้เล่น " + (slot + 1);
    }
    for (let i = 0; i < 4; i++) {
        if (i === slot) continue;
        let s = inputSlots[i];
        if (!s || s.device === "pad") continue;
        for (let a in s.binds) {
            if (s.binds[a] === k) return "ปุ่ม " + keyLabel(k) + " ซ้ำกับ '" + (ACTION_TH[a] || a) + "' ของผู้เล่น " + (i + 1);
        }
    }
    return "";
}
function showSettingsFeedback(msg, ok) {
    let el = document.getElementById("settings-feedback");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = ok ? "#00ffcc" : "#ff5577";
}

// --- เชื่อม slot -> ผู้เล่น (เฟส 1: player เดียว = slot 0 / เฟส 2: players[i]) ---
function getSlotPlayer(i) {
    return players[i] || null;   // [เฟส 2A] ช่องอินพุต i = ผู้เล่นคนที่ i (ตอนนี้มี players[0])
}

// --- ค่าที่เกมอ่านทุกเฟรม ---
function inputMove(i) {
    let s = inputSlots[i];
    if (!s) return { x: 0, y: 0 };
    if (s.device === "touch") return { x: touchMove.x, y: touchMove.y };
    if (s.device === "pad") {
        let p = padLive[i];
        if (p) return { x: p.moveX, y: p.moveY };
        return { x: 0, y: 0 };
    }
    let b = s.binds;
    let x = (keys[b.right] ? 1 : 0) - (keys[b.left] ? 1 : 0);
    let y = (keys[b.down] ? 1 : 0) - (keys[b.up] ? 1 : 0);
    if (x && y) { x *= 0.7071; y *= 0.7071; }
    return { x: x, y: y };
}
function inputAttackHeld(i) {
    let s = inputSlots[i];
    if (!s) return false;
    if (s.device === "touch") return true;   // AUTO lock ON
    if (s.device === "pad") { let p = padLive[i]; return !!(p && p.attack); }
    let b = s.binds;
    if (b.attack === "mousedown") return !!keys["mousedown"];
    return !!keys[b.attack];
}
// aim แบบเวกเตอร์ (จอย stick ขวา) — คีย์บอร์ดจัดการเมาส์/ทิศเดินเองใน update()
function inputAimVec(i) {
    let s = inputSlots[i];
    if (s && s.device === "pad") {
        let p = padLive[i];
        if (p && (Math.abs(p.aimX) > 0.01 || Math.abs(p.aimY) > 0.01)) return { x: p.aimX, y: p.aimY };
    }
    return null;
}

// --- จอย: poll ทุกเฟรม (เรียกจาก gameLoop) ---
function padSlotIndex(padIdx) {
    let n = 0;
    for (let i = 0; i < 4; i++) {
        if (inputSlots[i].device !== "pad") continue;
        if (n === padIdx) return i;
        n++;
    }
    return -1;
}
function pollGamepads() {
    let gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let seen = [false, false, false, false];
    let padIdx = 0;
    for (let gi = 0; gi < gps.length; gi++) {
        let gp = gps[gi];
        if (!gp) continue;
        let slot = padSlotIndex(padIdx);
        padIdx++;
        if (slot < 0) continue;
        seen[slot] = true;

        // ระหว่างผูกปุ่มจอย: ปุ่มแรกที่กด = ปุ่มใหม่
        if (rebinding && rebinding.slot === slot && inputSlots[slot].device === "pad") {
            let got = -1;
            for (let bi = 0; bi < gp.buttons.length; bi++) {
                if (gp.buttons[bi] && gp.buttons[bi].pressed) { got = bi; break; }
            }
            if (got >= 0) {
                let b = inputSlots[slot].binds;
                let dup = null;
                for (let a in b) { if (a !== rebinding.action && b[a] === got) dup = a; }
                if (dup) showSettingsFeedback("ปุ่มจอย " + got + " ซ้ำกับ '" + (ACTION_TH[dup] || dup) + "' ของผู้เล่น " + (slot + 1));
                else {
                    inputSlots[slot].binds[rebinding.action] = got;
                    saveInputSlots();
                    showSettingsFeedback("✔ ตั้งเป็นปุ่มจอย " + got + " แล้ว", true);
                }
                rebinding = null;
                renderSettingsBody();
            }
        }

        let b = inputSlots[slot].binds;
        let dz = function (v) { return Math.abs(v) < PAD_DZ ? 0 : v; };
        padLive[slot] = {
            moveX: dz(gp.axes[0] || 0), moveY: dz(gp.axes[1] || 0),
            aimX: dz(gp.axes[2] || 0), aimY: dz(gp.axes[3] || 0),
            attack: !!(gp.buttons[b.attack] && gp.buttons[b.attack].pressed)
        };

        // edge-detect ปุ่ม = ทริกเกอร์แบบ keydown
        let cur = {};
        ["dash", "skill", "toggleAuto"].forEach(a => { cur[a] = !!(gp.buttons[b[a]] && gp.buttons[b[a]].pressed); });
        if (b.pause !== undefined) cur.pause = !!(gp.buttons[b.pause] && gp.buttons[b.pause].pressed);
        let prev = padPrev[slot] || {};
        ["dash", "skill", "toggleAuto", "pause"].forEach(a => {
            if (cur[a] && !prev[a]) triggerSlotAction(slot, a);
        });
        padPrev[slot] = cur;

        // [เฟส 3A] จอยนำทางเมนู (เฉพาะ slot ที่กำลังเลือน): stick/d-pad เลื่อน + A ยืนยัน
        if (uiNav && uiNav.slot === slot) {
            let nv = padLive[slot];
            let sx = nv ? nv.moveX : 0;
            if (sx < -0.5 && uiNav.prevMX >= -0.5) uiNavMove(-1);
            else if (sx > 0.5 && uiNav.prevMX <= 0.5) uiNavMove(1);
            uiNav.prevMX = sx;
            let bl = !!(gp.buttons[14] && gp.buttons[14].pressed);
            let br = !!(gp.buttons[15] && gp.buttons[15].pressed);
            let bu = !!(gp.buttons[12] && gp.buttons[12].pressed);
            let bd = !!(gp.buttons[13] && gp.buttons[13].pressed);
            if (bl && !uiNav.prevBL) uiNavMove(-1);
            if (br && !uiNav.prevBR) uiNavMove(1);
            if (bu && !uiNav.prevBU) uiNavMove(-1);
            if (bd && !uiNav.prevBD) uiNavMove(1);
            uiNav.prevBL = bl; uiNav.prevBR = br; uiNav.prevBU = bu; uiNav.prevBD = bd;
            let atk = !!(nv && nv.attack);
            if (atk && !uiNav.prevAtk) uiNavConfirm();
            if (uiNav) uiNav.prevAtk = atk;   // [แก้บั๊ก] ยืนยันใบสุดท้าย = startGame → clearUiNav แล้ว อย่าเขียนซ้ำ
        }

        // [เฟส 3B-1] เลือกการ์ดเลเวลอัพด้วยจอย (รายผู้เล่น พร้อมกัน)
        if (levelPickers) {
            let pi = -1;
            for (let q = 0; q < levelPickers.length; q++) { if (levelPickers[q].slot === slot) { pi = q; break; } }
            if (pi >= 0 && !levelPickers[pi].done) {
                let pk = levelPickers[pi];
                let nv2 = padLive[slot];
                let sx2 = nv2 ? nv2.moveX : 0;
                if (sx2 < -0.5 && pk.prevMX >= -0.5) levelMove(pi, -1);
                else if (sx2 > 0.5 && pk.prevMX <= 0.5) levelMove(pi, 1);
                pk.prevMX = sx2;
                let bl2 = !!(gp.buttons[14] && gp.buttons[14].pressed);
                let br2 = !!(gp.buttons[15] && gp.buttons[15].pressed);
                if (bl2 && !pk.prevBL) levelMove(pi, -1);
                if (br2 && !pk.prevBR) levelMove(pi, 1);
                pk.prevBL = bl2; pk.prevBR = br2;
                let atk2 = !!(nv2 && nv2.attack);
                if (atk2 && !pk.prevAtk) levelPickCard(pi, pk.index);
                pk.prevAtk = atk2;
            }
        }

        // [3B-2] ร้าน: จอยเลื่อนเคอร์เซอร์รายผู้เล่น + A ซื้อ
        if (shopPickers) {
            let pi = -1;
            for (let q = 0; q < shopPickers.length; q++) { if (shopPickers[q].slot === slot) { pi = q; break; } }
            if (pi >= 0) {
                let pk = shopPickers[pi];
                let nv3 = padLive[slot];
                let sx3 = nv3 ? nv3.moveX : 0;
                if (sx3 < -0.5 && pk.prevMX >= -0.5) shopMove(pi, -1);
                else if (sx3 > 0.5 && pk.prevMX <= 0.5) shopMove(pi, 1);
                pk.prevMX = sx3;
                let bl3 = !!(gp.buttons[14] && gp.buttons[14].pressed);
                let br3 = !!(gp.buttons[15] && gp.buttons[15].pressed);
                if (bl3 && !pk.prevBL) shopMove(pi, -1);
                if (br3 && !pk.prevBR) shopMove(pi, 1);
                pk.prevBL = bl3; pk.prevBR = br3;
                let atk3 = !!(nv3 && nv3.attack);
                if (atk3 && !pk.prevAtk) shopBuyCard(pi, pk.index);
                pk.prevAtk = atk3;
            }
        }
    }
    for (let i = 0; i < 4; i++) {
        if (inputSlots[i].device === "pad" && !seen[i]) padLive[i] = null;   // จอยถอดแล้ว
    }
}
window.addEventListener("gamepadconnected", e => {
    if (player) announce("🎮 จอยเสียบ: " + (e.gamepad.id || "").slice(0, 24), "#9fd6ff");
});
window.addEventListener("gamepaddisconnected", () => {
    if (player) announce("🎮 จอยถอดแล้ว", "#8fa3b8");
});

// --- กระจาย action ของ slot ไปยังผู้เล่นของช่องนั้น ---
function triggerSlotAction(slot, action) {
    let pl = getSlotPlayer(slot);
    if (action === "pause") {
        if (isSettingsOpen) { closeSettings(); return; }
        if (!player || isShopping || isGameOver || isWarping) return;
        if (!document.getElementById("upgrade-screen").classList.contains("hidden")) return;
        if (isPauseMenu) closePauseMenu(); else openPauseMenu();
        return;
    }
    if (!pl || isGameOver || isWarping || isShopping) return;
    if (action === "dash") { if (!isPaused && !isSettingsOpen) executeDash(pl, slot); }
    else if (action === "skill") { if (!isPaused && !isSettingsOpen) castSkill(pl); }
    else if (action === "toggleAuto") {
        pl.autoAtk = !pl.autoAtk;
        announce("P" + (slot + 1) + " AUTO ATK: " + (pl.autoAtk ? "ON" : "OFF"), "#8fa3b8");
    }
}

// ================== [เฟส 3A] นำทางเมนูด้วยปุ่มทิศทาง ==================
function setUiNav(slot, count, onMove, onConfirm) {
    let keep = !!(uiNav && uiNav.slot === slot && uiNav.count === count);
    uiNav = { slot: slot, count: count,
              index: keep ? uiNav.index : 0,
              onMove: onMove, onConfirm: onConfirm,
              prevMX: keep ? uiNav.prevMX : 0,
              prevBL: keep ? uiNav.prevBL : false,
              prevBR: keep ? uiNav.prevBR : false,
              prevBU: keep ? uiNav.prevBU : false,
              prevBD: keep ? uiNav.prevBD : false,
              prevAtk: keep ? uiNav.prevAtk : false };
}
function clearUiNav() {
    uiNav = null;
    domNavElems.forEach(el => el.classList.remove("nav-focus"));
    domNavElems = [];
}
// [มินิแพส-nav] โหมด DOM: uiNav ชี้ธาตุจริงบนจอ (ปุ่ม/การ์ด) — เลื่อน = ไฮไลต์, ยืนยัน = คลิก
function domFocusApply(elems, i) {
    domNavElems.forEach(el => {
        el.classList.remove("nav-focus");
        el.style.borderColor = "";
        el.style.boxShadow = "";
    });
    domNavElems = elems;
    let el = elems[i];
    if (el) {
        el.classList.add("nav-focus");
        let col = (uiNav && PC_COLORS[uiNav.slot]) || "#00ffcc";   // [มินิแพส-nav] สีตามผู้เลื่อน
        el.style.borderColor = col;
        el.style.boxShadow = "0 0 14px " + col + ", inset 0 0 10px " + col + "40";
        if (el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    }
}
function setUiNavDom(elems, slot) {
    elems = (elems || []).filter(el => !!el);
    if (!elems.length) { clearUiNav(); return; }
    setUiNav(slot, elems.length,
        i => { domFocusApply(elems, i); },
        i => { if (elems[i]) elems[i].click(); });
    domFocusApply(elems, uiNav.index);
}
function uiNavMove(dir) {
    if (!uiNav) return;
    uiNav.index = (uiNav.index + dir + uiNav.count) % uiNav.count;
    playSynthSFX("click");
    if (uiNav.onMove) uiNav.onMove(uiNav.index);
}
function uiNavConfirm() {
    if (!uiNav) return;
    uiNav.onConfirm(uiNav.index);
}

// ================== ผู้ฟังคีย์บอร์ด / เมาส์ ==================
document.addEventListener("keydown", e => {
    let k = e.key.toLowerCase();

    // กำลังผูกปุ่มใหม่: ESC = ยกเลิก, คีย์อื่น = จับเป็นปุ่มใหม่
    if (rebinding && k === "escape") { rebinding = null; renderSettingsBody(); return; }
    if (rebinding && inputSlots[rebinding.slot].device !== "pad") {
        e.preventDefault();
        let err = validateBindKey(rebinding.slot, rebinding.action, k);
        if (err) {
            rebinding = null;
            showSettingsFeedback(err);
            renderSettingsBody();
            return;
        }
        inputSlots[rebinding.slot].binds[rebinding.action] = k;
        rebinding = null;
        saveInputSlots();
        showSettingsFeedback("✔ ตั้งเป็น " + keyLabel(k) + " แล้ว", true);
        renderSettingsBody();
        return;
    }

    keys[k] = true;

    // ปุ่มระบบ (ไม่ผูกกับผู้เล่น)
    if (k === "f") { toggleFullscreen(); return; }
    if (k === "t") {   // [เฟส A-demo] กล้องเอียง 2.5D ทดลองฟีล (HUD เอียงตามทั้งจอ — เล็งใช้ AUTO)
        canvas.classList.toggle("tilt");
        if (player) announce("CAMERA TILT: " + (canvas.classList.contains("tilt") ? "ON (2.5D DEMO)" : "OFF"), "#8fa3b8");
        return;
    }
    if (k === "n") { dmgNumbersOn = !dmgNumbersOn; if (player) announce("DMG NUMBERS: " + (dmgNumbersOn ? "ON" : "OFF"), "#8fa3b8"); }
    if (k === "v") { swordVfxOn = !swordVfxOn; if (player) announce("SWORD VFX: " + (swordVfxOn ? "ON" : "OFF"), "#8fa3b8"); }
    if (k === "m") { sfxVolIdx = (sfxVolIdx + 1) % 3; updateMusicVol(); if (player) announce("VOLUME (SFX+เพลง): " + ["100%", "50%", "MUTE"][sfxVolIdx], "#8fa3b8"); }
    if (k === "escape") {
        if (isSettingsOpen) { closeSettings(); return; }
        if (isBuildMenu) { closeBuildMenu(); return; }
        if (!player || isShopping || isGameOver || isWarping) return;
        if (!document.getElementById("upgrade-screen").classList.contains("hidden")) return;
        if (isPauseMenu) closePauseMenu(); else openPauseMenu();
        return;
    }
    if (k === "tab") {
        e.preventDefault();
        if (isSettingsOpen) return;
        if (!player || isShopping || isGameOver || isWarping) return;
        if (!document.getElementById("upgrade-screen").classList.contains("hidden")) return;
        if (isBuildMenu) closeBuildMenu();
        else { if (isPauseMenu) closePauseMenu(); openBuildMenu(); }
        return;
    }

    // [เฟส 3B-1] เลือกการ์ดเลเวลอัพ: ปุ่มของผู้เล่นแต่ละคน (ที่ยังไม่เลือก) ทำงานพร้อมกัน
    if (levelPickers) {
        for (let pi = 0; pi < levelPickers.length; pi++) {
            let pk = levelPickers[pi];
            if (pk.done) continue;
            let s = inputSlots[pk.slot];
            if (!s || s.device === "pad") continue;
            let b = s.binds;
            if (k === b.left || k === b.up) { e.preventDefault(); if (!e.repeat) levelMove(pi, -1); return; }
            if (k === b.right || k === b.down) { e.preventDefault(); if (!e.repeat) levelMove(pi, 1); return; }
            if (k === b.attack && b.attack !== "mousedown") { levelPickCard(pi, pk.index); return; }
        }
        if (k === "enter") {
            e.preventDefault();
            if (!e.repeat) {
                for (let pi = 0; pi < levelPickers.length; pi++) {
                    if (!levelPickers[pi].done && levelPickers[pi].choices.length > 0) { levelPickCard(pi, levelPickers[pi].index); break; }
                }
            }
            return;
        }
    }

    // [3B-2] ร้าน: แต่ละผู้เล่นเลื่อนเคอร์เซอร์ของตัวเอง + ปุ่มโจมตียืนยันซื้อ (คลิกเมาส์ = P1 ซื้อ)
    if (shopPickers) {
        for (let pi = 0; pi < shopPickers.length; pi++) {
            let pk = shopPickers[pi];
            let s = inputSlots[pk.slot];
            if (!s || s.device === "pad") continue;
            let b = s.binds;
            if (k === b.left || k === b.up) { e.preventDefault(); if (!e.repeat) shopMove(pi, -1); return; }
            if (k === b.right || k === b.down) { e.preventDefault(); if (!e.repeat) shopMove(pi, 1); return; }
            if (k === b.attack && b.attack !== "mousedown") { shopBuyCard(pi, pk.index); return; }
        }
        if (k === "enter") { e.preventDefault(); if (!e.repeat) shopBuyCard(0, shopPickers[0].index); return; }
    }

    // [เฟส 3A] นำทางเมนู: ปุ่มที่ "ผู้เล่นช่องที่กำลังเลือน" bind ไว้ = เลื่อน (ซ้าย/ขึ้น = -1, ขวา/ลง = +1)
    // ปุ่มโจมตีของผู้เล่นนั้น หรือ Enter = ยืนยัน (จอยนำทางอยู่ใน pollGamepads แล้ว)
    if (uiNav) {
        let s = inputSlots[uiNav.slot];
        if (s && s.device !== "pad") {
            let b = s.binds;
            if (k === b.left || k === b.up) { e.preventDefault(); if (!e.repeat) uiNavMove(-1); return; }
            if (k === b.right || k === b.down) { e.preventDefault(); if (!e.repeat) uiNavMove(1); return; }
            if (k === b.attack && b.attack !== "mousedown") { uiNavConfirm(); return; }
        }
        // [มินิแพส-nav] ลูกศรใช้ได้ทุกหน้า (กันกรณี slot นำทางเป็นจอย — คีย์บอร์ดยังช่วยเลื่อนได้)
        if (k === "arrowleft" || k === "arrowup") { e.preventDefault(); if (!e.repeat) uiNavMove(-1); return; }
        if (k === "arrowright" || k === "arrowdown") { e.preventDefault(); if (!e.repeat) uiNavMove(1); return; }
        if (k === "enter") { e.preventDefault(); if (!e.repeat) uiNavConfirm(); return; }
    }

    // ปุ่มของผู้เล่นแต่ละช่อง (ทริกเกอร์ตอนกดครั้งแรก)
    for (let i = 0; i < 4; i++) {
        let s = inputSlots[i];
        if (!s || s.device === "pad") continue;
        if (k === s.binds.dash) triggerSlotAction(i, "dash");
        if (k === s.binds.skill) triggerSlotAction(i, "skill");
        if (k === s.binds.toggleAuto) triggerSlotAction(i, "toggleAuto");
    }

    if (k === " ") e.preventDefault();
});
document.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });

canvas.addEventListener("mousemove", e => {
    let r = canvas.getBoundingClientRect();
    // [เฟส 1] แปลงพิกัดตามสเกลจริง (ปกติ 1:1 / เต็มจอ = canvas ถูกขยาย)
    mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    mouseY = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener("mousedown", () => {
    // คลิกปุ่ม AUTO บนการ์ดผู้เล่น?
    for (let i = 0; i < hudCardRects.length; i++) {
        let c = hudCardRects[i];
        if (mouseX >= c.autoX && mouseX <= c.autoX + c.autoW && mouseY >= c.autoY && mouseY <= c.autoY + c.autoH) {
            triggerSlotAction(i, "toggleAuto");
            return;
        }
    }
    keys["mousedown"] = true;
});
document.addEventListener("mouseup", () => { keys["mousedown"] = false; });

// ================== Fullscreen ==================
function toggleFullscreen() {
    let el = document.getElementById("game-container");
    if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen(); }
    else if (el.requestFullscreen) el.requestFullscreen();
}
document.getElementById("fsBtn").onclick = toggleFullscreen;

// ================== ปุ่มร้าน (แพตช์จุดที่ 1 เดิม — คงไว้) ==================
document.getElementById("shop-leave-btn").onclick = () => { showModScreen(); };

// ================== เมนูพัก / บิลด์ ==================
function setPauseNav() {   // [มินิแพส-nav]
    let elems = [];
    document.querySelectorAll("#pause-screen button.btn").forEach(el => elems.push(el));
    setUiNavDom(elems, 0);
}
function openPauseMenu() {
    isPauseMenu = true; isPaused = true;
    document.getElementById("pause-screen").classList.remove("hidden");
    setPauseNav();
}
function closePauseMenu() {
    isPauseMenu = false; isPaused = false;
    document.getElementById("pause-screen").classList.add("hidden");
    clearUiNav();
}
function surrenderRun() {
    stats.runs++;
    if (score > stats.bestScore) stats.bestScore = score;
    saveMeta();
    clearSavedRun();
    closePauseMenu();
    resetGame();
}
function openBuildMenu() {
    isBuildMenu = true; isPaused = true;
    let html = "";
    let th = getTheme();
    html += '<div class="sub" style="text-align:center;margin-bottom:6px;">FLOOR ' + currentFloor + ' · ' + th.name + ' | SCORE ' + score + ' | KILLS ' + kills + '</div>';
    players.forEach((pl, pi) => {
        let col = PC_COLORS[pi] || "#00ffcc";
        html += '<div style="border-left:3px solid ' + col + '; padding-left:10px; margin:8px 0; text-align:left;">';
        html += '<div style="color:' + col + '; font-weight:bold;">P' + (pi + 1) + ' ' + spriteHtml(pl.weaponType, pl.icon, 22) + ' — ' + WEAPONS[pl.weaponType].name
              + ' | LV ' + pl.level + ' | HP ' + Math.ceil(pl.hp) + '/' + pl.maxHp + ' | DMG ' + pl.damage + ' | 💰 ' + Math.floor(pl.coins) + '</div>';
        html += '<div style="color:#ff923d;font-size:12px;">🎯 CRIT ' + Math.round(getCritChance(pl) * 100) + '% × ' + getCritMult(pl).toFixed(1)
              + ' | 🩸 VAMPIRE Lv' + pl.vampLevel + ' (แคปฟื้น ' + Math.round(pl.maxHp * 0.05) + ' HP/วิ)</div>';
        let all = GENERAL_UPGRADES.concat([CLASS_UPGRADES[pl.weaponType]], EXTRA_CLASS_UPGRADES[pl.weaponType] || []);
        let any = false;
        all.forEach(u => {
            let lv = pl.levels[u.id] || 0;
            if (lv <= 0) return;
            any = true;
            html += '<div style="color:#cffcff;font-size:12px;line-height:1.7;">' + u.name + ' — '
                  + (u.maxLevel === Infinity ? "Lv." + lv : "Lv." + lv + "/" + u.maxLevel)
                  + (lv >= u.maxLevel ? ' <span style="color:#3dff8c;">MAX</span>' : '') + '</div>';
        });
        if (!any) html += '<div class="sub">ยังไม่มีอัพเกรด</div>';
        html += '</div>';
    });
    let evo = [];
    if (evolved.sword) evo.push("⚔ ZERO BLADE");
    if (evolved.gun) evo.push("🚀 OMEGA RIFLE");
    if (evolved.shotgun) evo.push("⚡ THUNDER MAW");
    if (evolved.laser) evo.push("🌌 SINGULARITY LANCE");
    if (evolved.drone) evo.push("🐝 HIVE MIND");
    if (evo.length) html += '<div style="color:#7df9ff;font-size:12px;margin-top:6px;">EVOLVED: ' + evo.join(" · ") + '</div>';
    if (runMods.list.length) html += '<div class="sub" style="color:#c77dff;margin-top:6px;">MODS: ' + runMods.list.join(" ") + '</div>';
    html += '<div class="sub" style="margin-top:6px;text-align:center;">CORE สะสมถาวร: ' + cores + '</div>';
    document.getElementById("build-info").innerHTML = html;
    document.getElementById("build-screen").classList.remove("hidden");
    let bnav = [];   // [มินิแพส-nav]
    document.querySelectorAll("#build-screen button.btn").forEach(el => bnav.push(el));
    setUiNavDom(bnav, 0);
}
function closeBuildMenu() {
    isBuildMenu = false; isPaused = false;
    document.getElementById("build-screen").classList.add("hidden");
    clearUiNav();   // [มินิแพส-nav]
}

// ================== เมนูเซ็ตติ้ง ==================
function openSettings() {
    isSettingsOpen = true;
    if (player && !isGameOver && !isShopping && !isWarping) isPaused = true;
    renderSettingsBody();
    document.getElementById("settings-screen").classList.remove("hidden");
}
function saveSettings() {   // [แก้] เซฟค่าเสียงถาวร
    try {
        localStorage.setItem("cyberSettingsV1", JSON.stringify({
            sfxVolIdx: sfxVolIdx, sfxFileVol: SFX_FILE_VOL, musicVol: MUSIC_VOL
        }));
    } catch (e) {}
}
function loadSettings() {
    try {
        let d = JSON.parse(localStorage.getItem("cyberSettingsV1"));
        if (d) {
            if (d.sfxVolIdx !== undefined) sfxVolIdx = d.sfxVolIdx;
            if (d.sfxFileVol !== undefined) SFX_FILE_VOL = d.sfxFileVol;
            if (d.musicVol !== undefined) MUSIC_VOL = d.musicVol;
            updateMusicVol();
        }
    } catch (e) {}
}
function closeSettings() {
    isSettingsOpen = false;
    rebinding = null;
    document.getElementById("settings-screen").classList.add("hidden");
    if (player && !isGameOver && !isShopping && !isWarping && !isPauseMenu && !isBuildMenu) isPaused = false;
    clearUiNav();
    if (isPauseMenu) setPauseNav();
    else if (!player || isGameOver) refreshStartNav();
    saveSettings();   // [แก้] บันทึกทุกครั้งที่ปิด
}
function renderSettingsBody() {
    let html = "";
    for (let i = 0; i < 4; i++) {
        let s = inputSlots[i];
        let isPad = s.device === "pad";
        html += '<div style="border:1px solid #272a3d; padding:8px; width:236px; display:inline-block; vertical-align:top; margin:4px; text-align:left;">';
        html += '<div style="color:#00ffcc; font-weight:bold; margin-bottom:5px;">ผู้เล่น ' + (i + 1) +
                (i === 0 ? ' <span style="color:#ffd700;">★ คุมเกม</span>' : ' <span style="color:#55607a;">(รอ co-op)</span>') + '</div>';
        html += '<div class="sub" style="margin-bottom:5px;">อุปกรณ์: '
            + '<span class="btn" style="padding:1px 10px; font-size:11px;" onclick="cycleSlotDevice(' + i + ')">' + DEVICE_TH[s.device] + ' ▸</span></div>';
        let actions = isPad ? ["attack", "dash", "skill", "toggleAuto", "pause"] : INPUT_ACTIONS;
        actions.forEach(a => {
            let cur = isPad ? ("ปุ่ม " + s.binds[a]) : keyLabel(s.binds[a]);
            let waiting = rebinding && rebinding.slot === i && rebinding.action === a;
            html += '<div class="sub" style="display:flex; justify-content:space-between; margin:2px 0;">'
                + '<span>' + (ACTION_TH[a] || a) + '</span>'
                + '<span class="btn" style="padding:1px 8px; font-size:11px;" onclick="startRebind(' + i + ', \'' + a + '\')">'
                + (waiting ? "กดปุ่ม…" : cur) + '</span></div>';
        });
        html += '</div>';
    }
    // [แพตช์] Sound Settings: ปรับดัง SFX / เพลง แยกกัน (เพิ่มบล็อกเสียงต่อท้าย)
    html += '<div style="border:1px solid #272a3d; padding:8px; margin:4px; text-align:left; width:96%;">';
    html += '<div style="color:#00ffcc; font-weight:bold; margin-bottom:5px;">🔊 SOUND SETTINGS</div>';
    html += '<div class="sub" style="display:flex; justify-content:space-between; margin:2px 0;">'
         + '<span>SFX ดังรวม</span>'
         + '<span class="btn" style="padding:1px 10px; font-size:11px;" onclick="cycleSfxVol()">'
         + ["100%", "50%", "ปิด"][sfxVolIdx] + ' ▸</span></div>';
    html += '<div class="sub" style="display:flex; justify-content:space-between; margin:2px 0;">'
         + '<span>ไฟล์ SFX ดัง (0-100)</span>'
         + '<span class="btn" style="padding:1px 10px; font-size:11px;" onclick="adjustSfxFileVol(0.1)">+</span> '
         + '<span class="btn" style="padding:1px 10px; font-size:11px;" onclick="adjustSfxFileVol(-0.1)">−</span> '
         + '<span>' + Math.round(SFX_FILE_VOL * 100) + '</span></div>';
    html += '<div class="sub" style="display:flex; justify-content:space-between; margin:2px 0;">'
         + '<span>เพลง ดัง (0-100)</span>'
         + '<span class="btn" style="padding:1px 10px; font-size:11px;" onclick="adjustMusicVol(0.1)">+</span> '
         + '<span class="btn" style="padding:1px 10px; font-size:11px;" onclick="adjustMusicVol(-0.1)">−</span> '
         + '<span>' + Math.round(MUSIC_VOL * 100) + '</span></div>';
    html += '</div>';
    document.getElementById("settings-body").innerHTML = html;
    refreshSettingsNav();   // [มินิแพส-nav]
}
function setSlotDevice(i, d) {
    let ref = d === "kb1" ? 0 : d === "kb2" ? 1 : 2;
    inputSlots[i].device = d;
    inputSlots[i].binds = JSON.parse(JSON.stringify(DEFAULT_SLOTS[ref].binds));
    saveInputSlots();
    renderSettingsBody();
    playSynthSFX("click");
}
function cycleSlotDevice(i) {   // [มินิแพส-nav] สลับอุปกรณ์แบบกดวน (จอยเลือกได้)
    let order = ["kb1", "kb2", "pad"];
    let cur = order.indexOf(inputSlots[i].device);
    setSlotDevice(i, order[(cur + 1) % order.length]);
}
function refreshSettingsNav() {
    let elems = [];
    document.querySelectorAll("#settings-screen > button.btn").forEach(el => elems.push(el));
    document.querySelectorAll("#settings-body .btn").forEach(el => elems.push(el));
    setUiNavDom(elems, 0);
}
function startRebind(slot, action) {
    rebinding = { slot: slot, action: action };
    renderSettingsBody();
}
function resetBinds() {
    inputSlots = defaultInputSlots();
    saveInputSlots();
    renderSettingsBody();
    playSynthSFX("click");
}

// [แพตช์] Sound Settings helpers
function cycleSfxVol() {
    sfxVolIdx = (sfxVolIdx + 1) % 3;
    updateMusicVol();
    renderSettingsBody();
    playSynthSFX("click");
}
function adjustSfxFileVol(d) {
    SFX_FILE_VOL = Math.max(0, Math.min(1, SFX_FILE_VOL + d));
    renderSettingsBody();
    playSynthSFX("click");
}
function adjustMusicVol(d) {
    MUSIC_VOL = Math.max(0, Math.min(1, MUSIC_VOL + d));
    updateMusicVol();
    renderSettingsBody();
    playSynthSFX("click");
}

function executeDash(pl, slot) {
    pl = pl || player;   // [เฟส 2C]
    if (slot === undefined) slot = Math.max(0, players.indexOf(pl));
    if (pl.dashCooldown > 0 || pl.dashTimer > 0 || isWarping || isShopping) return;
    let mv = inputMove(slot);   // ทิศจากคอนโทรลเลอร์ของผู้เล่นคนนี้
    let vx, vy;
    if (mv.x === 0 && mv.y === 0) { vx = Math.cos(pl.angle); vy = Math.sin(pl.angle); }
    else { let len = Math.hypot(mv.x, mv.y); vx = mv.x / len; vy = mv.y / len; }
    pl.dashVx = vx * (pl.speed * 3.5);
    pl.dashVy = vy * (pl.speed * 3.5);
    pl.dashTimer = 12;
    pl.dashCooldown = pl.maxDashCooldown;
    pl.isInvulnerable = true;
    pl.dashCritTimer = 60;   // หน้าต่าง 1 วิ — ใช้ได้ 1 โจมตี (เคลียร์ทันทีหลังโจมตี)
    playSynthSFX(pl.weaponType === "SWORD" ? "dash_cyber" : "dash_thruster");
}