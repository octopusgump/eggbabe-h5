/**
 * 跨端高清 780x1688 壁纸合成与导出模块
 * - H5 端：离屏 Canvas 合成并自动触发下载
 * - 小程序端：隐藏 <canvas type="2d"> 合成并保存到系统相册
 */

const EXPORT_W = 780;
const EXPORT_H = 1688;

function loadImage(canvas, url) {
  return new Promise((resolve, reject) => {
    const img = typeof canvas.createImage === "function"
      ? canvas.createImage()
      : (() => {
          const el = new Image();
          el.crossOrigin = "anonymous";
          return el;
        })();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${url}`));
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

async function renderComposite(canvas, { bg, pet, worn }) {
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, EXPORT_W, EXPORT_H);

  const bgImg = await loadImage(canvas, bg.url);
  drawCover(ctx, bgImg, EXPORT_W, EXPORT_H);

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

  const ox = fx - pet.cx * pet.exportScale;
  const oy = fy - pet.feetY * pet.exportScale;
  let bodyUrl = pet.textures.base;
  if (pet.mode === "sets" && worn && worn.set) {
    const setItem = pet.items.find((x) => x.id === worn.set);
    if (setItem) bodyUrl = setItem.texUrl;
  }
  const bodyImg = await loadImage(canvas, bodyUrl);
  ctx.drawImage(bodyImg, ox, oy, pet.canvasW * pet.exportScale, pet.canvasH * pet.exportScale);

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
}

export async function exportWallpaper({ canvas, bg, pet, worn }) {
  // #ifdef H5
  const h5Canvas = document.createElement("canvas");
  await renderComposite(h5Canvas, { bg, pet, worn });
  const dataUrl = h5Canvas.toDataURL("image/jpeg", 0.92);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `eggbabe_${pet.id}_${bg.id}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return dataUrl;
  // #endif

  // #ifndef H5
  await renderComposite(canvas, { bg, pet, worn });
  const tempFilePath = await new Promise((resolve, reject) => {
    uni.canvasToTempFilePath({
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
    uni.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success: resolve,
      fail: reject
    });
  });
  return tempFilePath;
  // #endif
}

/**
 * 渲染紧凑型透明底宠物快照（360x360 PNG DataURL），用于同步给 iOS WidgetKit 桌面小组件
 */
export async function renderWidgetSnapshotDataUrl({ pet, worn }) {
  // #ifdef H5
  if (!pet || typeof document === "undefined") return "";
  const size = 360;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const scale = Math.min((size * 0.9) / pet.canvasW, (size * 0.9) / pet.canvasH);
  const dw = pet.canvasW * scale;
  const dh = pet.canvasH * scale;
  const ox = (size - dw) / 2;
  const oy = (size - dh) / 2;

  let bodyUrl = pet.textures.base;
  if (pet.mode === "sets" && worn && worn.set) {
    const setItem = pet.items.find((x) => x.id === worn.set);
    if (setItem) bodyUrl = setItem.texUrl;
  }
  const bodyImg = await loadImage(canvas, bodyUrl);
  ctx.drawImage(bodyImg, ox, oy, dw, dh);

  if (pet.mode === "accessories" && worn) {
    const slotIds = [worn.neck, worn.head];
    for (let i = 0; i < slotIds.length; i++) {
      const id = slotIds[i];
      if (!id) continue;
      const it = pet.items.find((x) => x.id === id);
      if (!it) continue;
      const accImg = await loadImage(canvas, it.texUrl);
      ctx.drawImage(accImg, ox + it.x * scale, oy + it.y * scale, it.w * scale, it.h * scale);
    }
  }
  return canvas.toDataURL("image/png");
  // #endif

  // #ifndef H5
  return "";
  // #endif
}

