/**
 * 高清 780x1688 手机壁纸合成与相册保存模块
 * 使用页面隐藏的 <canvas type="2d"> 将当前背景 + 柔光投影 + 宠物(及穿搭) 合成导出。
 */

const EXPORT_W = 780;
const EXPORT_H = 1688;

function loadImage(canvas, url) {
  return new Promise((resolve, reject) => {
    const img = canvas.createImage();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`图片加载失败: ${url}`));
    img.src = url;
  });
}

function drawCover(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const nw = img.width * scale;
  const nh = img.height * scale;
  const dx = (w - nw) / 2;
  const dy = (h - nh) / 2;
  ctx.drawImage(img, dx, dy, nw, nh);
}

async function exportWallpaper({ canvas, bg, pet, worn }) {
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, EXPORT_W, EXPORT_H);

  // 1. 背景层
  const bgImg = await loadImage(canvas, bg.url);
  drawCover(ctx, bgImg, EXPORT_W, EXPORT_H);

  // 2. 柔和脚底投影
  const fx = pet.exportFeetX;
  const fy = pet.exportFeetY;
  ctx.save();
  ctx.translate(fx + 10, fy - 4);
  ctx.scale(1, 0.28);
  const grad = ctx.createRadialGradient(0, 0, 12, 0, 0, 170);
  grad.addColorStop(0, bg.exportShadowRgba || "rgba(40, 26, 16, 0.36)");
  grad.addColorStop(0.55, "rgba(40, 26, 16, 0.12)");
  grad.addColorStop(1, "rgba(40, 26, 16, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 170, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. 宠物主体（锦鲤若穿全身套装则直接绘制套装原图）
  const ox = fx - pet.cx * pet.exportScale;
  const oy = fy - pet.feetY * pet.exportScale;
  let bodyUrl = pet.textures.base;
  if (pet.mode === "sets" && worn && worn.set) {
    const setItem = pet.items.find((x) => x.id === worn.set);
    if (setItem) bodyUrl = setItem.texUrl;
  }
  const bodyImg = await loadImage(canvas, bodyUrl);
  ctx.drawImage(bodyImg, ox, oy, pet.canvasW * pet.exportScale, pet.canvasH * pet.exportScale);

  // 4. 玉兔配饰叠加层（先围巾再头饰）
  if (pet.mode === "accessories" && worn) {
    const slotIds = [worn.neck, worn.head];
    for (let i = 0; i < slotIds.length; i++) {
      const id = slotIds[i];
      if (!id) continue;
      const it = pet.items.find((x) => x.id === id);
      if (!it) continue;
      const accImg = await loadImage(canvas, it.texUrl);
      ctx.drawImage(
        accImg,
        ox + it.x * pet.exportScale,
        oy + it.y * pet.exportScale,
        it.w * pet.exportScale,
        it.h * pet.exportScale
      );
    }
  }

  // 5. 生成临时文件并保存到系统相册
  const tempFilePath = await new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      width: EXPORT_W,
      height: EXPORT_H,
      destWidth: EXPORT_W,
      destHeight: EXPORT_H,
      fileType: "jpg",
      quality: 0.92,
      success: (res) => resolve(res.tempFilePath),
      fail: reject
    });
  });

  await new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success: resolve,
      fail: reject
    });
  });

  return tempFilePath;
}

module.exports = {
  exportWallpaper
};
