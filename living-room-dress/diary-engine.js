/* ==========================================================================
   EggBabe P3 陪伴手帐引擎 (diary-engine.js)
   - 基于 dailyEventLog[dateKey][petId] 实装 32 组四类冷幽默参数化微片段引擎
   - 严守反废话护栏：正文 60~105 字（校验 50~125 字）、P.S. ≤20 字、原子违禁词拦截
   - 预留标准 diaryAdapter 接口（默认纯静态 local 引擎，远期可挂载阿里云 ECS DeepSeek 代理）
   - 严格贯彻「缺席不补发、零愧疚催促」与仅存 ~300B 配方元数据（零 Base64）
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeDiaryEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function () {
  "use strict";

  const BANNED_FLUFF_REGEX = /(主人|元气满满|新的一天|温暖|治愈|岁月|最长情|多喝热水|加油|充满希望|感恩|开心的一天|！{2,}|!{2,})/;

  const ARCHETYPES = Object.freeze([
    "REDEFINE_FAILURE",
    "KNOWINGLY_PERSIST",
    "POSITIONAL_IRONY",
    "DISPROPORTIONATE_NUMBERS"
  ]);

  const ARCHETYPE_LABELS = Object.freeze({
    REDEFINE_FAILURE: "重新定义失败",
    KNOWINGLY_PERSIST: "明知故犯",
    POSITIONAL_IRONY: "位置的反讽",
    DISPROPORTIONATE_NUMBERS: "数量的错位"
  });

  const SNACK_LABELS = Object.freeze({
    fish: "香酥小鱼干",
    crispy_fish: "香酥小鱼干",
    cake: "桂花蜜糕",
    osmanthus_cake: "桂花蜜糕",
    berry: "草莓大福",
    carrot: "脆甜胡萝卜",
    osmanthus_pancake: "桂花蜜松饼",
    crispy_taiyaki: "香酥鲷鱼烧"
  });

  const MINIGAME_LABELS = Object.freeze({
    doodle_prop: "一起画",
    listen_qa: "听你说",
    bakery_tap: "暖炉烘焙拍",
    treasure_memory: "寻宝翻翻乐",
    meadow_breeze: "小院牧歌"
  });

  // 缺席回归时的零愧疚「等门小涂鸦」（严禁任何指责/卖惨文案）
  const WELCOME_BACK_NOTES = Object.freeze([
    "前几天桌上的光斑自己走了好几趟，今天你一来，它刚好停在软木垫正中间。",
    "杯垫上的木纹这几天都没动过，只有窗边的风把纸角吹翻了一页。",
    "小台灯的灯罩上落了一小粒灰，刚才你推门的风顺手把它吹跑了。",
    "床头黑猫警长替你看了好几天桌角，今天一听见脚步声，胡须先翘起来了。"
  ]);

  function stableHash(str) {
    let h = 2166136261;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function resolveOutfitName(catalog, petId, outfitId) {
    const items = catalog && catalog.pets && catalog.pets[petId] && catalog.pets[petId].items;
    if (Array.isArray(items) && outfitId) {
      const hit = items.find((it) => it && it.id === outfitId);
      if (hit && hit.name) return hit.name;
    }
    return petId === "yutu" ? "柔绒针织帽" : "小黄鸭雨衣";
  }

  function resolveKeepsakeName(catalog, keepsakeId) {
    const list = catalog && Array.isArray(catalog.keepsakes) ? catalog.keepsakes : [];
    if (keepsakeId) {
      const hit = list.find((k) => k && k.id === keepsakeId);
      if (hit && hit.name) return hit.name;
    }
    return "短铅笔";
  }

  function resolveSnackName(snackId, petId) {
    if (snackId && SNACK_LABELS[snackId]) return SNACK_LABELS[snackId];
    return petId === "yutu" ? "桂花蜜糕" : "香酥小鱼干";
  }

  function resolveMiniGameName(gameId) {
    if (gameId && MINIGAME_LABELS[gameId]) return MINIGAME_LABELS[gameId];
    return "桌边小游戏";
  }

  function hasRealInteraction(petLog) {
    if (!petLog || typeof petLog !== "object") return false;
    return (
      (Array.isArray(petLog.snacksFed) && petLog.snacksFed.length > 0) ||
      petLog.bathed === true ||
      Number(petLog.focusMinutes || 0) > 0 ||
      (Array.isArray(petLog.miniGamesPlayed) && petLog.miniGamesPlayed.length > 0) ||
      (Array.isArray(petLog.keepsakesFound) && petLog.keepsakesFound.length > 0) ||
      (Array.isArray(petLog.outfitsWorn) && petLog.outfitsWorn.length > 0) ||
      (Array.isArray(petLog.visitedStates) && petLog.visitedStates.length > 0)
    );
  }

  function scorePetInteraction(petLog) {
    if (!petLog || typeof petLog !== "object") return 0;
    let score = 0;
    if (Array.isArray(petLog.snacksFed)) score += petLog.snacksFed.length * 3;
    if (petLog.bathed) score += 3;
    if (Number(petLog.focusMinutes || 0) > 0) score += 4;
    if (Array.isArray(petLog.miniGamesPlayed)) score += petLog.miniGamesPlayed.length * 3;
    if (Array.isArray(petLog.keepsakesFound)) score += petLog.keepsakesFound.length * 4;
    if (Array.isArray(petLog.outfitsWorn)) score += petLog.outfitsWorn.length * 2;
    if (Array.isArray(petLog.visitedStates)) score += petLog.visitedStates.length;
    return score;
  }

  /**
   * 32 组四类冷幽默参数化微片段模板（每类 8 组，共 32 组）
   * 所有正文均经字数与反废话校验：60~105 字，P.S. ≤20 字，紧扣当日真实互动事实。
   */
  const DIARY_TEMPLATES = [
    /* ========== 一、REDEFINE_FAILURE（重新定义失败，8 组） ========== */
    {
      id: "rf_01",
      archetype: "REDEFINE_FAILURE",
      pet: "yutu",
      requires: ["snack"],
      build(f) {
        return {
          title: "杯垫下的碎渣",
          body: `今天穿着「${f.outfit}」吃${f.snack}，第一口就把一小角掉在了软木垫缝里。我拿短爪扒拉了两下没捞出来，干脆把杯垫挪正盖住它。这样不算掉渣，算替明天提前存了一口点心。`,
          ps: "明天记得把杯垫轻轻掀开。"
        };
      }
    },
    {
      id: "rf_02",
      archetype: "REDEFINE_FAILURE",
      pet: "koi",
      requires: ["snack"],
      build(f) {
        return {
          title: "没接住的点心",
          body: `你递来${f.snack}的时候，我穿着「${f.outfit}」往前挪了半步，结果慢了半拍让它滚到了桌边。我趴在旁边盯了三秒，决定宣布这是我故意让它散散热气，凉一点咬起来更脆。`,
          ps: "其实刚才嘴角已经沾到碎屑了。"
        };
      }
    },
    {
      id: "rf_03",
      archetype: "REDEFINE_FAILURE",
      pet: "any",
      requires: ["focus"],
      build(f) {
        return {
          title: "发条没停稳",
          body: `床头黑猫警长咔哒咔哒走了${f.focusMin}分钟，我本来打算一动不动陪你盯梢，中途还是偷偷眨了七次眼。不过我最后坐姿依然端正，按桌角规矩，只要没打瞌睡就全算满勤。`,
          ps: "尾巴尖刚才只轻轻晃了一下。"
        };
      }
    },
    {
      id: "rf_04",
      archetype: "REDEFINE_FAILURE",
      pet: "any",
      requires: ["bathed"],
      build(f) {
        return {
          title: "泡泡没吹圆",
          body: `今天搓泡泡澡时，我对着水盆吹了三个大泡泡，结果刚离水面就啪地破在鼻尖上。换上「${f.outfit}」后我想明白了，破得快说明水汽够轻，这叫把香皂味提前铺满了整个桌面。`,
          ps: "毛尖现在还留着一点点柚子味。"
        };
      }
    },
    {
      id: "rf_05",
      archetype: "REDEFINE_FAILURE",
      pet: "any",
      requires: ["minigame"],
      build(f) {
        return {
          title: "歪掉的一笔",
          body: `今天陪你玩「${f.miniGame}」的时候，我穿着「${f.outfit}」在旁边跟着比划，结果动作慢了一拍没跟上节奏。我把爪子揣回袖口，决定那不叫慢半拍，叫替你把收尾拖得更稳当。`,
          ps: "下次我提前半秒把爪子伸出来。"
        };
      }
    },
    {
      id: "rf_06",
      archetype: "REDEFINE_FAILURE",
      pet: "yutu",
      requires: [],
      build(f) {
        return {
          title: "没叠齐的被角",
          body: `今天穿着「${f.outfit}」去床边理了理云朵被角，推平左边的时候右边又翘起来一小块。我站在床垫边缘端详了一会儿，决定留着那个小尖角——刚好给晚上的月光搭个落脚梯。`,
          ps: "长耳朵碰到了台灯罩，轻响了一声。"
        };
      }
    },
    {
      id: "rf_07",
      archetype: "REDEFINE_FAILURE",
      pet: "koi",
      requires: [],
      build(f) {
        return {
          title: "转歪的小圈",
          body: `今天换上「${f.outfit}」后，我想在软木垫正中间原地转个圈照照小立镜，结果脚底一滑停偏了两指宽。我顺势面向窗外站定，假装本来就是为了看那块慢慢移动的木纹光斑。`,
          ps: "镜子里看不出来我刚才滑了一下。"
        };
      }
    },
    {
      id: "rf_08",
      archetype: "REDEFINE_FAILURE",
      pet: "any",
      requires: ["keepsake"],
      build(f) {
        return {
          title: "摆斜的藏品",
          body: `今天把新捡到的「${f.keepsake}」放进木格时，我怎么摆都觉得它往左歪了一点点。后来退后两步再看，发现斜着放正好能避开格顶的阴影，这不算手抖，算给它找了束顺光。`,
          ps: "明天路过书架再悄悄扶它一下。"
        };
      }
    },

    /* ========== 二、KNOWINGLY_PERSIST（明知故犯，8 组） ========== */
    {
      id: "kp_01",
      archetype: "KNOWINGLY_PERSIST",
      pet: "yutu",
      requires: ["snack"],
      build(f) {
        return {
          title: "偏要留一口",
          body: `明明知道${f.snack}放久了边角会变硬，今天穿着「${f.outfit}」吃的时候，我还是故意把最后半小口留在碟子边缘。等夜里台灯暗下来再去咬，咔嚓一声听起来比下午更像秘密。`,
          ps: "盘子我已经舔得很干净，除了那一口。"
        };
      }
    },
    {
      id: "kp_02",
      archetype: "KNOWINGLY_PERSIST",
      pet: "koi",
      requires: ["snack"],
      build(f) {
        return {
          title: "带帽吃点心",
          body: `我知道穿着「${f.outfit}」低头吃${f.snack}时，帽檐总会滑下来挡住一半视线。可我没把帽子推上去，闭着眼睛靠香味摸到下一口，总觉得这样吃起来比睁眼多赚了一倍惊喜。`,
          ps: "胡须上大概沾了一点点酥皮。"
        };
      }
    },
    {
      id: "kp_03",
      archetype: "KNOWINGLY_PERSIST",
      pet: "any",
      requires: ["focus"],
      build(f) {
        return {
          title: "偷听发条声",
          body: `你拧开床头黑猫警长专注了${f.focusMin}分钟，我明知道凑太近听表盘里的齿轮声会让自己发呆，还是把脸贴在木框边听了半程。咔哒声像有人在极远处轻轻敲木鱼，听着就不舍得挪开。`,
          ps: "表盘玻璃被我哈出了一小团雾。"
        };
      }
    },
    {
      id: "kp_04",
      archetype: "KNOWINGLY_PERSIST",
      pet: "any",
      requires: ["bathed"],
      build(f) {
        return {
          title: "绕开小木镜",
          body: `刚洗完香香的泡泡澡，毛还蓬得像一团刚出炉的面包，我明知道这时候去照桌面小立镜会显得头大一圈，偏偏还是凑过去照了三回。蓬松一点没坏处，至少靠在枕头上更软和。`,
          ps: "耳朵尖还有一点点没吹透的水汽。"
        };
      }
    },
    {
      id: "kp_05",
      archetype: "KNOWINGLY_PERSIST",
      pet: "any",
      requires: ["minigame"],
      build(f) {
        return {
          title: "偏爱慢节奏",
          body: `玩「${f.miniGame}」的时候，我明明知道手快一点分数会更高，可每次看见好看的图案还是忍不住多停半秒看两眼。穿着「${f.outfit}」慢慢玩挺好的，急着收场反而亏了。`,
          ps: "刚才那一局其实我偷偷笑了。"
        };
      }
    },
    {
      id: "kp_06",
      archetype: "KNOWINGLY_PERSIST",
      pet: "yutu",
      requires: [],
      build(f) {
        return {
          title: "不肯换下来",
          body: `今天这身「${f.outfit}」袖口稍微有点长，每次碰桌面上的铅笔都会顺手扫倒它。我知道换件利落点的就不会这样，但毛绒绒的边角蹭在手背上太舒服了，决定继续让铅笔躺着吧。`,
          ps: "铅笔横着放其实不容易滚下桌。"
        };
      }
    },
    {
      id: "kp_07",
      archetype: "KNOWINGLY_PERSIST",
      pet: "koi",
      requires: [],
      build(f) {
        return {
          title: "就站光斑边",
          body: `窗外移过来的阳光明明只够照亮半只脚尖，穿着「${f.outfit}」往左迈两步就能全晒到。可我偏偏站在软木垫原位没动，想看看是太阳先走过来找我，还是我先熬不住挪脚。`,
          ps: "结果太阳走歪了，我还是没挪。"
        };
      }
    },
    {
      id: "kp_08",
      archetype: "KNOWINGLY_PERSIST",
      pet: "any",
      requires: ["keepsake"],
      build(f) {
        return {
          title: "藏在最前排",
          body: `书架中层明明已经摆得挺满了，今天拿到「${f.keepsake}」后，我还是坚持把它塞进最显眼的那一格。就算挤得旁边的旧纽扣微微侧身，它大概也会谅解新来的小家伙。`,
          ps: "路过书架时我又多看了它两眼。"
        };
      }
    },

    /* ========== 三、POSITIONAL_IRONY（位置的反讽，8 组） ========== */
    {
      id: "pi_01",
      archetype: "POSITIONAL_IRONY",
      pet: "yutu",
      requires: ["focus"],
      build(f) {
        return {
          title: "帽檐里的雨声",
          body: `今天穿了一整天「${f.outfit}」，窗外偏偏一滴雨也没下。不过刚才床头黑猫警长咔哒咔哒走那${f.focusMin}分钟时，我把长耳朵贴在帽檐边听了听，里面真的有一点像下雨的声音。`,
          ps: "明天不下雨我也还想穿这件。"
        };
      }
    },
    {
      id: "pi_02",
      archetype: "POSITIONAL_IRONY",
      pet: "koi",
      requires: ["snack"],
      build(f) {
        return {
          title: "穿衣吃点心",
          body: `身为一条住在木桌上的锦鲤，我今天裹着「${f.outfit}」蹲在软木垫上啃${f.snack}，连窗外飞过的麻雀都歪头看了我两眼。明明在水里什么都不用穿，上岸后反倒最讲究衣角平不平。`,
          ps: "鱼穿衣服好像怪怪的，但我没脱。"
        };
      }
    },
    {
      id: "pi_03",
      archetype: "POSITIONAL_IRONY",
      pet: "any",
      requires: ["bathed"],
      build(f) {
        return {
          title: "干净怕碰灰",
          body: `刚被你搓完泡泡澡浑身香喷喷的，我穿着「${f.outfit}」坐在书桌正中间，反倒连咖啡杯都不敢凑近碰。以前灰扑扑的时候哪里都敢蹭，洗干净了倒变成了一尊小心翼翼的小摆件。`,
          ps: "坐姿端正得连黑猫警长都点头了。"
        };
      }
    },
    {
      id: "pi_04",
      archetype: "POSITIONAL_IRONY",
      pet: "any",
      requires: ["minigame"],
      build(f) {
        return {
          title: "桌角大玩家",
          body: `今天穿着「${f.outfit}」在这么小的木桌边陪你玩「${f.miniGame}」，明明一转身就能碰到咖啡杯，气势却摆得像在空旷操场上比赛。大概场地越小，认真起来的样子才越显眼吧。`,
          ps: "刚才差点把袖口沾到咖啡渍上。"
        };
      }
    },
    {
      id: "pi_05",
      archetype: "POSITIONAL_IRONY",
      pet: "yutu",
      requires: ["snack"],
      build(f) {
        return {
          title: "长耳听点心",
          body: `长耳朵本来是用来听远处风声的，今天穿着「${f.outfit}」待在屋里，却全用来听你拆${f.snack}包装纸的窸窣声了。这么灵敏的雷达拿来盯一块点心，听起来有点大材小用，但挺划算。`,
          ps: "包装纸叠成了小小的三角形。"
        };
      }
    },
    {
      id: "pi_06",
      archetype: "POSITIONAL_IRONY",
      pet: "koi",
      requires: [],
      build(f) {
        return {
          title: "岸上的软木垫",
          body: `今天穿着「${f.outfit}」在软木垫上站了一下午，脚下既没有水波也没有鹅卵石，只有温温的木头味。可我偶尔晃一晃衣摆，倒觉得这方小小的垫子比整条小河还要安稳。`,
          ps: "明天还站在这块木纹正中间。"
        };
      }
    },
    {
      id: "pi_07",
      archetype: "POSITIONAL_IRONY",
      pet: "any",
      requires: ["keepsake"],
      build(f) {
        return {
          title: "旧物的新住处",
          body: `这件「${f.keepsake}」本来是外头风里雨里捡来的小物，今天却被我们郑重其事地请进了暖橡木格子里，还穿着「${f.outfit}」替它掸了灰。它大概也没想到，退休后的住处这么讲究。`,
          ps: "木格里闻起来有淡淡的松木香。"
        };
      }
    },
    {
      id: "pi_08",
      archetype: "POSITIONAL_IRONY",
      pet: "any",
      requires: [],
      build(f) {
        return {
          title: "床头小值班",
          body: `明明是我住在木床旁边，结果每天站在床顶最威风的却是那只叉腰的黑猫警长钟。今天我穿着「${f.outfit}」仰头看了它一会儿，它连眼皮都没低一下，看来这间屋子它才是房东。`,
          ps: "刚才趁它看别处我偷偷比了个耶。"
        };
      }
    },

    /* ========== 四、DISPROPORTIONATE_NUMBERS（数量的错位，8 组） ========== */
    {
      id: "dn_01",
      archetype: "DISPROPORTIONATE_NUMBERS",
      pet: "koi",
      requires: ["snack"],
      build(f) {
        return {
          title: "含软的小点心",
          body: `你给的${f.snack}太脆了，我咬第一口怕吵到床头正在走字的黑猫警长，就在嘴里含了整整十四分钟等它变软。后来穿着「${f.outfit}」在软木垫上转了两圈，才安安静静咽下去。`,
          ps: "其实黑猫警长根本没听见。"
        };
      }
    },
    {
      id: "dn_02",
      archetype: "DISPROPORTIONATE_NUMBERS",
      pet: "yutu",
      requires: ["snack"],
      build(f) {
        return {
          title: "数清每粒屑",
          body: `今天穿着「${f.outfit}」吃${f.snack}，我用爪尖把碟子边剩下的碎屑拨成一小堆，认认真真数了二十三粒才一起扫进嘴里。为了不到半口点心花掉这么久，可数清楚了心里才踏实。`,
          ps: "第二十三粒其实只是块糖晶。"
        };
      }
    },
    {
      id: "dn_03",
      archetype: "DISPROPORTIONATE_NUMBERS",
      pet: "any",
      requires: ["focus"],
      build(f) {
        return {
          title: "数完滴答声",
          body: `刚才床头表专注那${f.focusMin}分钟里，我穿着「${f.outfit}」替你数了三百零七下秒针跳动。数到三百零八时窗外掠过一只鸟，我忘了下一拍是几，只好从头再小声默念了一遍。`,
          ps: "反正发条走完时我正好数到整数。"
        };
      }
    },
    {
      id: "dn_04",
      archetype: "DISPROPORTIONATE_NUMBERS",
      pet: "any",
      requires: ["bathed"],
      build(f) {
        return {
          title: "抖毛十八下",
          body: `洗完泡泡澡后，我站在软木垫边抖了足足十八下毛，就为了把耳尖上最后那一颗小水珠甩掉。结果换上「${f.outfit}」一摸，那颗水珠根本没掉，正稳稳挂在袖口缝线上发亮。`,
          ps: "后来它自己悄悄晒干了。"
        };
      }
    },
    {
      id: "dn_05",
      archetype: "DISPROPORTIONATE_NUMBERS",
      pet: "any",
      requires: ["minigame"],
      build(f) {
        return {
          title: "彩排九遍手势",
          body: `今天玩「${f.miniGame}」之前，我穿着「${f.outfit}」在桌面小立镜前偷偷把握爪的小动作排练了九遍。结果轮到上场时一紧张，只来得及把两只短爪往前轻轻举了一厘米。`,
          ps: "那一厘米我已经用尽全身力气了。"
        };
      }
    },
    {
      id: "dn_06",
      archetype: "DISPROPORTIONATE_NUMBERS",
      pet: "yutu",
      requires: [],
      build(f) {
        return {
          title: "整理衣领七次",
          body: `今天换上「${f.outfit}」后，我在桌边小立镜前把领口的小褶子抚平了整整七次。明明房间里除了你和床头那只黑猫没人会细看，可把衣角扯顺的那一刻，连长耳朵都跟着精神了。`,
          ps: "其实第七次和第一次看起来一样。"
        };
      }
    },
    {
      id: "dn_07",
      archetype: "DISPROPORTIONATE_NUMBERS",
      pet: "koi",
      requires: [],
      build(f) {
        return {
          title: "盯了四十秒光",
          body: `下午有一道细细的阳光从蕾丝窗边漏进来，我穿着「${f.outfit}」一动不动盯了它四十多秒，想确认它到底有没有在移动。等我眨完眼再看，它已经悄悄爬过咖啡杯底半寸远了。`,
          ps: "光走得比我走路还慢一点。"
        };
      }
    },
    {
      id: "dn_08",
      archetype: "DISPROPORTIONATE_NUMBERS",
      pet: "any",
      requires: ["keepsake"],
      build(f) {
        return {
          title: "擦了十二遍灰",
          body: `今天把「${f.keepsake}」收进多宝格之前，我用「${f.outfit}」的袖角前前后后擦了十二遍，连背面看不见的小棱角也没放过。虽然它本来就很干净，但多擦几下才算正式住进咱们家。`,
          ps: "木格门框被我蹭得亮亮的。"
        };
      }
    }
  ];

  function validateDiaryEntry(entry) {
    if (!entry || typeof entry !== "object") return { ok: false, reason: "empty" };
    const body = String(entry.body || "").trim();
    const ps = String(entry.ps || "").trim();
    const title = String(entry.title || "").trim();
    const bodyLen = Array.from(body).length;
    const psLen = Array.from(ps).length;

    if (!title || Array.from(title).length > 14) return { ok: false, reason: "title_len" };
    if (bodyLen < 50 || bodyLen > 125) return { ok: false, reason: "body_len:" + bodyLen };
    if (psLen > 20) return { ok: false, reason: "ps_len:" + psLen };
    if (BANNED_FLUFF_REGEX.test(body) || BANNED_FLUFF_REGEX.test(ps) || BANNED_FLUFF_REGEX.test(title)) {
      return { ok: false, reason: "banned_fluff" };
    }
    return { ok: true, bodyLen, psLen };
  }

  function buildFactSheet(store, catalog, dateKey, forcedPetId) {
    const dayLogs = (store && store.dailyEventLog && store.dailyEventLog[dateKey]) || {};
    let petId = forcedPetId;
    if (!petId) {
      const yScore = scorePetInteraction(dayLogs.yutu);
      const kScore = scorePetInteraction(dayLogs.koi);
      if (yScore > kScore) petId = "yutu";
      else if (kScore > yScore) petId = "koi";
      else petId = store && store.activePetId === "yutu" ? "yutu" : "koi";
    }
    const petLog = dayLogs[petId] || {};
    const petData = (store && store.pets && store.pets[petId]) || {};
    const outfitId = (Array.isArray(petLog.outfitsWorn) && petLog.outfitsWorn.length > 0)
      ? petLog.outfitsWorn[petLog.outfitsWorn.length - 1]
      : (petData.equippedSetId || (petId === "yutu" ? "set_cozy_knit" : "set_duck"));
    const snackId = Array.isArray(petLog.snacksFed) && petLog.snacksFed.length > 0
      ? petLog.snacksFed[petLog.snacksFed.length - 1]
      : "";
    const miniGameId = Array.isArray(petLog.miniGamesPlayed) && petLog.miniGamesPlayed.length > 0
      ? petLog.miniGamesPlayed[petLog.miniGamesPlayed.length - 1]
      : "";
    const keepsakeId = Array.isArray(petLog.keepsakesFound) && petLog.keepsakesFound.length > 0
      ? petLog.keepsakesFound[petLog.keepsakesFound.length - 1]
      : "";
    const focusMin = Number(petLog.focusMinutes || 0);
    const bathed = petLog.bathed === true;

    const outfitName = resolveOutfitName(catalog, petId, outfitId);
    const snackName = snackId ? resolveSnackName(snackId, petId) : "";
    const miniGameName = miniGameId ? resolveMiniGameName(miniGameId) : "";
    const keepsakeName = keepsakeId ? resolveKeepsakeName(catalog, keepsakeId) : "";
    const petName = (petData && petData.name) || (petId === "yutu" ? "糯米团子" : "锦小鲤");
    const userNickname = (store && store.user && store.user.nickname) || "蛋宝好友";
    const sceneId = (store && store.settings && store.settings.stageBgId) || "living_room";

    const tags = [outfitName];
    if (snackName) tags.push(snackName);
    if (focusMin > 0) tags.push(`专注${focusMin}m`);
    if (bathed) tags.push("泡泡澡");
    if (miniGameName) tags.push(miniGameName);
    if (keepsakeName) tags.push(keepsakeName);

    return {
      dateKey,
      petId,
      petName,
      userNickname,
      outfitId,
      outfit: outfitName,
      snackId,
      snack: snackName || resolveSnackName("", petId),
      hasSnack: !!snackId,
      focusMin,
      hasFocus: focusMin > 0,
      bathed,
      miniGameId,
      miniGame: miniGameName || "桌边小游戏",
      hasMiniGame: !!miniGameId,
      keepsakeId,
      keepsake: keepsakeName || "短铅笔",
      hasKeepsake: !!keepsakeId,
      sceneId,
      weather: "sunny",
      tags: tags.slice(0, 3)
    };
  }

  function createLocalDiaryAdapter() {
    return {
      name: "local-cold-humor-32",
      async generateDiary(factSheet) {
        const availableFacts = new Set();
        if (factSheet.hasSnack) availableFacts.add("snack");
        if (factSheet.hasFocus) availableFacts.add("focus");
        if (factSheet.bathed) availableFacts.add("bathed");
        if (factSheet.hasMiniGame) availableFacts.add("minigame");
        if (factSheet.hasKeepsake) availableFacts.add("keepsake");

        // 筛选匹配当前物种且所需事实全部存在的模板
        const eligible = DIARY_TEMPLATES.filter((tpl) => {
          if (tpl.pet !== "any" && tpl.pet !== factSheet.petId) return false;
          return tpl.requires.every((req) => availableFacts.has(req));
        });

        // 优先选择带真实互动事实约束（requires.length > 0）的模板，让日记更贴合今日行为
        const richPool = eligible.filter((tpl) => tpl.requires.length > 0);
        const pool = richPool.length > 0 ? richPool : (eligible.length > 0 ? eligible : DIARY_TEMPLATES);

        const seed = stableHash(`${factSheet.dateKey}:${factSheet.petId}:${factSheet.outfitId}:${factSheet.snackId}:${factSheet.focusMin}`);
        const picked = pool[seed % pool.length];
        const built = picked.build(factSheet);
        const signPrefix = factSheet.petId === "yutu" ? "耳朵贴贴，" : "尾巴摆摆，";

        return {
          id: `diary_${factSheet.dateKey}_${factSheet.petId}`,
          dateKey: factSheet.dateKey,
          petId: factSheet.petId,
          outfitId: factSheet.outfitId,
          sceneId: factSheet.sceneId,
          weather: factSheet.weather || "sunny",
          humorArchetype: picked.archetype,
          templateId: picked.id,
          title: built.title,
          salutation: `${factSheet.userNickname}，`,
          body: built.body,
          ps: built.ps,
          signOff: `${signPrefix}${factSheet.petName}`,
          tags: factSheet.tags,
          generator: "local-cold-humor-32"
        };
      }
    };
  }

  const defaultLocalAdapter = createLocalDiaryAdapter();
  let activeDiaryAdapter = defaultLocalAdapter;

  function setDiaryAdapter(adapter) {
    if (adapter && typeof adapter.generateDiary === "function") {
      activeDiaryAdapter = adapter;
    } else {
      activeDiaryAdapter = defaultLocalAdapter;
    }
    return activeDiaryAdapter;
  }

  function getDiaryAdapter() {
    return activeDiaryAdapter;
  }

  async function generateDiaryForDate(store, catalog, dateKey, opts) {
    const options = opts || {};
    const factSheet = buildFactSheet(store, catalog, dateKey, options.petId);
    if (options.weather) factSheet.weather = options.weather;

    let entry = null;
    try {
      entry = await activeDiaryAdapter.generateDiary(factSheet);
    } catch (e) {
      entry = null;
    }

    // 远期 ECS DeepSeek 代理若超时/解析失败/命中废话护栏，自动平滑回退本地 32 组引擎
    if (!entry || !validateDiaryEntry(entry).ok) {
      entry = await defaultLocalAdapter.generateDiary(factSheet);
    }

    if (options.welcomeBackNote) {
      entry.welcomeBackNote = options.welcomeBackNote;
    }
    return entry;
  }

  function getWelcomeBackNote(dateKey) {
    const idx = stableHash(dateKey || "welcome") % WELCOME_BACK_NOTES.length;
    return WELCOME_BACK_NOTES[idx];
  }

  /**
   * 懒加载结算日记（遵循 PRD §4.2）：
   * - 严禁为无互动的缺席日补发假日记
   * - 次日首访为最近一个有真实互动的历史日补结 1 篇
   * - 当日 ≥21:00 或玩家主动点击「写下今日手帐」（forceToday=true）且当日有 ≥1 项真实互动时即时生成
   */
  async function checkAndSettleDiary(store, catalog, opts) {
    if (!store || typeof store !== "object") return { generated: null, welcomeBackNote: "" };
    const options = opts || {};
    const now = typeof options.now === "number" ? options.now : Date.now();
    const utc8 = new Date(now + 8 * 3600000);
    const todayKey = utc8.toISOString().slice(0, 10);
    const hour = utc8.getUTCHours();

    if (!Array.isArray(store.diaries)) store.diaries = [];
    const existingDates = new Set(store.diaries.map((d) => d && d.dateKey).filter(Boolean));
    const logs = store.dailyEventLog && typeof store.dailyEventLog === "object" ? store.dailyEventLog : {};

    // 检查是否缺席 ≥2 天，若是则生成零愧疚「等门小涂鸦」（绝不补发空白日期日记）
    let welcomeBackNote = "";
    const lastEff = store.companion && store.companion.lastEffectiveDate;
    if (lastEff && lastEff < todayKey) {
      const a = Date.parse(lastEff + "T00:00:00Z");
      const b = Date.parse(todayKey + "T00:00:00Z");
      const gapDays = isFinite(a) && isFinite(b) ? Math.round((b - a) / 86400000) : 0;
      if (gapDays >= 2) {
        welcomeBackNote = getWelcomeBackNote(todayKey);
      }
    }

    // 1. 优先检查最近一个有真实互动的历史日是否待补结（最多补结最近 1 篇）
    const pastActiveDates = Object.keys(logs)
      .filter((dk) => dk < todayKey && !existingDates.has(dk))
      .filter((dk) => hasRealInteraction(logs[dk].yutu) || hasRealInteraction(logs[dk].koi))
      .sort()
      .reverse();

    if (pastActiveDates.length > 0 && !options.todayOnly) {
      const targetDate = pastActiveDates[0];
      const entry = await generateDiaryForDate(store, catalog, targetDate, {
        weather: options.weather || "sunny",
        welcomeBackNote
      });
      store.diaries.unshift(entry);
      return { generated: entry, isBackfill: true, welcomeBackNote };
    }

    // 2. 检查今日是否满足生成条件（21:00 后或用户手动触发，且当日有 ≥1 项真实互动）
    const todayLogs = logs[todayKey] || {};
    const todayActive = hasRealInteraction(todayLogs.yutu) || hasRealInteraction(todayLogs.koi);
    if (!existingDates.has(todayKey) && todayActive && (hour >= 21 || options.forceToday)) {
      const entry = await generateDiaryForDate(store, catalog, todayKey, {
        weather: options.weather || "sunny",
        welcomeBackNote
      });
      store.diaries.unshift(entry);
      return { generated: entry, isBackfill: false, welcomeBackNote };
    }

    return { generated: null, isBackfill: false, welcomeBackNote };
  }

  return {
    BANNED_FLUFF_REGEX,
    ARCHETYPES,
    ARCHETYPE_LABELS,
    DIARY_TEMPLATES,
    WELCOME_BACK_NOTES,
    SNACK_LABELS,
    MINIGAME_LABELS,
    hasRealInteraction,
    buildFactSheet,
    validateDiaryEntry,
    createLocalDiaryAdapter,
    setDiaryAdapter,
    getDiaryAdapter,
    generateDiaryForDate,
    checkAndSettleDiary,
    getWelcomeBackNote
  };
});
