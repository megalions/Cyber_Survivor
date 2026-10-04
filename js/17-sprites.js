"use strict";
// ================== [เฟส A1] ระบบสไปรต์: โหลดจาก assets/ + ถอยกลับอิโมจิเมื่อไม่มีไฟล์ ==================
// วิธีใช้: วางไฟล์ PNG (จัตุรัส พื้นหลังโปร่งใส ตัวละครหันซ้าย) ในโฟลเดอร์ assets/ ตามชื่อใน SPRITE_FILES
// ไม่มีไฟล์ = วาดอิโมจิเหมือนเดิม 100% — เสียบ/ถอดได้ทุกตัวอิสระ ไม่ต้องแก้โค้ด

const SPRITES = {};
const SPRITE_FILES = {
    // ผู้เล่น 5 คลาส
    SWORD: "assets/sprites/player_sword.png",
    GUN: "assets/sprites/player_gun.png",
    SHOTGUN: "assets/sprites/player_shotgun.png",
    LASER: "assets/sprites/player_laser.png",
    DRONE: "assets/sprites/player_drone.png",
    // มอนสเตอร์
    NORMAL: "assets/sprites/monster_normal.png",
    RANGED: "assets/sprites/monster_ranged.png",
    SPEEDY: "assets/sprites/monster_speedy.png",
    TANK: "assets/sprites/monster_tank.png",
    HEALER: "assets/sprites/monster_healer.png",
    SPLITTER: "assets/sprites/monster_splitter.png",
    SPLITTER_SMALL: "assets/sprites/monster_splitter_small.png",
    SHIELDER: "assets/sprites/monster_shielder.png",
    BLOCK_OBSTACLE: "assets/sprites/monster_rock.png",
    // บอส
    BOSS_MELEE: "assets/sprites/boss_dragon.png",
    BOSS_CYBERMAGE: "assets/sprites/boss_cybermage.png",
    BOSS_OVERLORD: "assets/sprites/boss_overlord.png",
    BOSS_DEVILCORE: "assets/sprites/boss_devilcore.png",
    // หน่วยรบ
    DEPLOY_DRONE: "assets/sprites/deploy_drone.png",
    DEPLOY_DRONE_QUEEN: "assets/sprites/deploy_drone_queen.png",
    DEPLOY_TURRET: "assets/sprites/deploy_turret.png",
    // กระสุน
    MISSILE: "assets/sprites/projectile_missile.png",
    // พื้นหลังต่อธีม
    BG_CYBER: "assets/backgrounds/bg_cyber.png",
    BG_BLOOD: "assets/backgrounds/bg_blood.png",
    BG_VENOM: "assets/backgrounds/bg_venom.png",
    BG_GOLD: "assets/backgrounds/bg_gold.png",
    // กำแพงต่อธีม
    WALL_CYBER: "assets/walls/wall_cyber.png",
    WALL_BLOOD: "assets/walls/wall_blood.png",
    WALL_VENOM: "assets/walls/wall_venom.png",
    WALL_GOLD: "assets/walls/wall_gold.png"
};
// [เฟส A1+] ปรับ "ขนาดแสดงผล" รายตัว — ไม่แตะ hitbox (กระสุนยังชนตามขนาดเดิม)
// คีย์ = ชื่อเดียวกับ SPRITE_FILES | 1 = ปกติ | 1.2 = ใหญ่ขึ้น 20% | ลบ/คอมเมนต์ = กลับปกติ
const SPRITE_SCALE = {
	"SWORD": 1.8,
	"GUN": 1.8,
	"SHOTGUN": 1.8,
	"LASER": 1.8,
	"DRONE": 1.8,
	///////////////////////
	"NORMAL": 1.8,
	"RANGED": 1.8,
    "SPEEDY": 1.8,
    "TANK": 1.8,
    "HEALER": 1.8,
    "SPLITTER": 1.8,
    "SPLITTER_SMALL": 1.8,
    "SHIELDER": 1.5,
	
	"BOSS_MELEE": 1.2,
	"BOSS_CYBERMAGE": 1.5,
	"BOSS_OVERLORD": 1.5,
	"BOSS_DEVILCORE": 1.0,

};
// [เฟส A3] แอนิเมชัน: จำนวนเฟรมต่อสไปรต์ — PNG ต้องเป็น "แถบแนวนอน เฟรมกว้างเท่ากัน"
// เฟรม 0 (ซ้ายสุด) = ท่ายืน (ตอนหยุด) | เฟรม 1..n = วงจรเดิน (เลือกอัตโนมัติเมื่อเดิน) | ไม่ประกาศ = 1 เฟรมนิ่ง
const ANIM_FRAMES = {
    // [แก้บั๊ก] ห้ามใส่อัตโนมัติ — ใช้เฉพาะเมื่อ "คุณทำ PNG แถบหลายเฟรม" แล้วประกาศเอง เช่น:
	  "SWORD": 4,
	  "GUN": 4,
	  "SHOTGUN": 4,
	  "LASER": 4,
	  "DRONE": 4,	
	///////////////////////
	"NORMAL": 4,
	"RANGED": 4,
    "SPEEDY": 4,
    "TANK": 4,
    "HEALER": 4,
    "SPLITTER": 4,
    "SPLITTER_SMALL": 4,
    "SHIELDER": 4,
	
	"BOSS_MELEE": 4, 
	"BOSS_CYBERMAGE": 4,
	"BOSS_OVERLORD": 4,	
	"BOSS_DEVILCORE": 4, 
	  
    // (พิกเซลในโค้ดนับเฟรมเดินเองอัตโนมัติ / PNG รูปเดี่ยว = นิ่ง ไม่ต้องประกาศ)
};
(function loadSprites() {
    for (let k in SPRITE_FILES) {
        let img = new Image();
        img.src = SPRITE_FILES[k];
        img.onload = () => { if (!player && lobby) renderLobby(); };   // [เฟส A1-fix] การ์ด lobby รีเฟรชเองเมื่อ PNG โหลดเสร็จ (ไม่ต้อง refresh หน้า)
        SPRITES[k] = img;   // img.complete + naturalWidth จะบอกเองว่าโหลดสำเร็จไหม
    }
})();

