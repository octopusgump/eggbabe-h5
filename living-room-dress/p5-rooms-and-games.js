/* ==========================================================================
   EggBabe P5 软装模组目录、多房间导览、自制点心、《听你说》题库与小院信箱数据
   (p5-rooms-and-games.js — UMD 模块，纯 PNG 合规，兼容 H5 与 Node 单测)
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeP5Data = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function () {
  "use strict";

  const DECOR_SLOTS = Object.freeze([
    { id: "mod_bed", label: "木床与被褥", icon: "🛏️" },
    { id: "mod_lamp", label: "床头暖光灯", icon: "💡" },
    { id: "mod_books", label: "三层原木书架", icon: "📚" },
    { id: "mod_jewelry_box", label: "窗角首饰盒", icon: "🎁" },
    { id: "mod_wall_art", label: "墙面壁画", icon: "🖼️" },
    { id: "mod_desk_set", label: "书桌与茶具", icon: "☕" }
  ]);

  const DECOR_CATALOG = Object.freeze([
    // 1. mod_bed
    {
      id: "bed_star_blue",
      slot: "mod_bed",
      name: "原木云朵被",
      price: 0,
      swatch: "#D8E4EE",
      desc: "最初破壳起居室的松软奶白云朵绒毯",
      cssStyle: "default"
    },
    {
      id: "bed_matcha_waffle",
      slot: "mod_bed",
      name: "抹茶华夫格被褥",
      price: 35,
      swatch: "#B9C9A8",
      desc: "低饱和雾松绿华夫格织物，盖着有晒过太阳的青草气",
      cssStyle: "matcha"
    },
    {
      id: "bed_cream_gingham",
      slot: "mod_bed",
      name: "奶油格子绒毯",
      price: 45,
      swatch: "#EEDCC5",
      desc: "暖杏奶油粗棒针绒毯，窝在里面容易多打五分钟盹",
      cssStyle: "apricot"
    },
    // 2. mod_lamp
    {
      id: "lamp_oak_warm",
      slot: "mod_lamp",
      name: "原木暖光灯",
      price: 0,
      swatch: "#F2D7A4",
      desc: "经典暖橡木底座配米白灯罩，夜晚自动亮起",
      cssStyle: "default"
    },
    {
      id: "lamp_mushroom_cream",
      slot: "mod_lamp",
      name: "奶油森林蘑菇灯",
      price: 30,
      swatch: "#F6E7CA",
      desc: "圆润磨砂奶油蘑菇罩，灯光像刚倒出来的温热牛奶",
      cssStyle: "mushroom"
    },
    {
      id: "lamp_osmanthus_palace",
      slot: "mod_lamp",
      name: "桂月小宫灯",
      price: 50,
      swatch: "#E7B76F",
      desc: "微琥珀桂花暖光晕，照在床头黑猫警长帽徽上亮晶晶",
      cssStyle: "osmanthus"
    },
    // 3. mod_books
    {
      id: "books_oak_shelf_v1",
      slot: "mod_books",
      name: "三层暖橡木书架",
      price: 0,
      swatch: "#C89D6C",
      desc: "收纳手帐、信件与多宝格前排展品的起居室中枢",
      cssStyle: "default"
    },
    {
      id: "books_walnut_curio",
      slot: "mod_books",
      name: "深胡桃木博古书架",
      price: 55,
      swatch: "#7C5639",
      desc: "沉稳温润的深胡桃木作，让每一件小藏品更有博物馆质感",
      cssStyle: "walnut"
    },
    // 4. mod_jewelry_box
    {
      id: "jewelry_box_oak",
      slot: "mod_jewelry_box",
      name: "窗角原木首饰盒",
      price: 0,
      swatch: "#C5A078",
      desc: "带小抽屉的橡木收纳盒，微开时会透出暖星光",
      cssStyle: "default"
    },
    {
      id: "jewelry_box_ceramic",
      slot: "mod_jewelry_box",
      name: "白瓷绿植首饰盒",
      price: 35,
      swatch: "#DCE7DD",
      desc: "青白釉陶瓷盒身配新芽小盆栽，清爽透亮",
      cssStyle: "ceramic"
    },
    // 5. mod_wall_art
    {
      id: "wall_art_botanical",
      slot: "mod_wall_art",
      name: "双木框植物手稿",
      price: 0,
      swatch: "#DFD7C8",
      desc: "手绘植物线稿与窗边标本签，静谧又耐看",
      cssStyle: "default"
    },
    {
      id: "wall_art_polaroid_lights",
      slot: "mod_wall_art",
      name: "暖光拍立得串灯墙",
      price: 45,
      swatch: "#F5DC9B",
      desc: "在木框边缀上一串细小暖白星灯，傍晚一亮超有氛围",
      cssStyle: "stringlights"
    },
    {
      id: "wall_art_seasons_tapestry",
      slot: "mod_wall_art",
      name: "四季节气织物挂画",
      price: 60,
      swatch: "#C8B8A2",
      desc: "粗亚麻织物印染四季草木，让墙面像风吹过的原野",
      cssStyle: "tapestry"
    },
    // 6. mod_desk_set
    {
      id: "rug_cork_default",
      slot: "mod_desk_set",
      name: "软木垫与美式杯",
      price: 0,
      swatch: "#C4A37A",
      desc: "微距原木软木垫与冒热气的美式咖啡杯",
      cssStyle: "default"
    },
    {
      id: "desk_osmanthus_tea",
      slot: "mod_desk_set",
      name: "桂花白瓷茶具组",
      price: 40,
      swatch: "#E7DFCA",
      desc: "换上一壶飘着金桂香的温热白瓷茶，慢悠悠歇会儿",
      cssStyle: "tea"
    },
    {
      id: "desk_sketch_studio",
      slot: "mod_desk_set",
      name: "木色画具手帐台",
      price: 50,
      swatch: "#B99A74",
      desc: "整齐码着彩铅、和纸胶带与手帐本的创作小桌",
      cssStyle: "studio"
    }
  ]);

  const ROOMS_CATALOG = Object.freeze([
    {
      id: "living_room",
      name: "破壳起居室",
      shortName: "起居室",
      icon: "🏠",
      minDays: 1,
      starCost: 0,
      desc: "木床、床头黑猫警长发条钟、三层原木书架与书桌试衣软木垫。",
      bgFile: "living-room-dress/panoramas/room_shell_day.png"
    },
    {
      id: "cozy_kitchen",
      name: "暖光小厨房",
      shortName: "小厨房",
      icon: "🍳",
      minDays: 3,
      starCost: 60,
      desc: "复古奶油小烤箱与旅途冰箱贴板，亲手烤制桂花蜜松饼与香酥鲷鱼烧！",
      bgFile: "assets/shared/png/bgs/bg_candy_hearth.png"
    },
    {
      id: "sunlit_yard",
      name: "晴日小院子",
      shortName: "小院子",
      icon: "🌿",
      minDays: 7,
      starCost: 150,
      desc: "青石板草坪、桂花微风与带小红旗的户外原木信箱，收取旅途明信片与伴手礼。",
      bgFile: "assets/shared/png/bgs/bg_moon_courtyard.png",
      dayBgFile: "assets/shared/png/bgs/bg_plush_meadow.png"
    },
    {
      id: "attic_gallery",
      name: "阁楼茶室与陈列馆",
      shortName: "阁楼茶室",
      icon: "✨",
      minDays: 14,
      starCost: 260,
      comingSoon: true,
      desc: "阳光天窗阁楼、高定衣架人台与远期好友串门喝茶空间（筹备中）。",
      bgFile: "assets/shared/png/bgs/bg_autumn_cabin.png"
    }
  ]);

  const CRAFTED_SNACKS = Object.freeze([
    {
      id: "osmanthus_pancake",
      name: "桂花蜜松饼",
      img: "./living-room-dress/ui/snack_cake.png",
      hungerGain: 38,
      expGain: 14,
      badge: "小厨房自制"
    },
    {
      id: "crispy_taiyaki",
      name: "香酥鲷鱼烧",
      img: "./living-room-dress/ui/snack_fish.png",
      hungerGain: 38,
      expGain: 14,
      badge: "小厨房自制"
    }
  ]);

  // 《听你说》治愈轻问答动态题库（5 大生活分类，兼容扩展）
  const LISTEN_BANK = Object.freeze([
    {
      id: "daily_1",
      category: "日常小事",
      question: "今天有没有哪一件很小的事，让你顺手停下来多看了一眼？",
      options: [
        { text: "窗外的云或光斑", tag: "追光观察员", reply: "我也老爱盯着软木垫上那块慢慢挪动的光斑发呆。" },
        { text: "路过闻到的香味", tag: "灵敏小鼻尖", reply: "长耳朵还没听见，鼻子就已经替你记住那个下午啦。" },
        { text: "就是安安静静过完了", tag: "平稳生活家", reply: "什么大事也没发生的一天，其实最适合早点窝进被窝。" }
      ]
    },
    {
      id: "daily_2",
      category: "日常小事",
      question: "如果现在桌子角落可以凭空变出一样小东西，你最想要什么？",
      options: [
        { text: "一杯温度刚好的热饮", tag: "暖杯收藏家", reply: "不烫嘴也不凉掉的那三分钟，我替你看着表。" },
        { text: "一张软乎乎的靠垫", tag: "松软主义者", reply: "靠上去陷进去两厘米的那种，我批准你多赖十分钟。" },
        { text: "一支顺手好写的笔", tag: "纸笔爱好者", reply: "沙沙写完两行字，心里乱糟糟的线头就顺一半了。" }
      ]
    },
    {
      id: "weather_1",
      category: "心情天气",
      question: "如果把今天的心情画成窗外的天气，它更像哪一种？",
      options: [
        { text: "有微风的晴天", tag: "晴风系伙伴", reply: "这种天气最适合把小衣服拿出来晒晒太阳。" },
        { text: "薄薄的多云", tag: "云朵缓冲带", reply: "太阳躲在云后面偷懒的时候，我们也可以慢半拍。" },
        { text: "下着细雨的傍晚", tag: "听雨小能手", reply: "我把帽子戴好，陪你在屋里听雨滴敲窗沿。" }
      ]
    },
    {
      id: "weather_2",
      category: "心情天气",
      question: "有点累的时候，你通常靠什么悄悄给自己充一小格电？",
      options: [
        { text: "戴耳机听两首歌", tag: "旋律避风港", reply: "鼓点响起来的时候，我在桌边跟着轻轻晃耳朵。" },
        { text: "吃一口甜的或脆的", tag: "点心续命派", reply: "嚼起来咔嚓响的小零食，能把闷气咬碎一半。" },
        { text: "什么也不干发会儿呆", tag: "放空优等生", reply: "发呆也是正经事，我每天都要认真发呆好几次。" }
      ]
    },
    {
      id: "food_1",
      category: "食物与香气",
      question: "今晚的暖光小厨房如果开炉，你最想先烤哪一盘？",
      options: [
        { text: "桂花蜜松饼", tag: "甜香烘焙师", reply: "刚出炉时蜂蜜会顺着边角滴下来，我负责先闻第一口。" },
        { text: "香酥鲷鱼烧", tag: "酥脆鉴赏家", reply: "从尾巴开始咬还是从头开始咬，这是个严肃问题。" },
        { text: "热乎乎的烤红薯", tag: "冬日暖手党", reply: "捧在手心里暖呼呼的，剥皮的时候指尖都是甜味。" }
      ]
    },
    {
      id: "food_2",
      category: "食物与香气",
      question: "泡一杯热茶或咖啡时，你更喜欢哪个瞬间？",
      options: [
        { text: "热水冲开香气的那一秒", tag: "热气捕手", reply: "白雾慢慢升起来的时候，整张书桌都变安静了。" },
        { text: "端起来贴在手心暖手", tag: "温热派", reply: "不急着喝，先把手捂暖，这叫双倍划算。" },
        { text: "喝完最后一口看见杯底", tag: "圆满收尾控", reply: "杯垫留下一圈浅浅的水印，证明刚才认真歇过啦。" }
      ]
    },
    {
      id: "pause_1",
      category: "放空瞬间",
      question: "如果床头黑猫警长给你批了 15 分钟什么都不用管的假期，你会做什么？",
      options: [
        { text: "躺平看天花板", tag: "天花板研究员", reply: "躺平的时候视野会变宽，连墙角的影子都挺好看。" },
        { text: "翻翻手帐或画两笔", tag: "慢手帐玩家", reply: "画歪了也没关系，歪掉的线条才像自己画的。" },
        { text: "去小院子里吹会儿风", tag: "小院散步家", reply: "顺便看看木信箱上的小红旗有没有偷偷翘起来。" }
      ]
    },
    {
      id: "pause_2",
      category: "放空瞬间",
      question: "你觉得房间里最让人安心的声音是哪一种？",
      options: [
        { text: "发条钟轻轻的咔哒声", tag: "滴答守护者", reply: "黑猫警长走得很稳，听着就不会着急。" },
        { text: "翻书页的沙沙声", tag: "纸页听觉派", reply: "我每次听见翻页声，都会下意识把爪子放轻一点。" },
        { text: "窗外隐约的风声", tag: "窗边听风者", reply: "风在外面忙着赶路，我们在屋里稳稳当当待着。" }
      ]
    },
    {
      id: "wish_1",
      category: "小小愿望",
      question: "接下来这几天，你想把哪一件很小的念头变成真的？",
      options: [
        { text: "早点钻进被窝睡个好觉", tag: "早睡冲锋队", reply: "今晚十一点我会让黑猫警长替你轻轻关掉台灯。" },
        { text: "把一直想做的小事开个头", tag: "迈出第一步", reply: "哪怕只做了三分钟，也比光在脑子里想厉害多啦。" },
        { text: "多留一点时间给自己", tag: "温柔留白派", reply: "我就坐在软木垫上，随时给你留好这一方安静角落。" }
      ]
    }
  ]);

  const YARD_MAILBOX_DELIVERIES = Object.freeze([
    {
      sceneId: "bg_moon_courtyard",
      title: "桂月亭台来信",
      text: "风把小院子里的桂花吹落了三朵，我挑了最圆的一朵夹进信封寄回木信箱里。",
      starBonus: 6,
      keepsakeHint: "jade_rabbit_osmanthus_branch"
    },
    {
      sceneId: "bg_lotus_pond",
      title: "荷灯池畔明信片",
      text: "池面上的水纹晃得很慢，我在青石板边坐了一会儿，顺手把今晚的晚风折进信纸里。",
      starBonus: 6,
      keepsakeHint: "boon_koi_lotus_lantern"
    },
    {
      sceneId: "bg_autumn_cabin",
      title: "银杏林边小邮戳",
      text: "路过树下时有一片银杏叶刚好落在鞋尖上，没舍得拍掉，干脆连着这张小卡片一起投进信箱。",
      starBonus: 8,
      keepsakeHint: "ginkgo_leaf"
    },
    {
      sceneId: "bg_sunset_meadow",
      title: "云朵坡晚霞邮袋",
      text: "今天的云像刚烤好的松饼边角，我站在坡顶朝小院子挥了挥爪，信箱红旗应该翘起来了吧。",
      starBonus: 6,
      keepsakeHint: "dali_cloud_stone"
    }
  ]);

  function getDecorById(id) {
    return DECOR_CATALOG.find((d) => d.id === id) || null;
  }

  function getDecorBySlot(slotId) {
    return DECOR_CATALOG.filter((d) => d.slot === slotId);
  }

  function getRoomById(id) {
    return ROOMS_CATALOG.find((r) => r.id === id) || ROOMS_CATALOG[0];
  }

  function pickListenSessionQuestions(seedStr) {
    // 从 5 个分类中抽取 3 道不同分类的题目
    const byCat = new Map();
    LISTEN_BANK.forEach((q) => {
      if (!byCat.has(q.category)) byCat.set(q.category, []);
      byCat.get(q.category).push(q);
    });
    const cats = Array.from(byCat.keys());
    let h = 2166136261;
    const s = String(seedStr || Date.now());
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const start = (h >>> 0) % cats.length;
    const picked = [];
    for (let i = 0; i < 3; i++) {
      const cat = cats[(start + i) % cats.length];
      const list = byCat.get(cat);
      const q = list[((h >>> (i * 3)) & 0xff) % list.length];
      picked.push(q);
    }
    return picked;
  }

  return {
    DECOR_SLOTS,
    DECOR_CATALOG,
    ROOMS_CATALOG,
    CRAFTED_SNACKS,
    LISTEN_BANK,
    YARD_MAILBOX_DELIVERIES,
    getDecorById,
    getDecorBySlot,
    getRoomById,
    pickListenSessionQuestions
  };
});
