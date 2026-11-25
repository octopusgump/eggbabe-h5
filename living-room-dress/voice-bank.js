/* ==========================================================================
   EggBabe 统一话语中枢与 6 大可替换人格引擎 (voice-bank.js)
   - 外貌生物意象 (Species Tokens) × 性格人格 (Persona Archetypes) 彻底解耦
   - 6 大可替换人格：体面冷幽默 / 钝感乐天派 / 软糯轻粘人 / 桌面哲学家 / 小管家傲娇 / 戏精乐子人
   - 覆盖很饿、很臭、又饿又臭、喂食/洗澡脱困、摸头、睡觉拦截、拍醒、开关灯、换装等 12 类场景
   - 全量受反废话正则 BANNED_FLUFF_REGEX 保护，零油腻、零愧疚催促、防连续重复
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeVoice = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function () {
  "use strict";

  const BANNED_FLUFF_REGEX = /(主人|元气满满|新的一天|温暖|治愈|岁月|最长情|多喝热水|加油|充满希望|感恩|开心的一天|！{2,}|!{2,})/;

  const SPECIES_TOKENS = Object.freeze({
    yutu: Object.freeze({
      species: "兔子",
      part: "长耳朵",
      coat: "绒毛",
      favSnack: "胡萝卜"
    }),
    koi: Object.freeze({
      species: "锦鲤",
      part: "小鱼鳍",
      coat: "绒毛",
      favSnack: "小鱼干"
    })
  });

  const DEFAULT_PERSONA_BY_PET = Object.freeze({
    yutu: "dry_wit",
    koi: "chill_daze"
  });

  const PERSONA_LIST = Object.freeze([
    {
      id: "dry_wit",
      name: "体面冷幽默",
      tags: ["慢半拍", "嘴硬", "爱面子"],
      desc: "认真的软糯小室友，饿了绝不承认，脏了强装淡定。",
      dirtyCue: "不太体面 🫧"
    },
    {
      id: "chill_daze",
      name: "钝感乐天派",
      tags: ["松弛", "少根筋", "随遇而安"],
      desc: "大脑常年少根筋，直球又自洽，天塌下来先吐个泡泡。",
      dirtyCue: "有点灰扑扑 🫧"
    },
    {
      id: "soft_clingy",
      name: "软糯轻粘人",
      tags: ["温柔", "爱贴贴", "不卖惨"],
      desc: "软绵绵喜欢凑近，轻声细语表达小需求，绝不催促。",
      dirtyCue: "想洗香香 🫧"
    },
    {
      id: "philosopher",
      name: "桌面哲学家",
      tags: ["安静", "观察派", "诗意碎碎念"],
      desc: "把桌边小事说成微散文，自带淡淡的距离美感。",
      dirtyCue: "落了点灰 🫧"
    },
    {
      id: "tsundere_boss",
      name: "小管家傲娇",
      tags: ["嘴硬心软", "操心", "反差萌"],
      desc: "总觉得自己在替你管屋子，嫌弃里藏着一点点在意。",
      dirtyCue: "快拿泡泡来 🫧"
    },
    {
      id: "chaotic_gremlin",
      name: "戏精乐子人",
      tags: ["脑洞跳脱", "爱加戏", "抽象萌"],
      desc: "内心戏极多，能把饿肚子和沾灰演成求生纪录片。",
      dirtyCue: "急需抢救 🫧"
    }
  ]);

  const PERSONA_MAP = Object.freeze(
    PERSONA_LIST.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {})
  );

  const PERSONA_LINES = Object.freeze({
    dry_wit: {
      hungry: [
        "刚才那声不是我，是软木垫在叫。",
        "我没饿，只是在认真回想{favSnack}的形状。",
        "{part}好像有点沉，大概是缺一点脆脆的东西。"
      ],
      dirty: [
        "别靠太近，我今天自带一层旧桌布的味道。",
        "{coat}打结了，我现在是一只不太体面的{species}。",
        "头顶那只小飞虫已经绕我飞第三圈了，挺没礼貌的。"
      ],
      hungry_and_dirty: [
        "又饿又灰扑扑的，今天真是我的体面低谷日。",
        "先吃还是先洗？……要不先悄悄给一口吧。"
      ],
      feed_recover: [
        "咔嚓……{part}好像重新立起来了。",
        "嗯，刚才确实有一点点饿，就一点点。"
      ],
      bath_recover: [
        "蓬松回来了。现在可以靠近三厘米。",
        "洗完像刚晒过太阳的毛巾，体面恢复完毕。"
      ],
      petted: [
        "{part}根这里，再轻一点刚刚好。",
        "摸完记得顺手帮我把{coat}理平。"
      ],
      sleep_blocked: [
        "唔……等我把这觉睡完……拍一下我也行。",
        "被窝里刚好捂热，想找我就轻拍一下吧。"
      ],
      wake_pat: [
        "唔，{part}先醒了，身子马上跟上。",
        "轻点拍，梦里的{favSnack}差点滑走了。"
      ],
      wake_done: [
        "揉揉眼睛，勉强算清醒了。",
        "好吧，起床陪你坐一会儿。"
      ],
      lamp_on: [
        "台灯一亮，刚好再陪你坐会儿。",
        "暖灯开了，那我先不睡了。"
      ],
      lamp_off: [
        "关灯了，钻回被窝继续打盹。",
        "灯灭了，晚安，明天桌边见。"
      ],
      outfit_done: [
        "镜子里这只，今天看起来挺体面。",
        "这身剪裁不错，刚好配我的{part}。"
      ]
    },
    chill_daze: {
      hungry: [
        "肚子刚才吐了一个空泡泡。",
        "如果现在掉下来一份{favSnack}，我一定接得住。",
        "{part}有点软，可能需要一点脆脆的撑一下。"
      ],
      dirty: [
        "空气里飘的绿线……好像真是从我这儿出来的。",
        "我觉得自己现在像一只晒过头的咸鱼。",
        "好想泡进一堆泡泡里，哪怕没有水也行。"
      ],
      hungry_and_dirty: [
        "肚子在叫，头顶在飞虫，我现在挺忙的。",
        "既饿又灰，但好像也还能再晃两下。"
      ],
      feed_recover: [
        "咔嚓，感觉力气和好运一起回来了。",
        "嘴里满起来的时候，世界安静多了。"
      ],
      bath_recover: [
        "哗啦——亮晶晶的，又是一只清爽小家伙。",
        "泡泡冲干净了，感觉能原地蹦出半米。"
      ],
      petted: [
        "头顶暖暖的，像晒到第一缕太阳。",
        "{part}悄悄翘起来了一点，你看见了吗。"
      ],
      sleep_blocked: [
        "还在梦里晃悠呢……轻拍一下叫我起来吧。",
        "被子太软了，拍拍我才爬得出来。"
      ],
      wake_pat: [
        "醒啦，刚梦见一颗很大的星星糖。",
        "唔……谁在拍我的被角呀。"
      ],
      wake_done: [
        "伸个大懒腰，晃回软木垫啦。",
        "清醒了大概七成，足够陪你玩啦。"
      ],
      lamp_on: [
        "暖光亮起来了，我晃回软木垫啦。",
        "开灯了呀，那再多待一会儿。"
      ],
      lamp_off: [
        "灯灭了，钻进被子吐个晚安泡泡。",
        "关灯睡觉，梦里见。"
      ],
      outfit_done: [
        "转了半圈，新衣服和{part}还挺合拍。",
        "换好啦，感觉今天运气也跟着变好一点。"
      ]
    },
    soft_clingy: {
      hungry: [
        "手心借我靠一下……顺便想吃点脆脆的。",
        "{part}有点没力气了，想吃一口{favSnack}。",
        "肚子咕噜了一声，你听见了吗。"
      ],
      dirty: [
        "{coat}有点粘粘的，洗完再贴贴好不好。",
        "想泡在香香的泡泡里，然后靠着你晒干。",
        "小飞虫一直跟着我，帮我搓搓泡泡吧。"
      ],
      hungry_and_dirty: [
        "先洗香香还是先吃一口？只要你在旁边都行。",
        "今天有点灰也有点饿，想躲进你手心里。"
      ],
      feed_recover: [
        "真好吃，{part}一下就有力气晃了。",
        "吃到{favSnack}了，靠在你旁边真踏实。"
      ],
      bath_recover: [
        "洗得软蓬蓬的，现在可以放心贴贴啦。",
        "香香的泡泡冲掉啦，想蹭蹭你的指尖。"
      ],
      petted: [
        "你的手心好暖，可以多停两秒吗。",
        "被轻轻摸头的时候，{part}会偷偷变软。"
      ],
      sleep_blocked: [
        "好困呀……轻拍一下被窝我再爬起来好不好。",
        "缩在被子里呢，拍拍我我就出来找你。"
      ],
      wake_pat: [
        "唔……是你呀，我马上钻出来。",
        "揉揉眼睛，听到你叫我就醒了。"
      ],
      wake_done: [
        "醒过来就能看见你，真好。",
        "慢吞吞跳回软木垫啦，陪你待着。"
      ],
      lamp_on: [
        "小台灯亮了，我出来陪你坐一会儿。",
        "暖暖的灯开了，刚好不想一个人睡。"
      ],
      lamp_off: [
        "灯关好啦，钻进被窝乖乖睡觉。",
        "晚安，明早我还在桌角等你。"
      ],
      outfit_done: [
        "这件软软的，你挑的我都喜欢。",
        "换好新衣服啦，离你近一点给你看。"
      ]
    },
    philosopher: {
      hungry: [
        "空腹的时候，窗外的风声听起来都像拆零食袋。",
        "桌角很安静，只有胃里在举行一场小型独奏。",
        "人在思考，{species}在思念一份{favSnack}。"
      ],
      dirty: [
        "灰尘落在身上久了，会让人误以为自己是一件旧摆件。",
        "也许洗一次澡，就能把这几天的闷气一起冲走。",
        "连小飞虫都知道，我该去见见肥皂泡了。"
      ],
      hungry_and_dirty: [
        "饥饿与灰尘同时到来，说明今天需要一次彻底的重启。",
        "先安抚胃，还是先安抚{coat}，这是个桌边难题。"
      ],
      feed_recover: [
        "食物落胃，窗外的光斑似乎都变清晰了。",
        "一口{favSnack}，足以把散掉的思绪重新缝合。"
      ],
      bath_recover: [
        "水汽散去后，连呼吸都轻了一克。",
        "{coat}重新蓬松，像刚晒透的一页旧书。"
      ],
      petted: [
        "安静待着的时候，掌心的重量刚刚好。",
        "不说话也没关系，这样拂过{part}就够了。"
      ],
      sleep_blocked: [
        "梦才刚翻到第二页，轻拍一下我再合上书吧。",
        "夜色很深，若要叫醒我，请轻轻拍一下被角。"
      ],
      wake_pat: [
        "从梦的边缘慢慢游回来了。",
        "唔，窗外的月光挪了半寸，我也该醒了。"
      ],
      wake_done: [
        "夜还长，陪你在桌边发会儿呆也好。",
        "双脚落回软木垫，现实重新开始运转。"
      ],
      lamp_on: [
        "一盏暖灯亮起，房间立刻有了边界感。",
        "灯开了，那便把睡眠先寄存给枕头。"
      ],
      lamp_off: [
        "灯影收起，把今天安放进被窝里。",
        "熄灯了，晚安，愿梦里没有多余的声响。"
      ],
      outfit_done: [
        "换一件织物，看窗外的角度也跟着换了。",
        "很合身，像本来就属于这个下午。"
      ]
    },
    tsundere_boss: {
      hungry: [
        "我提醒你，再不投喂，你的桌边室友就要原地休眠了。",
        "不是我馋，是{part}需要补充一点{favSnack}能量。",
        "都咕噜两回了，你居然还能假装没听见。"
      ],
      dirty: [
        "不是我说，这个清洁状况已经影响到本屋审美了。",
        "头顶的小飞虫都要反客为主了，快拿泡泡来。",
        "我平时很讲究的，今天这样实在忍不了。"
      ],
      hungry_and_dirty: [
        "既不给饭又不给洗，你这个合伙人今天有点敷衍啊。",
        "警告一次：再不管我，我就蹲在垫子上盯着你。"
      ],
      feed_recover: [
        "算你动作够快，这口{favSnack}勉强给满分。",
        "哼，吃饱了才有力气继续替你看着这间屋子。"
      ],
      bath_recover: [
        "这才像话嘛，干干净净的才配得上这间起居室。",
        "洗完顺眼多了，今天允许你多摸一下。"
      ],
      petted: [
        "手别乱揉，把{part}弄歪了还要我重新摆正。",
        "……好吧，看在你手法还行的份上，准你再摸两秒。"
      ],
      sleep_blocked: [
        "没看见在休整吗？真有急事就轻拍一下叫我。",
        "本屋现在是熄灯时段，想找我就拍拍被子。"
      ],
      wake_pat: [
        "知道了知道了，别拍了，这就起来。",
        "行吧，看在是你叫我的份上，睁眼了。"
      ],
      wake_done: [
        "起来了，说吧，这次又要我配合什么。",
        "勉强上线执勤，记得待会儿给点零食补偿。"
      ],
      lamp_on: [
        "灯都开了，那我就顺便起来巡视一下桌面。",
        "好吧，陪你熬一会儿，但别太晚。"
      ],
      lamp_off: [
        "终于关灯了，你也早点歇着，我先睡了。",
        "熄灯睡觉，明天见。"
      ],
      outfit_done: [
        "眼光还行，这身勉强配得上我的气场。",
        "换好了，记得给我拍张体面点的。"
      ]
    },
    chaotic_gremlin: {
      hungry: [
        "紧急播报：肚皮已进入省电模式，急需{favSnack}重启。",
        "刚才那声咕噜，已经传到窗外那棵树上了吧。",
        "如果我突然变扁了，请记得那是因为太饿。"
      ],
      dirty: [
        "头顶这两只小飞虫已经在我这儿办了年卡。",
        "再不洗，我就能靠气味占领整张书桌了。",
        "呼叫泡泡支援，我的{coat}正在申请离家出走。"
      ],
      hungry_and_dirty: [
        "求生纪录片第 1 集：又饿又灰的桌边生物正在等救援。",
        "肚皮在打鼓，飞虫在伴舞，我一个人就是一个乐队。"
      ],
      feed_recover: [
        "系统重启成功！{part}信号恢复满格。",
        "咔嚓一口，省电模式已解除，准备继续捣蛋。"
      ],
      bath_recover: [
        "年卡飞虫已被泡泡清场，本屋重归和平。",
        "闪亮登场！现在反光程度可以当小夜灯用了。"
      ],
      petted: [
        "警告：持续摸头可能导致本{species}原地融化。",
        "手感不错对吧，这可是全屋唯一限量绒毛。"
      ],
      sleep_blocked: [
        "当前处于离线做梦状态，请轻拍机身唤醒。",
        "梦里正在追巨型{favSnack}，拍一下才肯退出来。"
      ],
      wake_pat: [
        "嘀——收到拍拍指令，正在从被窝弹出。",
        "谁按了我的开机键？好吧，醒了醒了。"
      ],
      wake_done: [
        "弹射成功，稳稳降落软木垫！",
        "刚退出梦境副本，现在满血待命。"
      ],
      lamp_on: [
        "灯光一亮，夜场加演正式开始。",
        "开灯了！被窝封印自动解除。"
      ],
      lamp_off: [
        "灯光熄灭，钻回被窝切换成待机棉花团。",
        "晚安信号已发送，进入呼呼大睡模式。"
      ],
      outfit_done: [
        "新皮肤加载完成，全桌最靓的仔就是我。",
        "换装成功，感觉走路都能带起一阵小风。"
      ]
    }
  });

  const lastPickMap = Object.create(null);

  function resolvePersonaId(petId, personaId) {
    if (personaId && PERSONA_MAP[personaId]) return personaId;
    return DEFAULT_PERSONA_BY_PET[petId === "yutu" ? "yutu" : "koi"] || "dry_wit";
  }

  function interpolate(tpl, petId) {
    const tk = SPECIES_TOKENS[petId === "yutu" ? "yutu" : "koi"] || SPECIES_TOKENS.koi;
    return String(tpl || "")
      .replace(/\{species\}/g, tk.species)
      .replace(/\{part\}/g, tk.part)
      .replace(/\{coat\}/g, tk.coat)
      .replace(/\{favSnack\}/g, tk.favSnack);
  }

  function pick(petId, personaId, sceneKey) {
    const pid = petId === "yutu" ? "yutu" : "koi";
    const resolvedPersona = resolvePersonaId(pid, personaId);
    const bank = PERSONA_LINES[resolvedPersona] || PERSONA_LINES.dry_wit;
    const pool = bank[sceneKey];
    if (!Array.isArray(pool) || pool.length === 0) return "";
    const memKey = `${pid}:${resolvedPersona}:${sceneKey}`;
    const prevIdx = typeof lastPickMap[memKey] === "number" ? lastPickMap[memKey] : -1;
    let idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && idx === prevIdx) {
      idx = (idx + 1) % pool.length;
    }
    lastPickMap[memKey] = idx;
    return interpolate(pool[idx], pid);
  }

  function getPersonaDef(personaId) {
    return PERSONA_MAP[personaId] || PERSONA_LIST[0];
  }

  function getDirtyCueText(personaId) {
    return getPersonaDef(personaId).dirtyCue || "想洗香香 🫧";
  }

  function getSampleLine(petId, personaId, sceneKey) {
    const pid = petId === "yutu" ? "yutu" : "koi";
    const resolved = resolvePersonaId(pid, personaId);
    const bank = PERSONA_LINES[resolved] || PERSONA_LINES.dry_wit;
    const pool = bank[sceneKey || "hungry"] || bank.hungry;
    return interpolate(pool[0], pid);
  }

  function validateAllLines() {
    const issues = [];
    for (const p of PERSONA_LIST) {
      const bank = PERSONA_LINES[p.id];
      if (!bank) {
        issues.push(`missing bank for ${p.id}`);
        continue;
      }
      for (const [sceneKey, lines] of Object.entries(bank)) {
        if (!Array.isArray(lines) || lines.length === 0) {
          issues.push(`empty pool ${p.id}.${sceneKey}`);
          continue;
        }
        lines.forEach((raw, idx) => {
          for (const petId of ["yutu", "koi"]) {
            const rendered = interpolate(raw, petId);
            if (BANNED_FLUFF_REGEX.test(rendered)) {
              issues.push(`fluff violation in ${p.id}.${sceneKey}[${idx}] (${petId}): ${rendered}`);
            }
          }
        });
      }
    }
    return { ok: issues.length === 0, issues };
  }

  return {
    BANNED_FLUFF_REGEX,
    SPECIES_TOKENS,
    DEFAULT_PERSONA_BY_PET,
    PERSONA_LIST,
    PERSONA_MAP,
    PERSONA_LINES,
    resolvePersonaId,
    getPersonaDef,
    getDirtyCueText,
    getSampleLine,
    pick,
    validateAllLines
  };
});