// วาดสไปรต์ถ้ามี ไม่มี = อิโมจิ (เรียกภายใน translate/scale ที่จัดไว้แล้ว — พิกัด 0,0 กึ่งกลาง)
// ================== [เฟส A1+] พิกเซลอาร์ตในโค้ด: 1 อักษร = 1 พิกเซล ==================
// "." = โปร่งใส | 0=ดำเข้ม 1=เหล็กเข้ม 2=เหล็กกลาง | C/O/Y/B/G = สีเนออนประจำคลาส
const PIXPAL = {
    ".": null,
    "0": "#0b0e18",
    "1": "#1a2030",
    "2": "#2c3550",
    "C": "#00ffcc",   // SWORD — เขียวมิ้นท์
    "O": "#ff923d",   // GUN — ส้ม
    "Y": "#ffd23d",   // SHOTGUN — เหลือง
    "B": "#7df9ff",   // LASER — ฟ้า
    "G": "#3dff8c"    // DRONE — เขียว
};
const PIXSPR = {};
function buildPixFrame(rows) {   // [เฟส A3] สร้าง canvas จาก grid 1 เฟรม
    let h = rows.length, w = rows[0].length;
    let cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    let c2 = cv.getContext("2d");
    for (let y = 0; y < h; y++) {
        let row = rows[y];
        for (let x = 0; x < w; x++) {
            let col = PIXPAL[row[x]];
            if (col) { c2.fillStyle = col; c2.fillRect(x, y, 1, 1); }
        }
    }
    return cv;
}
function buildPixSprite(key, rows) { PIXSPR[key] = buildPixFrame(rows); }
// [เฟส A3] เฟรมเดินอัตโนมัติของหุ่นผู้เล่น: ก๊อปเฟรมต้น + สลับขาก้าว (2 บรรทัดล่าง)
function makeWalkFrame(base) {
    let f = base.slice(0, 14);
    f.push("....11....11....");
    f.push("....00....00....");
    return f;
}
const PIX = {
    SWORD: [
        "......C..C......",
        "......1..1......",
        "....11111111....",
        "...1222222221...",
        "..122222222221..",
        "..120CC00CC021..",
        "..122222222221..",
        "...1222222221...",
        "....11111111....",
        "......1221......",
        "....12222221....",
        "...1122CC2211...",
        "...1122222211...",
        "....12222221....",
        ".....11..11.....",
        ".....00..00....."
    ],
    GUN: [
        ".......O........",
        ".......1........",
        "....11111111....",
        "...1222222221...",
        "..122222222221..",
        "..1200O00O0021..",
        "..122222222221..",
        "...1222222221...",
        "....11111111....",
        "......1221......",
        "....12222221....",
        "...1122OO2211...",
        "...1122222211...",
        "....12222221....",
        ".....11..11.....",
        ".....00..00....."
    ],
    SHOTGUN: [
        "................",
        "....1......1....",
        "....11111111....",
        "...1222222221...",
        "..122222222221..",
        "..12YY0YY0YY21..",
        "..122222222221..",
        "...1222222221...",
        "....11111111....",
        "......1221......",
        "....12222221....",
        "...1122YY2211...",
        "...1122222211...",
        "....12222221....",
        ".....11..11.....",
        ".....00..00....."
    ],
    LASER: [
        ".......B........",
        ".......1........",
        "....11111111....",
        "...1222222221...",
        "..122222222221..",
        "..120BB00BB021..",
        "..122222222221..",
        "...1222222221...",
        "....11111111....",
        "......1221......",
        "....12222221....",
        "...1122BB2211...",
        "...1122222211...",
        "....12222221....",
        ".....11..11.....",
        ".....00..00....."
    ],
    DRONE: [
        ".......G........",
        ".......1........",
        "....11111111....",
        "...1222222221...",
        ".G122222222221G.",
        "..120GG00GG021..",
        "..122222222221..",
        "...1222222221...",
        "....11111111....",
        "......1221......",
        "....12222221....",
        "...1122GG2211...",
        "...1122222211...",
        "....12222221....",
        ".....11..11.....",
        ".....00..00....."
    ]
};
for (let k in PIX) buildPixSprite(k, PIX[k]);
// [เฟส A3] หุ่น 5 คลาส: แปลงเป็น [เฟรมยืน, เฟรมเดิน] อัตโนมัติ
["SWORD", "GUN", "SHOTGUN", "LASER", "DRONE"].forEach(k => {
    if (PIXSPR[k] && !Array.isArray(PIXSPR[k])) {
        PIXSPR[k] = [PIXSPR[k], buildPixFrame(makeWalkFrame(PIX[k]))];
    }
});

