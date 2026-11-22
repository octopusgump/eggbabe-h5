<template>
  <view class="viewport">
    <view class="page" :class="{ 'drawer-open': isDrawerOpen }" :style="{ background: currentBg.stageBg }">
      <!-- 1. 全屏背景图（陪伴态 top: 0%，装扮态平滑上移 -29.03%） -->
      <image class="stage-bg" :src="currentBg.url" mode="aspectFill" />

      <!-- 2. 顶部安全区：宠物切换 + 音效/壁纸/分享 + 养成状态条 -->
      <view class="top-bar" :style="{ paddingTop: safeTop + 'px' }">
        <view class="top-row" :style="{ paddingRight: capsuleRightPad + 'px' }">
          <view class="pet-switch">
            <button
              class="pet-pill"
              :class="{ active: petId === 'koi' }"
              @tap="onSwitchPet('koi')"
            >锦鲤</button>
            <button
              class="pet-pill"
              :class="{ active: petId === 'yutu' }"
              @tap="onSwitchPet('yutu')"
            >玉兔</button>
          </view>
          <view class="action-group">
            <button class="icon-btn" @tap="onToggleMute">{{ muted ? '🔇' : '🔊' }}</button>
            <button class="act-btn" :loading="exporting" :disabled="exporting" @tap="onSaveWallpaper">存壁纸</button>
            <!-- #ifdef MP-WEIXIN -->
            <button class="act-btn share-btn" open-type="share">分享</button>
            <!-- #endif -->
          </view>
        </view>

        <!-- 轻养成状态胶囊：等级 + 饱食 + 清洁 -->
        <view class="care-hud">
          <view class="lv-badge" @tap="onTapLvBadge">
            <text class="lv-text">Lv.{{ petCare.level }}</text>
            <view class="exp-track">
              <view class="exp-fill" :style="{ width: expPercent + '%' }"></view>
            </view>
          </view>
          <view class="stat-pill" :class="{ low: isHungry }" @tap="onOpenMode('feed')">
            <text class="stat-ico">🍖</text>
            <view class="stat-track">
              <view class="stat-fill hunger" :style="{ width: Math.round(petCare.hunger) + '%' }"></view>
            </view>
            <text class="stat-num">{{ Math.round(petCare.hunger) }}</text>
          </view>
          <view class="stat-pill" :class="{ low: isDirty }" @tap="onOpenMode('bath')">
            <text class="stat-ico">🫧</text>
            <view class="stat-track">
              <view class="stat-fill hygiene" :style="{ width: Math.round(petCare.hygiene) + '%' }"></view>
            </view>
            <text class="stat-num">{{ Math.round(petCare.hygiene) }}</text>
          </view>
        </view>
      </view>

      <!-- 3. 宠物互动舞台 -->
      <view
        id="stage-box"
        class="stage-box"
        @touchstart="onStageTouchStart"
        @touchmove="onStageTouchMove"
        @touchend="onStageTouchEnd"
        @touchcancel="onStageTouchEnd"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
      >
        <view
          class="shadow-soft"
          :style="{
            background: currentBg.shadowSoft,
            transform: 'translate(-50%,-50%) scale(' + shadow.softS + ')',
            opacity: shadow.softO
          }"
        ></view>
        <view
          class="shadow-contact"
          :style="{
            background: currentBg.shadowContact,
            transform: 'translate(-50%,-50%) scale(' + shadow.conS + ')',
            opacity: shadow.conO
          }"
        ></view>

        <!-- #ifdef H5 -->
        <view id="pet-gl-host" class="pet-gl"></view>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <canvas type="webgl" id="pet-gl" class="pet-gl"></canvas>
        <!-- #endif -->

        <!-- 脏污提醒：淡绿臭气波浪线 + 嗡嗡绕飞小苍蝇 + 小灰尘（清洁 < 30% 时出现） -->
        <view v-if="isDirty && !rinsing" class="dirty-layer" :class="{ lifted: isDrawerOpen }">
          <view class="stink-wisp stink-1">
            <view class="stink-seg stink-top"></view>
            <view class="stink-seg stink-bot"></view>
          </view>
          <view class="stink-wisp stink-2">
            <view class="stink-seg stink-top"></view>
            <view class="stink-seg stink-bot"></view>
          </view>
          <view class="stink-wisp stink-3">
            <view class="stink-seg stink-top"></view>
            <view class="stink-seg stink-bot"></view>
          </view>
          <view class="fly fly-a">
            <view class="fly-wing wing-l"></view>
            <view class="fly-body"></view>
            <view class="fly-wing wing-r"></view>
          </view>
          <view class="fly fly-b">
            <view class="fly-wing wing-l"></view>
            <view class="fly-body"></view>
            <view class="fly-wing wing-r"></view>
          </view>
          <view class="dust dust-1"></view>
          <view class="dust dust-2"></view>
          <view class="dust dust-3"></view>
        </view>

        <!-- 洗澡泡泡层 -->
        <view v-if="bubbles.length > 0" class="fx-layer">
          <view
            v-for="b in bubbles"
            :key="b.id"
            class="soap-bubble"
            :class="{ popping: b.popping }"
            :style="{
              left: b.xPct + '%',
              top: b.yPct + '%',
              width: b.size + 'px',
              height: b.size + 'px'
            }"
          ></view>
        </view>

        <!-- 冲水闪光层 -->
        <view v-if="rinsing" class="rinse-flash">
          <view class="rinse-sheen"></view>
        </view>

        <!-- 粒子特效层（喂食爱心 / 冲水星光 / 升级彩星） -->
        <view v-if="particles.length > 0" class="fx-layer">
          <text
            v-for="pt in particles"
            :key="pt.id"
            class="fx-particle"
            :style="{ left: pt.xPct + '%', top: pt.yPct + '%' }"
          >{{ pt.char }}</text>
        </view>

        <!-- 投喂飞行零食 -->
        <view
          v-if="flyingSnack"
          class="flying-snack"
          :style="{ left: flyingSnack.xPct + '%', top: flyingSnack.yPct + '%' }"
        >{{ flyingSnack.emoji }}</view>

        <!-- 情绪对话气泡 -->
        <view v-if="speechText" class="speech-bubble" :class="{ lifted: isDrawerOpen }">
          <text class="speech-text">{{ speechText }}</text>
        </view>

        <!-- 数值奖励飘字 -->
        <view v-if="floatToasts.length > 0" class="toast-layer" :class="{ lifted: isDrawerOpen }">
          <view v-for="ft in floatToasts" :key="ft.id" class="float-toast" :class="{ gold: ft.gold }">
            {{ ft.text }}
          </view>
        </view>

        <view v-if="sleeping && uiMode === 'home'" class="sleep-zz">Zzz</view>
        <view v-if="loadingPet" class="stage-loading">加载宠物中...</view>
      </view>

      <!-- 3.5 右侧悬浮陪伴胶囊（喂食 / 洗澡 / 装扮） -->
      <view v-if="uiMode !== 'wardrobe'" class="care-dock">
        <view
          class="dock-btn"
          :class="{ active: uiMode === 'feed' }"
          @tap="onToggleMode('feed')"
        >
          <text class="dock-ico">🍖</text>
          <text class="dock-label">喂食</text>
          <view v-if="isHungry" class="dock-dot"></view>
        </view>
        <view class="dock-divider"></view>
        <view
          class="dock-btn"
          :class="{ active: uiMode === 'bath' }"
          @tap="onToggleMode('bath')"
        >
          <text class="dock-ico">🫧</text>
          <text class="dock-label">洗澡</text>
          <view v-if="isDirty" class="dock-dot"></view>
        </view>
        <view class="dock-divider"></view>
        <view class="dock-btn" @tap="onOpenMode('wardrobe')">
          <text class="dock-ico">👗</text>
          <text class="dock-label">装扮</text>
        </view>
      </view>

      <!-- 4A. 喂食托盘（支持点击投喂 & 按住拖到宠物嘴边） -->
      <view v-if="uiMode === 'feed'" class="feed-tray">
        <view class="tray-header">
          <text class="tray-title">投喂小零食 · 轻点或拖到宠物嘴边</text>
          <button class="tray-close" @tap="onCloseMode">收起</button>
        </view>
        <view class="snack-row">
          <view
            v-for="sn in currentSnacks"
            :key="sn.id"
            class="snack-card"
            @touchstart.stop="onSnackTouchStart($event, sn)"
            @touchmove.stop.prevent="onSnackTouchMove($event)"
            @touchend.stop="onSnackTouchEnd($event, sn)"
            @touchcancel.stop="onSnackTouchCancel"
            @mousedown.stop="onSnackMouseDown($event, sn)"
          >
            <text class="snack-emoji">{{ sn.emoji }}</text>
            <text class="snack-name">{{ sn.name }}</text>
            <text class="snack-meta">+{{ sn.hunger }}饱食 · +{{ sn.exp }}亲密</text>
          </view>
        </view>
      </view>

      <!-- 4A-2. 洗澡搓澡进度条（底部悬浮，不遮挡顶栏与右侧入口） -->
      <view v-if="uiMode === 'bath'" class="bath-hud">
        <view class="bath-hud-left">
          <text class="bath-title">🫧 在宠物身上来回揉搓洗香香 ({{ Math.round(bathProgress) }}%)</text>
          <view class="bath-track">
            <view class="bath-fill" :style="{ width: Math.round(bathProgress) + '%' }"></view>
          </view>
        </view>
        <button class="bath-exit" @tap="onCloseMode">退出</button>
      </view>

      <!-- 拖拽中的幽灵零食 -->
      <view
        v-if="dragSnack.active"
        class="drag-ghost"
        :class="{ 'over-pet': dragSnack.overPet }"
        :style="{ left: dragSnack.x + 'px', top: dragSnack.y + 'px' }"
      >
        <text class="drag-ghost-emoji">{{ dragSnack.snack.emoji }}</text>
      </view>

      <!-- 4B. 底部衣橱抽屉（点击「装扮」时平滑滑出，套装 / 背景 双 Tab） -->
      <view class="sheet" :class="{ open: isDrawerOpen }">
        <view class="sheet-top" @tap="onCloseMode">
          <view class="sheet-handle"></view>
          <text class="sheet-done">完成 ⌄</text>
        </view>
        <view class="sheet-tabs">
          <button
            class="sheet-tab"
            :class="{ active: activeTab === 'items' }"
            @tap="onSelectTab('items')"
          >{{ currentPet.drawerTitle }}</button>
          <button
            class="sheet-tab"
            :class="{ active: activeTab === 'bg' }"
            @tap="onSelectTab('bg')"
          >背景 ({{ backgrounds.length }})</button>
        </view>
        <scroll-view class="grid-scroll" scroll-y="true" show-scrollbar="false">
          <view v-if="activeTab === 'items' && drawerItems.length > 0" class="card-grid">
            <view
              v-for="item in drawerItems"
              :key="item.id"
              class="card"
              :class="{ selected: item.selected }"
              @tap="onTapItem(item)"
            >
              <view class="thumb-wrap">
                <image class="card-img" :src="item.thumbUrl" mode="aspectFit" lazy-load="true" />
              </view>
              <text class="card-name">{{ item.name }}</text>
              <view v-if="item.selected" class="card-badge">✓</view>
            </view>
          </view>
          <view v-else-if="activeTab === 'items'" class="empty-sets">
            <text class="empty-title">{{ currentPet.label }}全身套装筹备中</text>
            <text class="empty-sub">旧款小饰品已下线，敬请期待 2×2 全新套装</text>
            <button class="empty-btn" @tap="onSelectTab('bg')">先去换小屋背景 →</button>
          </view>
          <view v-else class="card-grid">
            <view
              v-for="bg in backgrounds"
              :key="bg.id"
              class="card bg-card"
              :class="{ selected: currentBg.id === bg.id }"
              @tap="onSelectBg(bg)"
            >
              <view class="thumb-wrap">
                <image class="card-img bg-img" :src="bg.url" mode="aspectFill" lazy-load="true" />
              </view>
              <text class="card-name">{{ bg.name }}</text>
              <view v-if="currentBg.id === bg.id" class="card-badge">✓</view>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- #ifndef H5 -->
      <canvas type="2d" id="export-canvas" class="export-canvas"></canvas>
      <!-- #endif -->
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { onLoad, onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import { getDefaultCatalog, fetchRemoteCatalog } from "../../config/catalogLoader";
import { PetStage } from "../../engine/petStage";
import { exportWallpaper } from "../../engine/wallpaperExporter";
import {
  SNACKS_BY_PET,
  loadCareAll,
  saveCareAll,
  applyTimeDecay,
  expForNextLevel,
  getMood,
  getReminderSpeech,
  feedPet,
  finishBath,
  interactPet
} from "../../engine/careStore";
import {
  isMuted,
  setMuted,
  haptic,
  playMunch,
  playBubble,
  playSplash,
  playHappy,
  playLevelUp,
  playPop
} from "../../engine/sfx";

const initial = getDefaultCatalog();
const catalog = reactive({
  version: initial.version,
  backgrounds: initial.backgrounds,
  pets: initial.pets
});

const safeTop = ref(14);
const capsuleRightPad = ref(12);
const petId = ref("koi");
const uiMode = ref("home"); // "home" | "feed" | "bath" | "wardrobe"
const activeTab = ref("items");
const currentBgId = ref(initial.backgrounds[0].id);
const loadingPet = ref(true);
const sleeping = ref(false);
const exporting = ref(false);
const muted = ref(isMuted());
const shadow = reactive({ softS: 1, softO: 1, conS: 1, conO: 1 });

// 轻养成状态（锦鲤 & 玉兔独立持久化）
const careAll = reactive(loadCareAll());
applyTimeDecay(careAll.koi);
applyTimeDecay(careAll.yutu);

const wornByPet = reactive({
  koi: { set: null },
  yutu: { set: null, head: null, neck: null }
});

// 情绪气泡 / 奖励飘字 / 粒子 / 洗澡泡泡 / 投喂状态
const speechText = ref("");
const floatToasts = ref([]);
const particles = ref([]);
const bubbles = ref([]);
const bathProgress = ref(0);
const rinsing = ref(false);
const flyingSnack = ref(null);
const dragSnack = reactive({
  active: false,
  snack: null,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  moved: false,
  overPet: false
});

const isDrawerOpen = computed(() => uiMode.value === "wardrobe");
const petCare = computed(() => careAll[petId.value] || careAll.koi);
const isHungry = computed(() => petCare.value.hunger < 30);
const isDirty = computed(() => petCare.value.hygiene < 30);
const expPercent = computed(() => {
  const need = expForNextLevel(petCare.value.level);
  return Math.min(100, Math.round((petCare.value.exp / need) * 100));
});
const currentSnacks = computed(() => SNACKS_BY_PET[petId.value] || SNACKS_BY_PET.koi);

const backgrounds = computed(() => catalog.backgrounds);
const currentBg = computed(
  () => catalog.backgrounds.find((b) => b.id === currentBgId.value) || catalog.backgrounds[0]
);
const currentPet = computed(() => catalog.pets[petId.value] || catalog.pets.koi);
const drawerItems = computed(() => {
  const pet = currentPet.value;
  const worn = wornByPet[pet.id];
  return pet.items.map((it) => ({
    ...it,
    selected: pet.mode === "sets" ? worn.set === it.id : worn[it.slot] === it.id
  }));
});

let stage = null;
let exportCanvas = null;
let stageRect = { left: 0, top: 0, width: 390, height: 844 };
let speechTimer = null;
let decayTimer = null;
let fxUid = 1;
let lastBubbleAt = 0;
let lastScrubPt = null;
let feedingLock = false;
const touchState = { active: false, startX: 0, startY: 0, moved: false, startTime: 0 };

function showSpeech(text, durationMs = 3400) {
  if (!text) return;
  speechText.value = text;
  if (speechTimer) clearTimeout(speechTimer);
  speechTimer = setTimeout(() => {
    speechText.value = "";
  }, durationMs);
}

function pushFloatToast(text, gold = false) {
  const id = fxUid++;
  floatToasts.value.push({ id, text, gold });
  setTimeout(() => {
    floatToasts.value = floatToasts.value.filter((x) => x.id !== id);
  }, 1250);
}

function spawnParticles(chars, centerXPct = 50, centerYPct = 52, count = 6) {
  for (let i = 0; i < count; i++) {
    const id = fxUid++;
    const xPct = centerXPct + (Math.random() - 0.5) * 34;
    const yPct = centerYPct + (Math.random() - 0.5) * 20;
    const char = chars[i % chars.length];
    particles.value.push({ id, xPct, yPct, char });
    setTimeout(() => {
      particles.value = particles.value.filter((p) => p.id !== id);
    }, 950);
  }
}

function syncPetMood(withReminder = false) {
  const ps = careAll[petId.value];
  applyTimeDecay(ps);
  const mood = getMood(ps);
  if (stage) stage.setMood(mood);
  if (withReminder && uiMode.value === "home") {
    const msg = getReminderSpeech(ps);
    if (msg) showSpeech(msg, 4200);
  }
}

function onSelectTab(tab) {
  activeTab.value = tab;
  playPop();
}

function onToggleMute() {
  muted.value = setMuted(!muted.value);
  if (!muted.value) playPop();
  haptic("light");
}

function onOpenMode(mode) {
  if (uiMode.value === mode) return;
  if (uiMode.value === "bath" && stage) stage.stopScrub();
  uiMode.value = mode;
  playPop();
  haptic("light");
  if (mode === "bath") {
    bathProgress.value = 0;
    bubbles.value = [];
    rinsing.value = false;
  }
  if (stage) {
    stage.setDrawerOpen(mode === "wardrobe");
  }
}

function onToggleMode(mode) {
  if (uiMode.value === mode) {
    onCloseMode();
  } else {
    onOpenMode(mode);
  }
}

function onCloseMode() {
  if (uiMode.value === "bath") {
    if (stage) stage.stopScrub();
    bubbles.value = [];
    bathProgress.value = 0;
  }
  uiMode.value = "home";
  if (stage) {
    stage.setDrawerOpen(false);
  }
}

function updateSafeArea() {
  // #ifndef H5
  try {
    const win = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
    const menu = uni.getMenuButtonBoundingClientRect ? uni.getMenuButtonBoundingClientRect() : null;
    safeTop.value = menu ? Math.max(menu.top, win.statusBarHeight || 20) : (win.statusBarHeight || 24) + 8;
    capsuleRightPad.value = menu ? Math.max(96, win.windowWidth - menu.left + 8) : 100;
  } catch (e) {
    safeTop.value = 44;
    capsuleRightPad.value = 104;
  }
  // #endif
}

function initStage() {
  // #ifdef H5
  const host = document.getElementById("pet-gl-host");
  const box = document.getElementById("stage-box");
  if (box) {
    const r = box.getBoundingClientRect();
    stageRect = { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  if (!host) return;
  host.innerHTML = "";
  const el = document.createElement("canvas");
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.display = "block";
  host.appendChild(el);
  try {
    stage = new PetStage(el, {
      dpr: window.devicePixelRatio || 2,
      drawerOpen: isDrawerOpen.value,
      onShadowUpdate: (s) => Object.assign(shadow, s),
      onSleepChange: (v) => { sleeping.value = v; },
      onReady: () => {
        loadingPet.value = false;
        syncPetMood(true);
      }
    });
    stage.setViewport(stageRect.width, stageRect.height);
    stage.setPet(currentPet.value, wornByPet[petId.value]);
  } catch (err) {
    console.error("[PetStage init]", err);
    loadingPet.value = false;
    uni.showToast({ title: "当前设备不支持 WebGL", icon: "none" });
  }
  // #endif

  // #ifndef H5
  const query = uni.createSelectorQuery();
  query.select("#stage-box").boundingClientRect();
  query.select("#pet-gl").node();
  query.select("#export-canvas").node();
  query.exec((res) => {
    if (!res || !res[1] || !res[1].node) {
      uni.showToast({ title: "画布初始化失败", icon: "none" });
      return;
    }
    if (res[0]) stageRect = res[0];
    const glCanvas = res[1].node;
    exportCanvas = res[2] ? res[2].node : null;
    const win = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
    try {
      stage = new PetStage(glCanvas, {
        dpr: win.pixelRatio || 2,
        drawerOpen: isDrawerOpen.value,
        onShadowUpdate: (s) => Object.assign(shadow, s),
        onSleepChange: (v) => { sleeping.value = v; },
        onReady: () => {
          loadingPet.value = false;
          syncPetMood(true);
        }
      });
      stage.setViewport(stageRect.width, stageRect.height);
      stage.setPet(currentPet.value, wornByPet[petId.value]);
    } catch (err) {
      console.error(err);
      loadingPet.value = false;
      uni.showToast({ title: "当前设备不支持 WebGL", icon: "none" });
    }
  });
  // #endif
}

function refreshStageRectH5() {
  // #ifdef H5
  const box = document.getElementById("stage-box");
  if (box) {
    const r = box.getBoundingClientRect();
    stageRect = { left: r.left, top: r.top, width: r.width, height: r.height };
    if (stage && r.width > 0 && r.height > 0) {
      stage.setViewport(r.width, r.height);
    }
  }
  // #endif
}

let lvTapCount = 0;
let lvTapResetTimer = null;

function applyDemoPreset(preset, notify = false) {
  const now = Date.now();
  if (preset === "dirty") {
    ["koi", "yutu"].forEach((id) => {
      careAll[id].hygiene = 18;
      careAll[id].hunger = 22;
      careAll[id].updatedAt = now;
    });
    saveCareAll(careAll);
    syncPetMood(true);
    if (notify) {
      haptic("medium");
      pushFloatToast("已模拟 8 小时后：变臭变饿啦");
    }
  } else if (preset === "hungry") {
    ["koi", "yutu"].forEach((id) => {
      careAll[id].hunger = 18;
      careAll[id].hygiene = 78;
      careAll[id].updatedAt = now;
    });
    saveCareAll(careAll);
    syncPetMood(true);
    if (notify) {
      haptic("medium");
      pushFloatToast("已模拟饿肚子状态");
    }
  }
}

function onTapLvBadge() {
  lvTapCount += 1;
  if (lvTapResetTimer) clearTimeout(lvTapResetTimer);
  lvTapResetTimer = setTimeout(() => {
    lvTapCount = 0;
  }, 2400);
  if (lvTapCount >= 5) {
    lvTapCount = 0;
    applyDemoPreset("dirty", true);
  }
}

onLoad((query) => {
  if (query && (query.demo === "dirty" || query.demo === "hungry")) {
    applyDemoPreset(query.demo, false);
  }
});

onMounted(() => {
  updateSafeArea();

  // #ifdef H5
  try {
    const sp = new URLSearchParams(window.location.search || "");
    let demo = sp.get("demo");
    if (!demo && window.location.hash && window.location.hash.indexOf("?") >= 0) {
      const hsp = new URLSearchParams(window.location.hash.split("?")[1]);
      demo = hsp.get("demo");
    }
    if (demo === "dirty" || demo === "hungry") {
      applyDemoPreset(demo, false);
    }
  } catch (e) {
    // ignore URL parsing errors
  }
  // #endif

  setTimeout(initStage, 50);

  fetchRemoteCatalog().then((remote) => {
    if (!remote) return;
    catalog.version = remote.version;
    catalog.backgrounds = remote.backgrounds;
    catalog.pets = remote.pets;
  });

  // 每分钟刷新一次衰减与情绪状态
  decayTimer = setInterval(() => {
    syncPetMood(false);
  }, 60000);

  // #ifdef H5
  window.addEventListener("resize", refreshStageRectH5);
  window.addEventListener("mousemove", onWindowMouseMove);
  window.addEventListener("mouseup", onWindowMouseUp);
  // #endif
});

onUnmounted(() => {
  if (stage) {
    stage.destroy();
    stage = null;
  }
  if (speechTimer) clearTimeout(speechTimer);
  if (decayTimer) clearInterval(decayTimer);
  // #ifdef H5
  window.removeEventListener("resize", refreshStageRectH5);
  window.removeEventListener("mousemove", onWindowMouseMove);
  window.removeEventListener("mouseup", onWindowMouseUp);
  // #endif
});

function onSwitchPet(nextPet) {
  if (!nextPet || nextPet === petId.value || !catalog.pets[nextPet]) return;
  if (uiMode.value === "bath") onCloseMode();
  petId.value = nextPet;
  loadingPet.value = true;
  sleeping.value = false;
  speechText.value = "";
  playPop();
  haptic("light");
  if (stage) {
    stage.setPet(catalog.pets[nextPet], wornByPet[nextPet]);
  }
}

function onSelectBg(bg) {
  if (!bg || bg.id === currentBgId.value) return;
  currentBgId.value = bg.id;
  playPop();
}

function onTapItem(item) {
  const pet = currentPet.value;
  const worn = wornByPet[pet.id];
  let triggerHop = false;
  if (pet.mode === "sets") {
    if (worn.set === item.id) {
      worn.set = null;
    } else {
      worn.set = item.id;
      triggerHop = true;
    }
  } else {
    if (worn[item.slot] === item.id) {
      worn[item.slot] = null;
    } else {
      worn[item.slot] = item.id;
      triggerHop = true;
    }
  }
  if (stage) {
    stage.setWorn(worn, triggerHop);
  }
  playPop();
  haptic("light");
}

/* ==================== 喂食逻辑（点击飞入 & 拖拽投喂） ==================== */
function consumeSnack(snack) {
  if (!snack || feedingLock) return;
  feedingLock = true;
  setTimeout(() => { feedingLock = false; }, 650);

  const res = feedPet(careAll, petId.value, snack);
  if (!res) return;
  if (stage) {
    stage.playEat();
    stage.setMood(getMood(careAll[petId.value]));
  }
  playMunch();
  haptic("medium");
  spawnParticles(["💖", "✨", snack.emoji], 50, 56, 6);

  if (res.deltaHunger > 0) {
    pushFloatToast(`+${res.deltaHunger} 饱食 · +${res.deltaExp} 亲密`);
  } else {
    pushFloatToast(`吃饱啦 · +${res.deltaExp} 亲密`);
  }
  if (res.leveledUp) {
    setTimeout(() => {
      playLevelUp();
      haptic("heavy");
      pushFloatToast(`✨ 升级 Lv.${res.level}!`, true);
      spawnParticles(["⭐", "🎉", "💛"], 50, 46, 8);
    }, 360);
  }
  showSpeech(res.speech, 3200);
}

function launchFlyingSnack(snack) {
  if (feedingLock) return;
  const anchor = stage ? stage.getPetAnchor() : { mouthY: 500 };
  const targetYPct = Math.round((anchor.mouthY / 844) * 100);
  flyingSnack.value = { emoji: snack.emoji, xPct: 50, yPct: 84 };
  playPop();
  setTimeout(() => {
    if (flyingSnack.value) {
      flyingSnack.value = { emoji: snack.emoji, xPct: 50, yPct: targetYPct };
    }
  }, 24);
  setTimeout(() => {
    flyingSnack.value = null;
    consumeSnack(snack);
  }, 340);
}

function startSnackDrag(clientX, clientY, snack) {
  refreshStageRectH5();
  dragSnack.active = true;
  dragSnack.snack = snack;
  dragSnack.startX = clientX;
  dragSnack.startY = clientY;
  dragSnack.x = clientX - stageRect.left;
  dragSnack.y = clientY - stageRect.top;
  dragSnack.moved = false;
  dragSnack.overPet = false;
}

function moveSnackDrag(clientX, clientY) {
  if (!dragSnack.active) return;
  if (Math.hypot(clientX - dragSnack.startX, clientY - dragSnack.startY) > 10) {
    dragSnack.moved = true;
  }
  dragSnack.x = clientX - stageRect.left;
  dragSnack.y = clientY - stageRect.top;
  const pt = toStageCoord(clientX, clientY);
  dragSnack.overPet = Boolean(stage && stage.isPointOnPet(pt.x, pt.y, 46));
}

function endSnackDrag(fallbackSnack) {
  if (!dragSnack.active) return;
  const sn = dragSnack.snack || fallbackSnack;
  const wasMoved = dragSnack.moved;
  const hitPet = dragSnack.overPet;
  dragSnack.active = false;
  dragSnack.snack = null;
  dragSnack.overPet = false;
  if (!wasMoved) {
    launchFlyingSnack(sn);
  } else if (hitPet) {
    consumeSnack(sn);
  }
}

function onSnackTouchStart(e, sn) {
  const t = e.touches && e.touches[0];
  if (t) startSnackDrag(t.clientX, t.clientY, sn);
}
function onSnackTouchMove(e) {
  const t = e.touches && e.touches[0];
  if (t) moveSnackDrag(t.clientX, t.clientY);
}
function onSnackTouchEnd(e, sn) {
  endSnackDrag(sn);
}
function onSnackTouchCancel() {
  dragSnack.active = false;
  dragSnack.snack = null;
}
function onSnackMouseDown(e, sn) {
  // #ifdef H5
  startSnackDrag(e.clientX, e.clientY, sn);
  // #endif
}
function onWindowMouseMove(e) {
  // #ifdef H5
  if (dragSnack.active) moveSnackDrag(e.clientX, e.clientY);
  // #endif
}
function onWindowMouseUp() {
  // #ifdef H5
  if (dragSnack.active) endSnackDrag(dragSnack.snack);
  // #endif
}

/* ==================== 洗澡搓泡泡逻辑 ==================== */
function handleBathScrub(clientX, clientY) {
  if (uiMode.value !== "bath" || rinsing.value) return;
  const pt = toStageCoord(clientX, clientY);
  if (!stage || !stage.isPointOnPet(pt.x, pt.y, 38)) return;

  stage.startScrub(pt.x);
  const dist = lastScrubPt ? Math.hypot(pt.x - lastScrubPt.x, pt.y - lastScrubPt.y) : 14;
  lastScrubPt = pt;
  if (dist < 4) return;

  const xPct = clampPct(((clientX - stageRect.left) / (stageRect.width || 390)) * 100);
  const yPct = clampPct(((clientY - stageRect.top) / (stageRect.height || 844)) * 100);

  const now = Date.now();
  if (now - lastBubbleAt >= 68) {
    lastBubbleAt = now;
    const id = fxUid++;
    const size = 22 + Math.round(Math.random() * 24);
    bubbles.value.push({
      id,
      xPct: xPct + (Math.random() - 0.5) * 8,
      yPct: yPct + (Math.random() - 0.5) * 6,
      size,
      popping: false
    });
    if (bubbles.value.length > 26) {
      bubbles.value.shift();
    }
    playBubble(bathProgress.value);
    haptic("light");
  }

  bathProgress.value = Math.min(100, bathProgress.value + Math.min(7.5, dist * 0.16));
  if (bathProgress.value >= 100) {
    triggerBathFinish();
  }
}

function triggerBathFinish() {
  if (rinsing.value) return;
  rinsing.value = true;
  lastScrubPt = null;
  bubbles.value = bubbles.value.map((b) => ({ ...b, popping: true }));

  playSplash();
  haptic("heavy");
  if (stage) stage.playRinse();
  spawnParticles(["✨", "💧", "🫧", "⭐"], 50, 56, 10);

  setTimeout(() => {
    bubbles.value = [];
    const res = finishBath(careAll, petId.value);
    if (stage) stage.setMood(getMood(careAll[petId.value]));
    playHappy();
    if (res) {
      pushFloatToast(res.deltaHygiene > 0 ? `+${res.deltaHygiene} 清洁 · +${res.deltaExp} 亲密` : `香喷喷 · +${res.deltaExp} 亲密`);
      showSpeech(res.speech, 3600);
      if (res.leveledUp) {
        setTimeout(() => {
          playLevelUp();
          haptic("heavy");
          pushFloatToast(`✨ 升级 Lv.${res.level}!`, true);
          spawnParticles(["⭐", "🎉", "💛"], 50, 46, 8);
        }, 380);
      }
    }
    setTimeout(() => {
      rinsing.value = false;
      bathProgress.value = 0;
      uiMode.value = "home";
    }, 680);
  }, 420);
}

function clampPct(v) {
  return Math.max(8, Math.min(92, v));
}

/* ==================== 舞台触摸/摸头/跳跃 ==================== */
function toStageCoord(clientX, clientY) {
  refreshStageRectH5();
  const r = stageRect;
  const w = r.width || 390;
  const h = r.height || 844;
  const viewW = 844 * (w / h);
  return {
    x: 195 + ((clientX - r.left) / w - 0.5) * viewW,
    y: ((clientY - r.top) / h) * 844
  };
}

function startPointer(clientX, clientY) {
  if (uiMode.value === "bath") {
    touchState.active = true;
    lastScrubPt = null;
    handleBathScrub(clientX, clientY);
    return;
  }
  const pt = toStageCoord(clientX, clientY);
  touchState.active = true;
  touchState.startX = pt.x;
  touchState.startY = pt.y;
  touchState.moved = false;
  touchState.startTime = Date.now();
}

function movePointer(clientX, clientY) {
  if (!touchState.active) return;
  if (uiMode.value === "bath") {
    handleBathScrub(clientX, clientY);
    return;
  }
  const pt = toStageCoord(clientX, clientY);
  if (Math.hypot(pt.x - touchState.startX, pt.y - touchState.startY) > 8) {
    touchState.moved = true;
    if (stage) stage.onPetMove(pt.x);
  }
}

function endPointer() {
  if (!touchState.active) return;
  touchState.active = false;
  if (uiMode.value === "bath") {
    lastScrubPt = null;
    if (!rinsing.value && stage) stage.stopScrub();
    return;
  }
  if (touchState.moved) {
    if (stage) stage.onPetEnd();
    const res = interactPet(careAll, petId.value);
    if (res) {
      if (res.deltaExp > 0) {
        playHappy();
        haptic("light");
        pushFloatToast(`+${res.deltaExp} 亲密`);
        spawnParticles(["💖", "✨"], 50, 52, 4);
      }
      if (res.leveledUp) {
        playLevelUp();
        pushFloatToast(`✨ 升级 Lv.${res.level}!`, true);
      }
      showSpeech(res.speech, 2800);
    }
  } else if (Date.now() - touchState.startTime < 450) {
    if (stage) stage.onTap(touchState.startX, touchState.startY);
    playPop();
    haptic("light");
  }
}

function onStageTouchStart(e) {
  const t = e.touches && e.touches[0];
  if (t) startPointer(t.clientX, t.clientY);
}
function onStageTouchMove(e) {
  const t = e.touches && e.touches[0];
  if (t) movePointer(t.clientX, t.clientY);
}
function onStageTouchEnd() {
  endPointer();
}
function onMouseDown(e) {
  // #ifdef H5
  startPointer(e.clientX, e.clientY);
  // #endif
}
function onMouseMove(e) {
  // #ifdef H5
  movePointer(e.clientX, e.clientY);
  // #endif
}
function onMouseUp() {
  // #ifdef H5
  endPointer();
  // #endif
}

async function onSaveWallpaper() {
  if (exporting.value) return;
  exporting.value = true;
  uni.showLoading({ title: "生成高清壁纸...", mask: true });
  try {
    await exportWallpaper({
      canvas: exportCanvas,
      bg: currentBg.value,
      pet: currentPet.value,
      worn: wornByPet[petId.value]
    });
    uni.hideLoading();
    uni.showToast({ title: "壁纸已保存", icon: "success" });
  } catch (err) {
    uni.hideLoading();
    console.error("[exportWallpaper]", err);
    const msg = (err && err.errMsg) || "";
    if (msg.indexOf("auth deny") >= 0 || msg.indexOf("authorize") >= 0) {
      uni.showModal({
        title: "需要相册权限",
        content: "请在设置中允许保存到相册，即可一键保存高清萌宠壁纸。",
        confirmText: "去设置",
        success: (r) => {
          if (r.confirm && uni.openSetting) uni.openSetting();
        }
      });
    } else {
      uni.showToast({ title: "保存失败，请重试", icon: "none" });
    }
  } finally {
    exporting.value = false;
  }
}

onShareAppMessage(() => ({
  title: `我的Lv.${petCare.value.level} ${currentPet.value.label}蛋宝宝等你来喂零食、搓泡泡！`,
  path: "/pages/index/index",
  imageUrl: currentBg.value.url
}));

onShareTimeline(() => ({
  title: `蛋宝宝陪伴屋 · Lv.${petCare.value.level} ${currentPet.value.label}`,
  imageUrl: currentBg.value.url
}));
</script>

<style scoped>
.viewport {
  width: 100vw;
  height: 100vh;
  background: #1e1a16;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.page {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

@media (min-width: 520px) {
  .page {
    width: min(100vw, calc(100vh * 390 / 844));
    height: min(100vh, calc(100vw * 844 / 390));
    border-radius: 22px;
    box-shadow: 0 22px 64px rgba(0, 0, 0, 0.55);
  }
}

.stage-bg {
  position: absolute;
  left: 0;
  top: 0%;
  width: 100%;
  height: 100%;
  z-index: 0;
  transition: top 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.page.drawer-open .stage-bg {
  top: -29.03%;
}

/* 顶部栏与状态 HUD */
.top-bar {
  position: relative;
  z-index: 20;
  padding-left: 12px;
  padding-right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.top-row,
.care-hud,
.bath-hud {
  pointer-events: auto;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pet-switch {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(30, 24, 18, 0.44);
  padding: 3px;
  border-radius: 999px;
  backdrop-filter: blur(8px);
}

.pet-pill {
  margin: 0;
  padding: 5px 14px;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 248, 238, 0.88);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
}

.pet-pill.active {
  background: #fbf4ea;
  color: #5a4636;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16);
}

.action-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  margin: 0;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 50%;
  background: rgba(30, 24, 18, 0.44);
  color: #fff6ea;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
}

.act-btn {
  margin: 0;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(251, 244, 234, 0.92);
  color: #5a4636;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.25;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
}

.act-btn.share-btn {
  background: #c9955a;
  color: #ffffff;
}

.care-hud {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.lv-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(30, 24, 18, 0.48);
  border: 1px solid rgba(255, 230, 175, 0.28);
  backdrop-filter: blur(8px);
}

.lv-text {
  font-size: 11px;
  font-weight: 800;
  color: #ffd97d;
}

.exp-track {
  width: 34px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  overflow: hidden;
}

.exp-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #ffcf5c, #ff9f43);
  transition: width 0.3s ease;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(30, 24, 18, 0.46);
  border: 1px solid rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(8px);
  cursor: pointer;
}

.stat-pill.low {
  border-color: rgba(255, 118, 117, 0.85);
  background: rgba(96, 26, 26, 0.56);
  animation: pulseWarn 1.5s ease-in-out infinite;
}

@keyframes pulseWarn {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

.stat-ico {
  font-size: 11px;
  line-height: 1;
}

.stat-track {
  width: 42px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  overflow: hidden;
}

.stat-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.32s ease;
}

.stat-fill.hunger {
  background: linear-gradient(90deg, #ff9f68, #ff6b6b);
}

.stat-fill.hygiene {
  background: linear-gradient(90deg, #68d8ff, #45aaf2);
}

.stat-num {
  font-size: 10.5px;
  font-weight: 700;
  color: #fff6ea;
  min-width: 18px;
  text-align: right;
}

/* 洗澡搓澡进度 HUD（底部悬浮） */
.bath-hud {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: calc(18px + env(safe-area-inset-bottom));
  z-index: 18;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 20px;
  background: rgba(24, 48, 72, 0.78);
  border: 1px solid rgba(160, 228, 255, 0.42);
  box-shadow: 0 10px 26px rgba(16, 36, 56, 0.28);
  backdrop-filter: blur(12px);
  animation: trayRise 0.24s ease-out;
}

.bath-hud-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.bath-title {
  font-size: 12px;
  font-weight: 600;
  color: #eef9ff;
}

.bath-track {
  width: 100%;
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  overflow: hidden;
}

.bath-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #74e3ff, #b8f2ff);
  transition: width 0.12s linear;
}

.bath-exit {
  margin: 0;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
}

/* 舞台层 */
.stage-box {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
  user-select: none;
  touch-action: none;
}

.pet-gl {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  display: block;
}

.shadow-soft {
  position: absolute;
  left: 53%;
  top: 77.2%;
  width: 172px;
  height: 46px;
  border-radius: 50%;
  filter: blur(7px);
  mix-blend-mode: multiply;
  z-index: 1;
  pointer-events: none;
  transition: top 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.shadow-contact {
  position: absolute;
  left: 50.8%;
  top: 77.9%;
  width: 122px;
  height: 17px;
  border-radius: 50%;
  filter: blur(2px);
  mix-blend-mode: multiply;
  z-index: 1;
  pointer-events: none;
  transition: top 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.page.drawer-open .shadow-soft {
  top: 48.2%;
}

.page.drawer-open .shadow-contact {
  top: 48.9%;
}

/* 脏污小苍蝇与灰尘提醒 */
.dirty-layer {
  position: absolute;
  left: 50%;
  top: 56%;
  width: 240px;
  height: 220px;
  transform: translate(-50%, -50%);
  z-index: 7;
  pointer-events: none;
  transition: top 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.dirty-layer.lifted {
  top: 29%;
}

.stink-wisp {
  position: absolute;
  width: 14px;
  height: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 4px rgba(132, 192, 48, 0.55));
  animation: stinkRise 2.4s ease-in-out infinite;
}

.stink-seg {
  width: 11px;
  height: 17px;
  border-radius: 50%;
  border: 2.5px solid transparent;
}

.stink-top {
  border-left-color: rgba(158, 212, 70, 0.88);
  transform: translateX(2px) rotate(12deg);
}

.stink-bot {
  border-right-color: rgba(158, 212, 70, 0.88);
  margin-top: -4px;
  transform: translateX(-2px) rotate(12deg);
}

.stink-1 { left: 26%; top: 18%; animation-delay: 0s; }
.stink-2 { left: 48%; top: 6%; animation-delay: 0.75s; }
.stink-3 { left: 68%; top: 20%; animation-delay: 1.45s; }

@keyframes stinkRise {
  0%   { opacity: 0; transform: translateY(14px) translateX(0) scale(0.82); }
  28%  { opacity: 0.92; transform: translateY(0px) translateX(4px) scale(1); }
  65%  { opacity: 0.78; transform: translateY(-14px) translateX(-4px) scale(1.04); }
  100% { opacity: 0; transform: translateY(-28px) translateX(2px) scale(0.92); }
}

.fly {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fly-body {
  width: 8px;
  height: 6px;
  border-radius: 50%;
  background: #2c2826;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.fly-wing {
  width: 7px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(60, 60, 60, 0.25);
  animation: wingBuzz 0.14s linear infinite alternate;
}

.wing-l { transform: rotate(-28deg); margin-right: -2px; }
.wing-r { transform: rotate(28deg); margin-left: -2px; }

@keyframes wingBuzz {
  from { transform: translateY(-2px) scaleY(0.65); }
  to { transform: translateY(1px) scaleY(1.1); }
}

.fly-a {
  left: 22%;
  top: 24%;
  animation: flyOrbitA 3.4s ease-in-out infinite;
}

.fly-b {
  left: 72%;
  top: 46%;
  animation: flyOrbitB 2.9s ease-in-out infinite;
}

@keyframes flyOrbitA {
  0%   { transform: translate(0, 0) rotate(0deg); }
  25%  { transform: translate(42px, -22px) rotate(10deg); }
  50%  { transform: translate(18px, 16px) rotate(-12deg); }
  75%  { transform: translate(-24px, -10px) rotate(8deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}

@keyframes flyOrbitB {
  0%   { transform: translate(0, 0); }
  30%  { transform: translate(-36px, -18px); }
  65%  { transform: translate(-10px, 24px); }
  100% { transform: translate(0, 0); }
}

.dust {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(138, 120, 98, 0.55);
  filter: blur(0.6px);
  animation: dustDrift 2.6s ease-in-out infinite;
}

.dust-1 { left: 26%; top: 68%; animation-delay: 0s; }
.dust-2 { left: 74%; top: 32%; width: 5px; height: 5px; animation-delay: 0.7s; }
.dust-3 { left: 66%; top: 74%; width: 7px; height: 7px; animation-delay: 1.3s; }

@keyframes dustDrift {
  0%, 100% { opacity: 0.25; transform: translateY(0); }
  50% { opacity: 0.75; transform: translateY(-10px); }
}

/* 泡泡、粒子与冲水闪光层 */
.fx-layer {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  overflow: hidden;
}

.soap-bubble {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle at 30% 28%, rgba(255, 255, 255, 0.94) 0%, rgba(210, 244, 255, 0.62) 48%, rgba(255, 210, 245, 0.42) 82%, rgba(255, 255, 255, 0.85) 100%);
  border: 1.5px solid rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 -3px 6px rgba(135, 212, 255, 0.35), 0 2px 8px rgba(120, 200, 255, 0.25);
  animation: bubbleWobble 1.6s ease-in-out infinite;
  transition: transform 0.36s ease, opacity 0.36s ease;
}

.soap-bubble.popping {
  transform: translate(-50%, -95%) scale(1.45);
  opacity: 0;
}

@keyframes bubbleWobble {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -54%) scale(1.07); }
}

.rinse-flash {
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(180, 238, 255, 0.38) 0%, rgba(255, 255, 255, 0.12) 65%, rgba(180, 238, 255, 0) 100%);
  animation: rinseSweep 0.65s ease-out forwards;
}

@keyframes rinseSweep {
  0% { opacity: 0; transform: translateY(-20%); }
  35% { opacity: 1; transform: translateY(0%); }
  100% { opacity: 0; transform: translateY(15%); }
}

.fx-particle {
  position: absolute;
  font-size: 20px;
  transform: translate(-50%, -50%);
  animation: particleUp 0.92s ease-out forwards;
}

@keyframes particleUp {
  0% { opacity: 0; transform: translate(-50%, -30%) scale(0.5); }
  25% { opacity: 1; transform: translate(-50%, -65%) scale(1.12); }
  100% { opacity: 0; transform: translate(-50%, -170%) scale(0.85); }
}

.flying-snack {
  position: absolute;
  z-index: 12;
  font-size: 36px;
  transform: translate(-50%, -50%);
  transition: left 0.32s cubic-bezier(0.22, 1, 0.36, 1), top 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

/* 对话气泡与飘字 */
.speech-bubble {
  position: absolute;
  left: 50%;
  top: 34%;
  transform: translateX(-50%);
  max-width: 72%;
  z-index: 11;
  padding: 8px 14px;
  border-radius: 18px;
  background: rgba(255, 252, 246, 0.95);
  color: #5a4636;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
  box-shadow: 0 6px 18px rgba(60, 40, 20, 0.16);
  pointer-events: none;
  animation: bubblePop 0.24s ease-out;
  transition: top 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.speech-bubble.lifted {
  top: 15%;
}

@keyframes bubblePop {
  from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.92); }
  to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

.toast-layer {
  position: absolute;
  left: 50%;
  top: 44%;
  transform: translateX(-50%);
  z-index: 12;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
}

.toast-layer.lifted {
  top: 22%;
}

.float-toast {
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(42, 32, 24, 0.72);
  color: #fff8ee;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  animation: toastRise 1.2s ease-out forwards;
}

.float-toast.gold {
  background: linear-gradient(90deg, #f6b93b, #e58e26);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(229, 142, 38, 0.4);
}

@keyframes toastRise {
  0% { opacity: 0; transform: translateY(10px) scale(0.9); }
  20% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-34px) scale(1); }
}

.sleep-zz {
  position: absolute;
  left: 65%;
  top: 46%;
  z-index: 6;
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 250, 240, 0.92);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  animation: zzFloat 2.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes zzFloat {
  0% { opacity: 0; transform: translateY(6px) scale(0.85); }
  45% { opacity: 1; transform: translateY(-5px) scale(1); }
  100% { opacity: 0; transform: translateY(-16px) scale(1.1); }
}

.stage-loading {
  position: absolute;
  left: 50%;
  top: 52%;
  transform: translate(-50%, -50%);
  z-index: 8;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(30, 24, 18, 0.56);
  color: #fff6ea;
  font-size: 12px;
}

/* 右侧悬浮陪伴胶囊（喂食 / 洗澡 / 装扮） */
.care-dock {
  position: absolute;
  right: 12px;
  top: 54%;
  transform: translateY(-50%);
  z-index: 16;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 5px;
  border-radius: 999px;
  background: rgba(255, 250, 242, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 0 8px 24px rgba(48, 30, 14, 0.18);
  backdrop-filter: blur(12px);
}

.dock-btn {
  position: relative;
  width: 46px;
  padding: 8px 0;
  border-radius: 999px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.dock-btn.active {
  background: #c9955a;
}

.dock-ico {
  font-size: 20px;
  line-height: 1.1;
}

.dock-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #5a4636;
}

.dock-btn.active .dock-label {
  color: #ffffff;
}

.dock-divider {
  width: 24px;
  height: 1px;
  background: rgba(120, 90, 60, 0.16);
  margin: 2px 0;
}

.dock-dot {
  position: absolute;
  top: 5px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff5252;
  border: 1.5px solid #ffffff;
}

/* 喂食托盘 */
.feed-tray {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 18;
  background: rgba(251, 244, 234, 0.96);
  border-radius: 22px;
  padding: 10px 12px 12px;
  box-shadow: 0 10px 28px rgba(48, 30, 14, 0.24);
  backdrop-filter: blur(10px);
  animation: trayRise 0.24s ease-out;
}

@keyframes trayRise {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.tray-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.tray-title {
  font-size: 12px;
  font-weight: 700;
  color: #6b523d;
}

.tray-close {
  margin: 0;
  padding: 3px 10px;
  border-radius: 999px;
  background: #ead9c5;
  color: #5a4636;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
}

.snack-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.snack-card {
  background: #fffdf9;
  border-radius: 16px;
  border: 1.5px solid #ecdcc8;
  padding: 9px 6px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: grab;
  user-select: none;
  box-shadow: 0 2px 6px rgba(80, 50, 20, 0.08);
}

.snack-emoji {
  font-size: 28px;
  line-height: 1.1;
}

.snack-name {
  font-size: 12px;
  font-weight: 700;
  color: #4f3d2e;
}

.snack-meta {
  font-size: 10px;
  font-weight: 600;
  color: #b78043;
}

.drag-ghost {
  position: absolute;
  z-index: 30;
  transform: translate(-50%, -50%) scale(1.15);
  pointer-events: none;
  transition: transform 0.12s ease;
}

.drag-ghost.over-pet {
  transform: translate(-50%, -50%) scale(1.42);
  filter: drop-shadow(0 0 12px rgba(255, 200, 100, 0.85));
}

.drag-ghost-emoji {
  font-size: 40px;
}

/* 底部衣橱抽屉（滑出式） */
.sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 48.58%;
  min-height: 270px;
  z-index: 22;
  background: rgba(251, 244, 234, 0.98);
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -8px 24px rgba(60, 38, 18, 0.22);
  padding: 8px 12px calc(10px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  transform: translateY(106%);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease;
}

.sheet.open {
  transform: translateY(0%);
  opacity: 1;
  pointer-events: auto;
}

.sheet-top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 0 8px;
  flex-shrink: 0;
  cursor: pointer;
}

.sheet-handle {
  width: 38px;
  height: 4px;
  border-radius: 999px;
  background: #e2d0bc;
}

.sheet-done {
  position: absolute;
  right: 4px;
  top: 0;
  font-size: 12px;
  font-weight: 700;
  color: #a67642;
}

.sheet-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.sheet-tab {
  flex: 1;
  margin: 0;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1.5px solid #e6d5c1;
  background: #fffdf9;
  color: #7a634d;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sheet-tab::after {
  border: none;
}

.sheet-tab.active {
  background: #c9955a;
  border-color: #c9955a;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(201, 149, 90, 0.24);
}

.empty-sets {
  padding: 28px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
}

.empty-title {
  font-size: 14px;
  font-weight: 700;
  color: #5a4636;
}

.empty-sub {
  font-size: 12px;
  color: #937b63;
}

.empty-btn {
  margin-top: 6px;
  padding: 7px 18px;
  border-radius: 999px;
  background: #c9955a;
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.2;
}

.empty-btn::after {
  border: none;
}

.grid-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px 7px;
  padding: 2px 1px 14px;
}

.card {
  position: relative;
  background: #fffdf9;
  border-radius: 13px;
  border: 2px solid transparent;
  box-shadow: 0 1px 4px rgba(80, 50, 20, 0.08);
  padding: 6px 4px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.card.selected {
  border-color: #c9955a;
  box-shadow: 0 2px 7px rgba(201, 149, 90, 0.25);
}

.thumb-wrap {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 9px;
}

.card-img {
  width: 100%;
  height: 100%;
}

.bg-card .bg-img {
  object-fit: cover;
  object-position: center 68%;
}

.card-name {
  margin-top: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #4f3d2e;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #c9955a;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.export-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
  width: 780px;
  height: 1688px;
  pointer-events: none;
}
</style>