// [v9-6] นับเฟรม PNG จากภาพจริง (สัญญาเดิม: เฟรมจัตุรัส เรียงแนวนอน):
//   แถบ 4 เฟรม (กว้าง = 4× สูง) → ใช้ 4 ตาม ANIM_FRAMES
//   รูปเดี่ยวจัตุรัส            → นับ 1 (ไม่โดนตัดเหลือ 1/4 ภาพ)
//   แถบทำยังไม่ครบ (2/4)       → นับตามที่มีจริง กันตัดภาพเพี้ยน
function pngFrames(key, img) {
    let n = ANIM_FRAMES[key] || 1;
    if (n > 1 && img.naturalWidth < img.naturalHeight * n) {
        n = Math.max(1, Math.floor(img.naturalWidth / img.naturalHeight));
    }
    return n;
}

// ลำดับชั้น: ไฟล์ PNG > พิกเซลในโค้ด > อิโมจิ | frame = เฟรมแอนิเมชัน (ไม่ส่ง = 0 นิ่ง)
function drawSpriteOrIcon(icon, key, x, y, size, frame) {
    size = size * (SPRITE_SCALE[key] || 1);   // [เฟส A1+] ขนาดแสดงผลรายตัว
    let fr = frame || 0;
    let img = SPRITES[key];
    if (img && img.complete && img.naturalWidth > 0) {
        let n = pngFrames(key, img);   // [v9-6] แถบ = ตามประกาศ / รูปเดี่ยว = 1 ไม่ตัดภาพ
        let fw = img.naturalWidth / n;
        if (fr >= n) fr = n - 1;
        ctx.drawImage(img, fr * fw, 0, fw, img.naturalHeight, x - size / 2, y - size / 2, size, size);
        return;
    }
    let px = PIXSPR[key];
    if (px) {
        if (Array.isArray(px)) {   // [เฟส A3] พิกเซลหลายเฟรม
            if (fr >= px.length) fr = px.length - 1;
            px = px[fr];
        }
        ctx.imageSmoothingEnabled = false;   // คมแบบพิกเซล
        ctx.drawImage(px, x - size / 2, y - size / 2, size, size);
        ctx.imageSmoothingEnabled = true;
        return;
    }
    let pa = ctx.textAlign, pb = ctx.textBaseline;   // [เฟส A1-fix] อิโมจิจัดกึ่งกลางเหมือนรูปเสมอ (การ์ด HUD ใช้ align ซ้าย)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = size + "px serif";
    ctx.fillText(icon, x, y);
    ctx.textAlign = pa;
    ctx.textBaseline = pb;
}

// [เฟส A1-fix] สำหรับ HTML (การ์ด lobby/บิลด์): คืน <img> ตามลำดับชั้น PNG > พิกเซล > อิโมจิ
function spriteHtml(key, icon, pxSize) {
    pxSize = Math.round(pxSize * (SPRITE_SCALE[key] || 1));   // [เฟส A1+] การ์ดตามสเกลเดียวกัน
    let img = SPRITES[key];
    if (img && img.complete && img.naturalWidth > 0) {
        let n = pngFrames(key, img);   // [v9-6] รูปเดี่ยว = ไม่เข้าโหมด CSS sprite
        if (n > 1) {   // [แก้บั๊ก] PNG แถบหลายเฟรม: การ์ดแสดงเฉพาะเฟรมแรก (CSS sprite — ปลอดภัยกับ file://)
            return '<div style="width:' + pxSize + 'px;height:' + pxSize + 'px;display:inline-block;vertical-align:-8px;'
                 + 'background-image:url(' + img.src + ');background-size:' + (pxSize * n) + 'px ' + pxSize + 'px;'
                 + 'background-position:0 0;background-repeat:no-repeat;"></div>';
        }
        return '<img src="' + img.src + '" style="width:' + pxSize + 'px;height:' + pxSize + 'px;vertical-align:-8px;">';
    }
    let px = PIXSPR[key];
    if (px) {
        if (Array.isArray(px)) px = px[0];   // [แก้บั๊ก] หลายเฟรม = การ์ดใช้เฟรมแรก (ภาพนิ่ง) — ตัวที่ทำเกมล่ม
        return '<img src="' + px.toDataURL() + '" style="width:' + pxSize + 'px;height:' + pxSize + 'px;vertical-align:-8px;image-rendering:pixelated;">';
    }
    return icon;
}

// [เฟส A2] พื้นหลังธีม: มีภาพ = เรียงต่อ (tile) ในพิกัดโลก เลื่อน/ซูมตามกล้อง / ไม่มี = สีพื้น
function drawThemeBg(th, viewW, viewH) {
    let img = SPRITES["BG_" + th.name];
    if (img && img.complete && img.naturalWidth > 0) {
        let iw = img.naturalWidth, ih = img.naturalHeight;
        let startX = Math.floor(camera.x / iw) * iw;
        let startY = Math.floor(camera.y / ih) * ih;
        for (let wy = startY; wy < camera.y + viewH + ih; wy += ih) {
            for (let wx = startX; wx < camera.x + viewW + iw; wx += iw) {
                ctx.drawImage(img, wx - camera.x, wy - camera.y);
            }
        }
    } else {
        ctx.fillStyle = th.bg;
        ctx.fillRect(0, 0, viewW, viewH);
    }
}

// [เฟส A3] เลือกเฟรม: หยุด = 0 / เดิน = วน 8 fps (เฟสต่างกันตาม seed กันเดินพร้อมแถว)
// อยากปรับความเร็ววงจร: แก้ตัวเลข 8 ใน animFrame
function spriteFrames(key) {
    let img = SPRITES[key];
    if (img && img.complete && img.naturalWidth > 0) return pngFrames(key, img);   // [v9-6] PNG: ตรวจจากภาพจริง (แถบ/รูปเดี่ยว)
    let px = PIXSPR[key];
    if (Array.isArray(px)) return px.length;   // [v9-6] พิกเซล: วนครบเฟรมจริง (ยืน-เดิน สลับสม่ำเสมอ — เดิม max(4,2) เดิน 3/4 จังหวะ)
    return 1;   // อิโมจิ = นิ่ง
}
function animFrame(key, moving, seed) {
    if (!moving) return 0;
    let n = spriteFrames(key);
    if (n < 2) return 0;
    return Math.floor(gameTime * 8 + (seed || 0)) % n;
}