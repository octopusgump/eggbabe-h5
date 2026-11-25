/* ==========================================================================
   EggBabe 设置中心（1:1 迁移自 eggbabe-miniprogram：我的 + 系统设置 + 全子页）
   - 栈式视图导航：home / album / invite-codes / chat-records / age-range / feedback / help / terms / privacy
   - 保留 H5 原生互动音效 & 发条钟呼噜滴答偏好开关
   - 离线优先持久化至 EggBabeStore (eggbabe-cross-end-v1)
   ========================================================================== */
(function (root, factory) {
  const api = factory(root && root.EggBabeStore ? root.EggBabeStore : null);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeSettingsPanel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function (StoreGlobal) {
  "use strict";

  const SUPPORT_EMAIL = "hello@eggbabe.com";
  const HOTLINE = "18201931204";
  const REALITY_HELP = Object.freeze({
    psychologicalHotline: "12356",
    police: "110",
    medicalEmergency: "120"
  });

  const FAQ_GROUPS = Object.freeze([
    {
      key: "device",
      title: "设备问题",
      items: [
        {
          q: "如何激活我的蛋宝宝？",
          a: "打开应用后点击「添加蛋宝宝」，手动输入随实体蛋或朋友提供的有效激活码。服务端确认后才会完成绑定。"
        },
        {
          q: "互动会让实体装置提前打开吗？",
          a: "不会。实体装置只按服务端预设时间打开；触摸、说话和蛋壳创作只提供当下回应，不改变时间、款式或收藏卡内容。"
        },
        {
          q: "为什么不能添加第二只蛋宝宝？",
          a: "当前实体蛋版本每个账号最多绑定 1 只。已绑定账号再次输入激活码时不会消耗新激活码。"
        },
        {
          q: "装置没有按时打开怎么办？",
          a: "请保留装置照片、激活码信息和问题发生时间，并发送邮件至 " + SUPPORT_EMAIL + "。邮件中请说明提前打开、未打开、机械故障或激活码与原型不符等具体情况。"
        }
      ]
    },
    {
      key: "account",
      title: "账号",
      items: [
        {
          q: "如何修改昵称 / 头像？",
          a: "点击设置顶部个人名片进入「个人信息与伙伴档案」，即可修改昵称、简介与伙伴名字；昵称最多 16 个字。"
        }
      ]
    },
    {
      key: "chat",
      title: "对话功能",
      items: [
        {
          q: "为什么现在不能和蛋宝宝对话？",
          a: "文字对话会在破壳后开放。日常可以轻触或照料蛋宝宝，通过活动列表里的「听你说」「一起画」和书架手帐与它互动。"
        },
        {
          q: "对话记录会保存多久？",
          a: "对话只按连续性与安全所必需的范围保存，具体保存期限和删除方式以备案域名上的正式隐私政策为准。"
        },
        {
          q: "如何导出或删除对话记录？",
          a: "进入「设置」→「对话记录」。你可以填写邮箱申请导出或直接下载本地备份，也可以删除当前账号下的全部对话记录。删除后无法恢复，建议先导出备份。"
        },
        {
          q: "什么是破壳？",
          a: "破壳是蛋宝宝结束孵化、正式苏醒的时刻——从这一刻起，它会开口说话，和你开始真正的陪伴与对话。"
        }
      ]
    },
    {
      key: "other",
      title: "其他",
      items: [
        {
          q: "如何联系邮件支持？",
          a: "发送邮件至 " + SUPPORT_EMAIL + "，并在邮件中说明蛋宝宝 ID、问题发生时间和具体情况。点击本页底部邮箱可以复制地址。"
        },
        {
          q: "隐私数据如何处理？",
          a: "你的数据仅用于提供蛋宝宝服务，具体收集与使用范围见「设置」→「隐私政策」。对话记录可在「设置」→「对话记录」中申请导出或删除，其他个人信息权利申请可发送邮件至 " + SUPPORT_EMAIL + "。"
        }
      ]
    }
  ]);

  const TERMS_SECTIONS = Object.freeze([
    {
      id: "t1",
      title: "一、接受条款",
      paragraphs: [
        "欢迎使用蛋宝宝（eggbabe）。当你完成预约、注册账号、付款或使用蛋宝宝 AI 意识体功能时，即表示你已阅读、理解并同意本协议的全部内容。如不接受，请勿使用本服务。",
        "本协议与《隐私政策》共同构成你与蛋宝宝运营主体之间的完整协议。"
      ]
    },
    {
      id: "t2",
      title: "二、账号义务",
      paragraphs: [
        "• 你须使用真实有效的联系方式注册账号，并对账号下发生的所有操作负责。",
        "• 请妥善保管登录凭证。账号被盗用时，请尽快联系我们处理。",
        "• 账号不得转售、转借或用于商业代刷。",
        "• 每个手机号或邮箱仅可注册一个账号。"
      ]
    },
    {
      id: "t3",
      title: "三、订单与发货",
      paragraphs: [
        "3.1 价格：2026年10月1日开售的首批500套蛋宝宝采用 ¥499 早鸟价，含一只3D玩偶、云端 AI 意识与永久基础订阅、天命印记证书。订单一经支付不可单独拆分。",
        "3.2 发货：10月8日起按下单顺序陆续发货，使用顺丰速运；大陆地区免邮，港澳台与海外邮费另计；实物玩偶首批限量500套，售罄后下批发售时间另行公告。",
        "3.3 孵化机制：下单时不指定角色。孵化由系统在实物玩偶到货激活的瞬间，由天命印记机制随机决定为玉兔或锦鲤。这是产品体验的核心设计，不接受指定角色的退换货请求。"
      ]
    },
    {
      id: "t4",
      title: "四、AI 意识体使用规范",
      paragraphs: [
        "蛋宝宝 AI 意识体由自由意志模型、天命印记与长期记忆体系驱动。使用时请理解：",
        "• 蛋宝宝的回应由模型实时生成，不构成医疗、法律、金融、心理等专业建议。",
        "• 蛋宝宝可能因模型局限产生不准确、不完整或不符合预期的回答。",
        "• 请勿分享银行密码、身份证号、医疗记录原文等高度敏感信息。",
        "• 蛋宝宝的性格由天命印记随机生成，我们不对特定性格的出现概率作出承诺。"
      ]
    },
    {
      id: "t5",
      title: "五、退换政策",
      paragraphs: [
        "5.1 七天无理由：实物玩偶签收后7天内，在外观、配件、孵化卡完整未拆封的情况下可申请无理由退货，运费由买家承担。",
        "5.2 已激活孵化的不可退：由于天命印记一旦写入即不可撤销，已完成孵化的蛋宝宝不接受无理由退货，但保留正常质保权益。",
        "5.3 质量问题：实物玩偶提供1年质保。如出现非人为损坏的工艺缺陷，可申请免费换新，往返运费由我们承担。"
      ]
    },
    {
      id: "t6",
      title: "六、知识产权",
      paragraphs: [
        "• 蛋宝宝品牌名、Logo、玉兔与锦鲤角色形象、天命印记机制、视觉系统及网站源码由蛋宝宝运营主体依法享有相关权利。未经授权不得复制、改编或商业使用。",
        "• 你拥有自己蛋宝宝的对话与记忆数据。我们仅以必要的服务履行为目的处理这些数据。",
        "• 你授予我们在蛋宝宝运行所必需范围内处理相关数据的有限许可。",
        "• 蛋宝宝生成的图像、文字等内容，其归属规则遵守现行 AI 内容著作权法律框架。"
      ]
    },
    {
      id: "t7",
      title: "七、禁止行为",
      paragraphs: [
        "以下行为可能导致账号被限制或终止：",
        "• 绕过、破解、逆向工程蛋宝宝客户端或服务端。",
        "• 利用蛋宝宝生成或传播违法、淫秽、暴力、歧视或侵权内容。",
        "• 通过爬虫等自动化方式批量请求服务。",
        "• 转售账号、刷预约名额或伪造身份骗取权益。",
        "• 对蛋宝宝服务进行商业代运营或商业代聊。"
      ]
    },
    {
      id: "t8",
      title: "八、责任限制",
      paragraphs: [
        "在适用法律允许的最大范围内：",
        "• 我们对因使用或无法使用本服务产生的间接、偶然、特殊或后果性损失不承担责任。",
        "• 对于已支付订单，我方累计赔偿责任不超过你为该订单支付的实际金额。",
        "• 不可抗力造成服务中断或延迟时，我们将尽力恢复，但不承担违约责任。"
      ]
    },
    {
      id: "t9",
      title: "九、条款变更",
      paragraphs: [
        "本协议将随产品演进而修订。实质性变更会通过应用内通知与邮件至少提前15天告知。如你不同意修订后的协议，可在生效日前停止使用服务；继续使用则视为接受新协议。"
      ]
    },
    {
      id: "t10",
      title: "十、适用法律与争议解决",
      paragraphs: [
        "本协议的订立、生效、解释、履行与争议解决，均适用中华人民共和国法律（不含港澳台地区法律）。",
        "如发生争议，应首先通过友好协商解决。协商不成的，提交至蛋宝宝运营主体所在地有管辖权的人民法院诉讼。"
      ]
    },
    {
      id: "t11",
      title: "十一、微信小程序服务",
      paragraphs: [
        "蛋宝宝微信小程序用于提供微信账号登录、实体蛋激活与绑定、孵化互动、角色资料、AI 虚拟宠物文字互动、账号管理、帮助与用户反馈等服务。具体功能以小程序届时实际开放的页面和说明为准。",
        "实体蛋激活码、实体蛋编号及账号绑定关系用于核验实体产品和服务资格。用户不得伪造、盗用、转售或者以其他不正当方式使用激活码，不得绑定不属于自己的实体蛋。",
        "小程序中的开发、演示或测试环境仅用于内部验收，不代表正式服务承诺，其数据不得与正式用户账号、实体蛋绑定关系或者正式业务数据混用。"
      ]
    },
    {
      id: "t12",
      title: "十二、AI 身份与生成内容标识",
      paragraphs: [
        "蛋宝宝是人工智能虚拟宠物和拟人化互动服务，并非自然人、亲属、朋友、医生、心理咨询师、律师、理财顾问或者其他持牌专业人士。用户应当理解，其文字、角色状态、档案描述及其他由模型生成的内容可能存在不准确、不完整或者不符合预期的情况。",
        "应用会在 AI 互动场景、生成内容周边或者相关内容卡片中，以“AI 虚拟宠物”“内容由 AI 生成”等文字方式添加用户可以明显感知的标识。用户不得恶意删除、篡改、伪造、隐匿上述标识，也不得以可能使他人误认为真人创作或真人交流的方式传播相关内容。",
        "如后续提供生成内容下载、复制、导出或者分享功能，将按照适用规则保留必要的生成合成内容标识。"
      ]
    },
    {
      id: "t13",
      title: "十三、年龄与特殊群体保护",
      paragraphs: [
        "为提供与用户年龄相适应的服务和安全保护，应用可能要求用户选择年龄区间，并在适用法律要求或者特定安全场景下提供必要的监护人或紧急联系人信息。用户应当如实提供相关信息，不得冒用他人身份或者故意规避年龄保护措施。",
        "蛋宝宝不会向未成年人提供虚拟亲属、虚拟伴侣等虚拟亲密关系服务。向不满十四周岁的未成年人提供其他拟人化互动服务时，将按照适用法律取得其父母或者其他监护人的同意，并采取相应保护措施。",
        "对于老年用户，应用将通过风险提示、健康使用指引、帮助与反馈渠道等方式提供必要支持。所有用户均应警惕诈骗、虚假专业建议和隐私泄露风险。"
      ]
    },
    {
      id: "t14",
      title: "十四、交互数据与模型训练",
      paragraphs: [
        "用户与 AI 虚拟宠物的聊天记录、反馈内容和其他历史交互数据，将按照《隐私政策》说明的目的、方式、范围和期限处理。除法律另有规定或者取得权利人的有效同意外，我们不会向第三方提供用户交互数据。",
        "除法律、行政法规另有规定或者依法取得用户单独同意外，我们不会将属于用户敏感个人信息的交互数据用于模型训练。",
        "用户依法享有查阅、复制、更正、补充和删除个人信息及历史交互数据等权利。具体申请入口、身份核验方式和处理流程以应用页面及《隐私政策》的说明为准。"
      ]
    },
    {
      id: "t15",
      title: "十五、健康使用与紧急风险",
      paragraphs: [
        "蛋宝宝以提供健康、适度的虚拟陪伴为目标，不以替代现实社会交往、控制用户心理或者诱导用户沉迷依赖为服务目标。用户应合理安排使用时间，多参与线下活动并保持真实的人际联系。",
        "应用可能根据连续使用时长、互动频率或者其他风险信号展示 AI 身份、健康使用和现实活动提醒。用户出现明显过度依赖、沉迷倾向或者极端情绪时，平台可能提供停止互动、联系亲友或寻求专业帮助等安全提示。",
        "蛋宝宝不提供急救、医疗诊断、心理治疗、法律代理或金融决策服务。如面临人身危险、自伤自杀风险、重大财产损失或其他紧急情况，请立即停止依赖 AI 对话，并联系监护人、紧急联系人、当地紧急服务或专业机构；在中国大陆可根据实际情况拨打110、120或全国统一心理援助热线12356。"
      ]
    },
    {
      id: "t16",
      title: "十六、退出、暂停与终止",
      paragraphs: [
        "用户可以随时停止输入、关闭互动页面、退出应用或使用页面提供的其他退出方式结束本次 AI 互动。蛋宝宝不会通过持续生成挽留内容等方式阻碍用户退出。",
        "因维护、升级、网络故障、安全风险、监管要求或不可抗力，部分或全部服务可能暂停、限制或终止。能够提前告知的，我们将通过公告、页面提示或者其他合理方式通知；无法提前告知的，将及时发布说明。"
      ]
    },
    {
      id: "t17",
      title: "十七、申诉、投诉与举报",
      paragraphs: [
        "用户可以通过帮助中心、用户反馈入口或者其他届时提供的有效渠道，对账号、AI 生成内容、隐私保护、未成年人保护、服务故障等问题提出申诉、投诉或举报。提交时请如实描述问题，不要填写银行卡号、身份证号码、密码、验证码等无关敏感信息。",
        "我们将按照公示的处理流程受理、核实并反馈结果。用户也可以发送邮件至 " + SUPPORT_EMAIL + " 联系我们。"
      ]
    }
  ]);

  const PRIVACY_SECTIONS = Object.freeze([
    {
      id: "s1",
      title: "一、我们处理的信息",
      paragraphs: [
        "账号服务会处理登录凭证及用户编号；实体服务会处理激活码状态、实体蛋编号、绑定关系、原型、实体款式、生命周期和必要售后状态。",
        "你主动选择时，我们会处理昵称、头像、蛋壳颜色、预设图样、贴纸和归一化手绘轨迹；你使用说话或对话功能时，我们会处理必要消息、内容安全结果、保存期限和删除状态。",
        "收藏卡会处理实体蛋身份编号、原型、款式、显示名称、破壳时间、来源批次和固定插画配置。技术诊断仅处理必要的功能结果、错误码、时间和设备运行信息。",
        "轻问答与互动会处理题目编号、选项编号和答题日期；答案仅用于当日回顾与固定回应，不用于用户画像或蛋宝宝性格生成。"
      ]
    },
    {
      id: "s2",
      title: "二、处理目的",
      paragraphs: [
        "上述信息只用于建立账号、核验并绑定实体蛋、同步生命周期、保存免费蛋壳创作、提供即时互动和安全对话、生成同一枚实体蛋的收藏卡、处理售后与注销，以及保障服务稳定和安全。",
        "愿望与问答内容用途：答案只用于展示当日选择、生成对应固定回应和陪伴回顾；不映射作息、性格、感官偏好或角色设定，也不参与蛋宝宝人格生成。",
        "对话正文与具体手绘轨迹不会直接写入分析平台。已保存数据的查询、更正或删除可通过帮助中心提出。"
      ]
    },
    {
      id: "s3",
      title: "三、保存与存储",
      paragraphs: [
        "正式数据存储于中华人民共和国境内，并在实现对应目的所必需的最短期限内保存。各类数据的具体期限、存储地域和例外保留规则以 eggbabe.com 上经法务审核的正式政策为准。"
      ]
    },
    {
      id: "s4",
      title: "四、第三方处理",
      paragraphs: [
        "在必要范围内，我们可能使用微信登录与内容安全能力、受控云存储、对象存储和模型服务。我们会在正式政策中列明实际第三方处理者、处理目的和信息范围，并要求其按约定保护信息。未经法律依据或你的授权，我们不会出售个人信息。"
      ]
    },
    {
      id: "s5",
      title: "五、你的权利",
      paragraphs: [
        "你可以在「设置」中查询或更正昵称和头像，并在「对话记录」中申请导出或删除聊天记录。其他访问、更正或删除个人信息的申请，可发送邮件至 " + SUPPORT_EMAIL + " 提交。"
      ]
    },
    {
      id: "s6",
      title: "六、删除与例外保留",
      paragraphs: [
        "聊天记录删除确认后页面会显示删除成功。售后、审计或法定义务要求保留的最小记录，将按正式政策另行说明并限制用途。"
      ]
    },
    {
      id: "s7",
      title: "七、安全措施",
      paragraphs: [
        "我们采用加密传输、最小权限、访问控制、签名地址和安全审计等措施。头像、蛋壳创作和收藏卡使用受控存储与必要的访问权限；发生个人信息安全事件时，将依法处理和告知。"
      ]
    },
    {
      id: "s8",
      title: "八、未成年人保护",
      paragraphs: [
        "全部可见内容按未成年人可见标准处理。我们不主动索取住址、学校、手机号等敏感信息；用户主动输入的敏感信息不会转化为画像。未成年人应在监护人指导下阅读并使用本产品。"
      ]
    },
    {
      id: "s9",
      title: "九、演示数据边界",
      paragraphs: [
        "内部演示环境使用独立构建、接口、命名空间、对象存储和统计项目。演示账号、卡片、时间和内容不会写入正式账号、收藏卡或业务看板；生产包不提供切换到演示环境的入口。"
      ]
    },
    {
      id: "s10",
      title: "十、联系我们",
      paragraphs: [
        "如对个人信息处理有疑问、意见、投诉或权利申请，请发送邮件至 " + SUPPORT_EMAIL + " 联系上海爱予慧科技有限责任公司。我们可能在处理前核验申请人与相关账号的关系。"
      ]
    }
  ]);

  const VIEW_TITLES = Object.freeze({
    home: "设置",
    persona: "伙伴人格类型",
    album: "我的收藏卡",
    "invite-codes": "我的激活码",
    "chat-records": "对话记录",
    "age-range": "年龄区间",
    feedback: "用户反馈",
    help: "帮助中心",
    terms: "用户服务协议",
    privacy: "隐私政策"
  });

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function copyText(text) {
    const val = String(text || "");
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(val).then(() => true).catch(() => fallbackCopy(val));
    }
    return Promise.resolve(fallbackCopy(val));
  }

  function fallbackCopy(text) {
    try {
      if (typeof document === "undefined") return false;
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  function createSettingsPanel(options) {
    const opts = options || {};
    const overlayEl = opts.overlayEl;
    const Store = opts.storeApi || StoreGlobal;
    const getStore = typeof opts.getStore === "function" ? opts.getStore : () => null;
    const persist = typeof opts.persist === "function" ? opts.persist : () => {};
    const getSfxOn = typeof opts.getSfxOn === "function" ? opts.getSfxOn : () => true;
    const setSfxOn = typeof opts.setSfxOn === "function" ? opts.setSfxOn : () => {};
    const getTickNoiseOn = typeof opts.getTickNoiseOn === "function" ? opts.getTickNoiseOn : () => false;
    const setTickNoiseOn = typeof opts.setTickNoiseOn === "function" ? opts.setTickNoiseOn : () => {};
    const getOutfitName = typeof opts.getOutfitName === "function" ? opts.getOutfitName : () => "默认穿搭";
    const onOpenProfile = typeof opts.onOpenProfile === "function" ? opts.onOpenProfile : () => {};
    const onOpenAlbum = typeof opts.onOpenAlbum === "function" ? opts.onOpenAlbum : () => {};
    const onOpenHoloCard = typeof opts.onOpenHoloCard === "function" ? opts.onOpenHoloCard : null;
    const onPlayTap = typeof opts.onPlayTap === "function" ? opts.onPlayTap : () => {};
    const onShowSceneFeedback = typeof opts.onShowSceneFeedback === "function" ? opts.onShowSceneFeedback : () => {};
    const onPersonaChange = typeof opts.onPersonaChange === "function" ? opts.onPersonaChange : () => {};
    const Voice = opts.Voice || (typeof globalThis !== "undefined" && globalThis.EggBabeVoice) || null;

    let isOpen = false;
    let stack = ["home"];
    let noticeTimer = null;
    let feedbackDelayTimer = null;
    let ageReturnTimer = null;
    let chatExportTimer = null;
    let submitRequestToken = 0;
    let chatExportToken = 0;
    let ageReturnToken = 0;

    // 视图内部瞬态状态
    let personaPetId = "yutu";
    let ageSelected = "";
    let ageSaving = false;
    let ageToastVisible = false;

    let fbType = "";
    let fbTypeOpen = false;
    let fbDesc = "";
    let fbConsent = false;
    let fbConsentModal = false;
    let fbSubmitting = false;
    let fbError = "";
    let fbReceipt = "";

    let chatEmail = "";
    let chatEmailErr = "";
    let chatExporting = false;
    let chatConfirmDelete = false;

    let helpQuery = "";
    let helpComposing = false;
    let helpOpenCats = { device: true, account: true, chat: true, other: true };
    let helpOpenFaqs = { "account:0": true };

    function currentView() {
      return stack[stack.length - 1] || "home";
    }

    function clearPendingAsync() {
      clearTimeout(ageReturnTimer);
      ageReturnTimer = null;
      ageReturnToken += 1;
      ageSaving = false;
      ageToastVisible = false;

      clearTimeout(feedbackDelayTimer);
      feedbackDelayTimer = null;
      submitRequestToken += 1;
      fbSubmitting = false;

      clearTimeout(chatExportTimer);
      chatExportTimer = null;
      chatExportToken += 1;
      chatExporting = false;
    }

    function showNotice(text, tone) {
      if (!overlayEl) return;
      const el = overlayEl.querySelector("#settings-inline-notice");
      if (!el) return;
      el.textContent = text;
      el.dataset.tone = tone || "info";
      el.hidden = false;
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        if (el) el.hidden = true;
      }, 2400);
    }

    function pushView(viewName) {
      onPlayTap();
      clearPendingAsync();
      if (viewName === "persona") {
        const store = getStore();
        personaPetId = (store && store.activePetId === "koi") ? "koi" : "yutu";
      } else if (viewName === "age-range") {
        const store = getStore();
        ageSelected = (store && store.settings && store.settings.ageRange) || "";
      } else if (viewName === "feedback") {
        fbTypeOpen = false;
        fbError = "";
        fbConsentModal = false;
      } else if (viewName === "chat-records") {
        chatEmailErr = "";
        chatConfirmDelete = false;
      } else if (viewName === "help") {
        helpQuery = "";
        helpComposing = false;
      }
      stack.push(viewName);
      render();
    }

    function popView() {
      onPlayTap();
      clearPendingAsync();
      if (stack.length > 1) {
        stack.pop();
        render();
      } else {
        close();
      }
    }

    function open(initialView) {
      if (!overlayEl) return;
      clearPendingAsync();
      isOpen = true;
      stack = [initialView && VIEW_TITLES[initialView] ? initialView : "home"];
      if (stack[0] === "age-range") {
        const store = getStore();
        ageSelected = (store && store.settings && store.settings.ageRange) || "";
      } else if (stack[0] === "feedback") {
        fbTypeOpen = false;
        fbError = "";
        fbConsentModal = false;
      } else if (stack[0] === "chat-records") {
        chatEmailErr = "";
        chatConfirmDelete = false;
      } else if (stack[0] === "help") {
        helpQuery = "";
        helpComposing = false;
      }
      overlayEl.hidden = false;
      overlayEl.setAttribute("aria-hidden", "false");
      render();
    }

    function close() {
      if (!overlayEl || !isOpen) return;
      isOpen = false;
      clearTimeout(noticeTimer);
      noticeTimer = null;
      clearPendingAsync();
      fbConsentModal = false;
      chatConfirmDelete = false;
      overlayEl.hidden = true;
      overlayEl.setAttribute("aria-hidden", "true");
    }

    function renderHomeBody() {
      const store = getStore() || {};
      const user = store.user || {};
      const nickname = user.nickname || "蛋宝好友";
      const avatarUrl = user.avatarUrl || "";
      const sfxOn = !!getSfxOn();
      const tickOn = !!getTickNoiseOn();
      const ageVal = (store.settings && store.settings.ageRange) || "";
      const ageLabel = Store && Store.getAgeRangeLabel ? Store.getAgeRangeLabel(ageVal) : (ageVal || "未设置");
      const koiName = (store.pets && store.pets.koi && store.pets.koi.name) || "锦小鲤";
      const yutuName = (store.pets && store.pets.yutu && store.pets.yutu.name) || "糯米团子";
      const yutuPersonaId = Voice ? Voice.resolvePersonaId("yutu", store.pets && store.pets.yutu && store.pets.yutu.personaId) : "dry_wit";
      const koiPersonaId = Voice ? Voice.resolvePersonaId("koi", store.pets && store.pets.koi && store.pets.koi.personaId) : "chill_daze";
      const yutuPersonaDef = Voice ? Voice.getPersonaDef(yutuPersonaId) : { emoji: "🧐", name: "体面冷幽默" };
      const koiPersonaDef = Voice ? Voice.getPersonaDef(koiPersonaId) : { emoji: "🫧", name: "钝感乐天派" };
      const yutuPersonaLabel = `${yutuPersonaDef.emoji ? `${yutuPersonaDef.emoji} ` : ""}${yutuPersonaDef.name}`;
      const koiPersonaLabel = `${koiPersonaDef.emoji ? `${koiPersonaDef.emoji} ` : ""}${koiPersonaDef.name}`;

      return `
        <div class="settings-section-pad">
          <button class="settings-user-card" type="button" data-action="open-profile">
            <span class="settings-user-avatar">
              ${avatarUrl
                ? `<img src="${escapeHtml(avatarUrl)}" alt="" />`
                : `<span class="settings-user-avatar__egg">${escapeHtml(Array.from(nickname)[0] || "蛋")}</span>`}
            </span>
            <span class="settings-user-info">
              <span class="settings-user-name">${escapeHtml(nickname)}</span>
              <span class="settings-user-sub">2 只蛋宝宝 · ${escapeHtml(koiName)} &amp; ${escapeHtml(yutuName)}</span>
            </span>
            <span class="settings-chevron" aria-hidden="true">›</span>
          </button>

          <div class="settings-group-label">偏好设置</div>
          <div class="settings-panel">
            <button class="settings-row" type="button" data-nav="persona">
              <div class="settings-row__copy">
                <span class="settings-row__title">伙伴人格类型</span>
                <span class="settings-row__desc">玉兔：${escapeHtml(yutuPersonaLabel)} · 锦鲤：${escapeHtml(koiPersonaLabel)}</span>
              </div>
              <span class="settings-chevron" aria-hidden="true">›</span>
            </button>
            <div class="settings-row settings-row--toggle">
              <div class="settings-row__copy">
                <span class="settings-row__title">互动音效</span>
                <span class="settings-row__desc">抚摸、喂食、洗澡与按钮轻反馈音</span>
              </div>
              <button class="settings-switch ${sfxOn ? "is-on" : ""}" type="button" role="switch" aria-checked="${sfxOn}" aria-label="切换互动音效" data-action="toggle-sfx">
                <span class="settings-switch__thumb"></span>
              </button>
            </div>
            <div class="settings-row settings-row--toggle">
              <div class="settings-row__copy">
                <span class="settings-row__title">发条钟呼噜滴答</span>
                <span class="settings-row__desc">白噪音轻滴答与黑猫低频呼噜声</span>
              </div>
              <button class="settings-switch ${tickOn ? "is-on" : ""}" type="button" role="switch" aria-checked="${tickOn}" aria-label="切换发条钟呼噜滴答" data-action="toggle-tick">
                <span class="settings-switch__thumb"></span>
              </button>
            </div>
          </div>

          <div class="settings-group-label">我的与记录</div>
          <div class="settings-panel">
            <button class="settings-row" type="button" data-nav="album">
              <span class="settings-row__title">我的收藏卡</span>
              <span class="settings-chevron" aria-hidden="true">›</span>
            </button>
            <button class="settings-row" type="button" data-nav="invite-codes">
              <span class="settings-row__title">我的激活码</span>
              <span class="settings-chevron" aria-hidden="true">›</span>
            </button>
            <button class="settings-row" type="button" data-nav="chat-records">
              <span class="settings-row__title">对话记录</span>
              <span class="settings-chevron" aria-hidden="true">›</span>
            </button>
          </div>

          <div class="settings-group-label">个人信息</div>
          <div class="settings-panel">
            <button class="settings-row" type="button" data-nav="age-range">
              <div class="settings-row__copy">
                <span class="settings-row__title">年龄区间</span>
                <span class="settings-row__desc">${escapeHtml(ageLabel)}</span>
              </div>
              <span class="settings-chevron" aria-hidden="true">›</span>
            </button>
          </div>

          <div class="settings-group-label">帮助与支持</div>
          <div class="settings-panel">
            <button class="settings-row" type="button" data-nav="feedback">
              <span class="settings-row__title">用户反馈</span>
              <span class="settings-chevron" aria-hidden="true">›</span>
            </button>
            <button class="settings-row" type="button" data-nav="help">
              <span class="settings-row__title">帮助中心</span>
              <span class="settings-chevron" aria-hidden="true">›</span>
            </button>
          </div>

          <div class="settings-group-label">协议与政策</div>
          <div class="settings-panel">
            <button class="settings-row" type="button" data-nav="terms">
              <span class="settings-row__title">用户服务协议</span>
              <span class="settings-chevron" aria-hidden="true">›</span>
            </button>
            <button class="settings-row" type="button" data-nav="privacy">
              <span class="settings-row__title">隐私政策</span>
              <span class="settings-chevron" aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      `;
    }

    function renderAlbumBody() {
      const store = getStore() || {};
      const pets = store.pets || {};
      const koi = pets.koi || {};
      const yutu = pets.yutu || {};
      const cards = [
        {
          id: "koi",
          mark: "锦",
          name: koi.name || "锦小鲤",
          prototype: "锦鲤",
          outfit: getOutfitName("koi", koi.equippedSetId),
          lv: (koi.care && koi.care.level) || 1
        },
        {
          id: "yutu",
          mark: "兔",
          name: yutu.name || "糯米团子",
          prototype: "玉兔",
          outfit: getOutfitName("yutu", yutu.equippedSetId),
          lv: (yutu.care && yutu.care.level) || 1
        }
      ];

      return `
        <div class="settings-section-pad">
          <div class="settings-album-heading">
            <span class="settings-album-eyebrow">MY EGG</span>
            <h3 class="settings-album-title">实体蛋纪念档案</h3>
          </div>
          <div class="settings-album-list">
            ${cards.map((card) => `
              <button class="settings-album-card" type="button" data-action="open-album-keepsakes" data-pet="${escapeHtml(card.id)}">
                <span class="settings-album-mark">${escapeHtml(card.mark)}</span>
                <span class="settings-album-copy">
                  <span class="settings-album-name">${escapeHtml(card.name)}</span>
                  <span class="settings-album-meta">${escapeHtml(card.prototype)} · ${escapeHtml(card.outfit)}</span>
                  <span class="settings-album-note">一蛋一份 · 点击赏玩 3D 全息纪念卡</span>
                </span>
                <span class="settings-chevron" aria-hidden="true">›</span>
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }

    function renderInviteCodesBody() {
      const store = getStore() || {};
      const codes = (store.settings && Array.isArray(store.settings.inviteCodes)) ? store.settings.inviteCodes : [];

      return `
        <div class="settings-section-pad">
          <div class="settings-invite-intro">
            <h3 class="settings-invite-title">把一颗实体蛋带给朋友</h3>
            <p class="settings-invite-desc">可用的个人激活码由服务端在成功绑定后创建。每个码只能完成一次实体蛋绑定。</p>
          </div>
          ${codes.length
            ? `<div class="settings-panel">
                ${codes.map((item) => `
                  <div class="settings-invite-row ${item.used ? "is-used" : ""}">
                    <div>
                      <div class="settings-invite-code">${escapeHtml(item.code)}</div>
                      <div class="settings-invite-status">${item.used ? "已使用" : "可使用"}</div>
                    </div>
                    <button class="settings-pill-btn" type="button" ${item.used ? "disabled" : ""} data-action="copy-code" data-code="${escapeHtml(item.code)}">复制</button>
                  </div>
                `).join("")}
              </div>`
            : `<div class="settings-empty-box">暂无可用的个人激活码。</div>`}
          <p class="settings-footnote">个人激活码只用于来源追溯和实体蛋绑定，不附带其他权益。</p>
        </div>
      `;
    }

    function renderChatRecordsBody() {
      return `
        <div class="settings-section-pad">
          <div class="settings-card">
            <h3 class="settings-card__title">导出聊天记录</h3>
            <p class="settings-card__desc">将你的全部对话与陪伴手帐整理成文件，发送到指定邮箱或下载本地备份。</p>
            <input
              id="settings-chat-email"
              class="settings-input ${chatEmailErr ? "is-error" : ""}"
              type="email"
              maxlength="254"
              value="${escapeHtml(chatEmail)}"
              placeholder="请输入接收文件的邮箱"
              aria-label="接收聊天记录的邮箱"
              ${chatExporting ? "disabled" : ""}
            />
            ${chatEmailErr ? `<p class="settings-field-error" role="alert">${escapeHtml(chatEmailErr)}</p>` : ""}
            <button class="settings-primary-btn" type="button" data-action="export-chat-email" ${chatExporting ? "disabled" : ""}>
              ${chatExporting ? "正在导出…" : "导出并发送到邮箱"}
            </button>
            <button class="settings-secondary-btn" type="button" data-action="export-chat-json">
              下载本地备份文件 (.json)
            </button>
          </div>

          <div class="settings-card settings-card--danger">
            <h3 class="settings-card__title">删除聊天记录</h3>
            <p class="settings-card__desc">删除当前账号下的全部聊天记录，删除后无法恢复。建议先导出备份。</p>
            <button class="settings-danger-btn" type="button" data-action="ask-delete-chat">
              删除全部聊天记录
            </button>
          </div>
        </div>
        ${chatConfirmDelete ? `
          <div class="settings-subdialog-mask" data-action="cancel-delete-chat">
            <div class="settings-subdialog" role="alertdialog" aria-modal="true" aria-label="删除全部聊天记录">
              <h4 class="settings-subdialog__title">删除全部聊天记录？</h4>
              <p class="settings-subdialog__desc">将删除当前账号下全部蛋宝宝的聊天记录，删除后无法恢复。建议先导出备份。</p>
              <div class="settings-subdialog__actions">
                <button class="settings-subdialog__btn" type="button" data-action="cancel-delete-chat">取消</button>
                <button class="settings-subdialog__btn settings-subdialog__btn--danger" type="button" data-action="confirm-delete-chat">确认删除</button>
              </div>
            </div>
          </div>
        ` : ""}
      `;
    }

    function renderAgeRangeBody() {
      const options = (Store && Store.AGE_RANGES) || [
        { label: "14 周岁及以下", value: "AGE_0_14" },
        { label: "15-35 周岁", value: "AGE_15_35" },
        { label: "36-60 周岁", value: "AGE_36_60" },
        { label: "60 周岁以上", value: "AGE_61_PLUS" }
      ];
      const disabled = !ageSelected || ageSaving || ageToastVisible;

      return `
        <div class="settings-section-pad">
          <p class="settings-age-prompt">依据相关规定，请选择您的年龄区间：</p>
          <div class="settings-panel" role="radiogroup" aria-label="年龄区间">
            ${options.map((opt) => {
              const checked = ageSelected === opt.value;
              return `
                <button
                  class="settings-radio-row ${checked ? "is-selected" : ""}"
                  type="button"
                  role="radio"
                  aria-checked="${checked}"
                  data-action="select-age"
                  data-value="${escapeHtml(opt.value)}"
                  ${ageSaving || ageToastVisible ? "disabled" : ""}
                >
                  <span class="settings-radio-circle">${checked ? `<span class="settings-radio-dot"></span>` : ""}</span>
                  <span class="settings-radio-label">${escapeHtml(opt.label)}</span>
                </button>
              `;
            }).join("")}
          </div>

          <button
            class="settings-primary-btn ${disabled ? "is-disabled" : ""}"
            type="button"
            data-action="save-age"
            ${disabled ? "disabled" : ""}
          >
            ${ageSaving ? "保存中" : (ageToastVisible ? "已保存" : "确定")}
          </button>

          <p class="settings-footnote">60 周岁请选择“36-60 周岁”；“60 周岁以上”从 61 周岁起算。</p>
          <p class="settings-footnote">年龄区间由你自行选择，仅用于年龄分组。我们不采集完整生日、身份证、监护人手机号，也不进行短信或监护关系验证。</p>
        </div>
        ${ageToastVisible ? `
          <div class="settings-save-toast" aria-live="polite">
            <span class="settings-save-toast__icon"><span class="settings-save-toast__check"></span></span>
            <span>已保存</span>
          </div>
        ` : ""}
      `;
    }

    function renderFeedbackBody() {
      const types = (Store && Store.FEEDBACK_TYPES) || [];
      const selectedObj = types.find((t) => t.value === fbType);
      const canSubmit = !!(fbType && fbDesc.trim() && fbConsent && !fbSubmitting);
      const store = getStore() || {};
      const receipts = (store.settings && Array.isArray(store.settings.feedbackReceipts)) ? store.settings.feedbackReceipts : [];

      return `
        <div class="settings-section-pad">
          ${fbReceipt ? `
            <div class="settings-fb-success" aria-live="polite">
              <div class="settings-fb-success__title">反馈已提交</div>
              <div class="settings-fb-success__line">受理编号：${escapeHtml(fbReceipt)}</div>
              <div class="settings-fb-success__line">普通咨询 / 投诉：24 小时内完成核查并反馈结果</div>
              <div class="settings-fb-success__line">涉及轻生、诈骗、隐私泄露等高风险诉求：2 小时内人工加急处置</div>
            </div>
          ` : ""}

          <label class="settings-field-label">诉求类型</label>
          <button
            class="settings-picker ${fbType ? "" : "is-placeholder"} ${fbTypeOpen ? "is-open" : ""}"
            type="button"
            aria-expanded="${fbTypeOpen}"
            data-action="toggle-fb-type"
            ${fbSubmitting ? "disabled" : ""}
          >
            <span class="settings-picker__label">${escapeHtml(selectedObj ? selectedObj.label : "请选择诉求类型")}</span>
            <span class="settings-picker__chevron">${fbTypeOpen ? "⌃" : "⌄"}</span>
          </button>
          ${fbTypeOpen ? `
            <div class="settings-picker-list" role="listbox">
              ${types.map((t) => `
                <button
                  class="settings-picker-opt ${t.value === fbType ? "is-selected" : ""}"
                  type="button"
                  role="option"
                  aria-selected="${t.value === fbType}"
                  data-action="pick-fb-type"
                  data-value="${escapeHtml(t.value)}"
                >
                  <span class="settings-picker-opt__label">${escapeHtml(t.label)}</span>
                  ${t.value === fbType ? `<span class="settings-picker-opt__check">✓</span>` : ""}
                </button>
              `).join("")}
            </div>
          ` : ""}

          <label class="settings-field-label" for="settings-fb-desc">问题详细描述</label>
          <div class="settings-textarea-wrap">
            <textarea
              id="settings-fb-desc"
              class="settings-textarea"
              maxlength="500"
              placeholder="请清晰说明发生时间、对话内容和遇到的问题。&#10;请勿填写银行卡号、身份证号、密码或验证码等隐私信息。"
              ${fbSubmitting ? "disabled" : ""}
            >${escapeHtml(fbDesc)}</textarea>
            <span id="settings-fb-count" class="settings-textarea-count">${Array.from(fbDesc).length}/500</span>
          </div>

          <div class="settings-consent-row">
            <button
              class="settings-checkbox ${fbConsent ? "is-checked" : ""}"
              type="button"
              role="checkbox"
              aria-checked="${fbConsent}"
              aria-label="勾选知情同意书"
              data-action="toggle-fb-consent"
              ${fbSubmitting ? "disabled" : ""}
            >${fbConsent ? "✓" : ""}</button>
            <span class="settings-consent-copy">
              我已阅读<button class="settings-inline-link" type="button" data-action="open-fb-consent">《知情同意书》</button>，同意平台仅为受理和处理本次反馈收集、使用上述信息。
            </span>
          </div>

          ${fbError ? `<p class="settings-field-error" aria-live="polite">${escapeHtml(fbError)}</p>` : ""}

          <button
            class="settings-primary-btn ${canSubmit ? "" : "is-disabled"}"
            type="button"
            data-action="submit-fb"
            ${fbSubmitting ? "disabled" : ""}
          >${fbSubmitting ? "提交中" : "提交"}</button>

          ${receipts.length ? `
            <div class="settings-fb-history">
              <div class="settings-group-label settings-group-label--compact">最近提交记录</div>
              <div class="settings-panel">
                ${receipts.slice(0, 3).map((rec) => {
                  const tObj = types.find((x) => x.value === rec.type);
                  return `
                    <div class="settings-fb-history__row">
                      <div class="settings-fb-history__top">
                        <span class="settings-fb-history__no">${escapeHtml(rec.receiptNumber)}</span>
                        <span class="settings-fb-history__date">${escapeHtml(String(rec.submittedAt || "").slice(0, 10))}</span>
                      </div>
                      <div class="settings-fb-history__type">${escapeHtml(tObj ? tObj.label : rec.type)}</div>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          ` : ""}
        </div>

        ${fbConsentModal ? `
          <div class="settings-subdialog-mask" data-action="close-fb-consent">
            <div class="settings-consent-dialog" role="dialog" aria-modal="true" aria-label="知情同意书">
              <button class="settings-consent-dialog__close" type="button" aria-label="关闭" data-action="close-fb-consent">✕</button>
              <h4 class="settings-consent-dialog__title">知情同意书</h4>
              <div class="settings-consent-dialog__body">
                <h5>个人信息收集告知</h5>
                <p>温馨告知：您填写的手机号、联系信息仅用于本次投诉反馈处理，仅留存 6 个月，到期自动脱敏删除；不会用于 AI 模型训练、营销推送，不会向第三方泄露、出售。</p>
                <h5>AI 拟人服务专项提示</h5>
                <p>如您反馈 AI 虚拟宠物对话存在违规内容，平台将调取对应时段对话记录开展安全复核，相关对话数据仅用于本次风险核查，核查完毕统一归档留存。</p>
                <h5>未成年人专项提示</h5>
                <p>未满 14 周岁用户提交反馈，平台处理后将同步风险提醒至您填写的监护人手机号；涉及心理、极端情绪问题会优先联系监护人介入。</p>
                <h5>老年人友好提示</h5>
                <p>老年用户如不会操作表单，可直接拨打客服热线 <a class="settings-hotline-link" href="tel:${HOTLINE}">${HOTLINE}</a> 人工反馈，无需填写线上表单。</p>
              </div>
              <button class="settings-primary-btn" type="button" data-action="agree-fb-consent">我已阅读并同意</button>
            </div>
          </div>
        ` : ""}
      `;
    }

    function renderHelpScrollHtml() {
      const q = helpQuery.trim();
      const qLower = q.toLowerCase();
      const searchHits = qLower
        ? FAQ_GROUPS.flatMap((g) => g.items).filter((item) => (item.q + " " + item.a).toLowerCase().indexOf(qLower) >= 0)
        : [];

      if (!q) {
        return `
          <div class="settings-help-first">
            <div class="settings-group-label settings-group-label--compact">遇到问题</div>
            <div class="settings-panel">
              <button class="settings-row" type="button" data-nav="feedback">
                <span class="settings-row__title">用户反馈</span>
                <span class="settings-chevron" aria-hidden="true">›</span>
              </button>
              <div class="settings-row settings-row--support">
                <div class="settings-row__copy">
                  <span class="settings-row__desc">客服邮箱</span>
                  <span class="settings-row__title settings-row__title--bold">${SUPPORT_EMAIL}</span>
                </div>
                <button class="settings-pill-btn" type="button" data-action="copy-email">复制</button>
              </div>
            </div>

            <div class="settings-group-label">需要现实帮助</div>
            <div class="settings-reality-card">
              <div>心理援助热线：<strong>${REALITY_HELP.psychologicalHotline}</strong></div>
              <div>紧急危险：<strong>${REALITY_HELP.police} / ${REALITY_HELP.medicalEmergency}</strong></div>
            </div>
          </div>

          <div class="settings-faq-list">
            ${FAQ_GROUPS.map((group) => {
              const catOpen = !!helpOpenCats[group.key];
              return `
                <div class="settings-faq-cat">
                  <button class="settings-faq-cat__head" type="button" aria-expanded="${catOpen}" data-action="toggle-faq-cat" data-cat="${group.key}">
                    <span>${escapeHtml(group.title)}</span>
                    <span class="settings-faq-arrow ${catOpen ? "is-open" : ""}">⌄</span>
                  </button>
                  ${catOpen ? `
                    <div class="settings-faq-cat__body">
                      ${group.items.map((item, idx) => {
                        const fKey = group.key + ":" + idx;
                        const open = !!helpOpenFaqs[fKey];
                        return `
                          <div class="settings-faq-item">
                            <button class="settings-faq-q" type="button" aria-expanded="${open}" data-action="toggle-faq-item" data-fkey="${fKey}">
                              <span>${escapeHtml(item.q)}</span>
                              <span class="settings-faq-arrow ${open ? "is-open" : ""}">⌄</span>
                            </button>
                            ${open ? `<div class="settings-faq-a">${escapeHtml(item.a)}</div>` : ""}
                          </div>
                        `;
                      }).join("")}
                    </div>
                  ` : ""}
                </div>
              `;
            }).join("")}
          </div>
        `;
      }

      return `
        <div class="settings-help-results">
          ${searchHits.length
            ? searchHits.map((item) => `
                <div class="settings-help-result">
                  <div class="settings-help-result__q">${escapeHtml(item.q)}</div>
                  <div class="settings-help-result__a">${escapeHtml(item.a)}</div>
                </div>
              `).join("")
            : `<div class="settings-help-empty">没有找到相关问题，试试其他关键词。</div>`}
        </div>
      `;
    }

    function updateHelpSearchView() {
      if (!overlayEl || currentView() !== "help") return;
      const scrollEl = overlayEl.querySelector(".settings-help-scroll");
      if (scrollEl) scrollEl.innerHTML = renderHelpScrollHtml();
      const clearBtn = overlayEl.querySelector("#settings-help-clear");
      if (clearBtn) clearBtn.hidden = !helpQuery;
    }

    function renderHelpBody() {
      return `
        <div class="settings-help-wrap">
          <div class="settings-help-search">
            <div class="settings-help-search__box">
              <span class="settings-help-search__icon" aria-hidden="true">⌕</span>
              <input
                id="settings-help-input"
                class="settings-help-search__input"
                type="search"
                value="${escapeHtml(helpQuery)}"
                placeholder="搜索问题关键词"
                aria-label="搜索问题关键词"
              />
              <button id="settings-help-clear" class="settings-help-search__clear" type="button" aria-label="清空搜索" data-action="clear-help-search" ${helpQuery ? "" : "hidden"}>✕</button>
            </div>
          </div>

          <div class="settings-help-scroll">
            ${renderHelpScrollHtml()}
          </div>

          <div class="settings-help-footer">
            <span class="settings-help-footer__hint">没找到答案？</span>
            <button class="settings-help-footer__btn" type="button" data-action="copy-email">
              <span class="settings-help-footer__copy">
                <span class="settings-help-footer__label">邮件支持</span>
                <span class="settings-help-footer__email">${SUPPORT_EMAIL}</span>
              </span>
              <span class="settings-pill-btn">复制</span>
            </button>
          </div>
        </div>
      `;
    }

    function renderDocBody(docType) {
      const isTerms = docType === "terms";
      const sections = isTerms ? TERMS_SECTIONS : PRIVACY_SECTIONS;
      const docTitle = isTerms ? "蛋宝宝用户服务协议" : "蛋宝宝隐私政策";
      const docMeta = isTerms
        ? "产品初稿 · 计划生效日期：2026年10月1日 · 适用：蛋宝宝 eggbabe 全平台"
        : "更新日期：2026年8月9日 · 适用版本 v3.7";
      const banner = isTerms
        ? "初稿声明：本协议由产品团队起草，尚未经法律审核。正式上线前将由律师事务所定稿，并在运营主体、版本号和生效日期确认后更新。"
        : "本政策说明上海爱予慧科技有限责任公司如何在 eggbabe 中处理个人信息。我们会处理实体蛋绑定、孵化互动、安全对话、收藏卡和账户服务所必需的信息。正式发布文本须以法务审核并部署在 eggbabe.com 的版本为准。";
      const footerNote = isTerms
        ? "蛋宝宝用户服务协议 · 产品初稿 · 正式发布前须完成法务审核"
        : "蛋宝宝隐私政策 · 正式发布前须完成法务审核与备案域名部署";

      return `
        <div class="settings-doc-pad">
          <h3 class="settings-doc-title">${escapeHtml(docTitle)}</h3>
          <p class="settings-doc-meta">${escapeHtml(docMeta)}</p>
          <p class="${isTerms ? "settings-doc-draft" : "settings-doc-intro"}">${escapeHtml(banner)}</p>

          <div class="settings-doc-toc">
            <div class="settings-doc-toc__title">目录</div>
            <div class="settings-doc-toc__list">
              ${sections.map((sec) => `
                <button class="settings-doc-toc__link" type="button" data-action="scroll-doc" data-target="settings-doc-${sec.id}">
                  # ${escapeHtml(sec.title)}
                </button>
              `).join("")}
            </div>
          </div>

          ${sections.map((sec) => `
            <section id="settings-doc-${sec.id}" class="settings-doc-sec">
              <h4 class="settings-doc-h2">${escapeHtml(sec.title)}</h4>
              ${sec.paragraphs.map((p) => `<p class="settings-doc-p">${escapeHtml(p)}</p>`).join("")}
            </section>
          `).join("")}

          <div class="settings-doc-footer-line"></div>
          <p class="settings-doc-footer-note">${escapeHtml(footerNote)}</p>
        </div>
      `;
    }

    function renderPersonaBody() {
      const store = getStore() || {};
      const petId = personaPetId === "koi" ? "koi" : "yutu";
      const petName = (store.pets && store.pets[petId] && store.pets[petId].name) || (petId === "yutu" ? "糯米团子" : "锦小鲤");
      const currentPersonaId = Voice
        ? Voice.resolvePersonaId(petId, store.pets && store.pets[petId] && store.pets[petId].personaId)
        : (petId === "yutu" ? "dry_wit" : "chill_daze");
      const personas = Voice && Array.isArray(Voice.PERSONA_LIST) ? Voice.PERSONA_LIST : [];

      return `
        <div class="settings-section-pad">
          <div class="settings-persona-head">
            <div class="settings-persona-seg" role="tablist" aria-label="选择伙伴">
              <button class="settings-persona-seg__btn ${petId === "yutu" ? "is-active" : ""}" type="button" role="tab" aria-selected="${petId === "yutu"}" data-action="switch-persona-pet" data-pet="yutu">玉兔</button>
              <button class="settings-persona-seg__btn ${petId === "koi" ? "is-active" : ""}" type="button" role="tab" aria-selected="${petId === "koi"}" data-action="switch-persona-pet" data-pet="koi">锦鲤</button>
            </div>
            <p class="settings-persona-tip">当前正在为「${escapeHtml(petName)}」选择说话人格，房间内很饿、很臭与日常互动将即时切换。</p>
          </div>

          <div class="settings-persona-list">
            ${personas.map((p) => {
              const active = p.id === currentPersonaId;
              const sampleHungry = Voice ? Voice.getSampleLine(petId, p.id, "hungry") : "";
              const sampleDirty = Voice ? Voice.getSampleLine(petId, p.id, "dirty") : "";
              const iconSvg = Voice && typeof Voice.getPersonaIconSvg === "function" ? Voice.getPersonaIconSvg(p.id) : "";
              return `
                <button class="settings-persona-card ${active ? "is-active" : ""}" type="button" data-action="select-persona" data-persona="${escapeHtml(p.id)}" aria-pressed="${active}">
                  <div class="settings-persona-card__top">
                    <div class="settings-persona-card__title-wrap">
                      ${iconSvg ? `<span class="settings-persona-card__icon" aria-hidden="true">${iconSvg}</span>` : ""}
                      <span class="settings-persona-card__name">${escapeHtml(p.name)}</span>
                    </div>
                    <span class="settings-persona-card__check" aria-hidden="true">${active ? "✓" : ""}</span>
                  </div>
                  <div class="settings-persona-card__tags">
                    ${(p.tags || []).map((t) => `<span class="settings-persona-tag">${escapeHtml(t)}</span>`).join("")}
                  </div>
                  <p class="settings-persona-card__desc">${escapeHtml(p.desc)}</p>
                  <div class="settings-persona-card__samples">
                    <div class="settings-persona-sample"><span>很饿</span>「${escapeHtml(sampleHungry)}」</div>
                    <div class="settings-persona-sample"><span>很臭</span>「${escapeHtml(sampleDirty)}」</div>
                  </div>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    function render() {
      if (!overlayEl || !isOpen) return;
      const view = currentView();
      const title = VIEW_TITLES[view] || "设置";
      const canBack = stack.length > 1;
      let bodyHtml = "";
      if (view === "home") bodyHtml = renderHomeBody();
      else if (view === "persona") bodyHtml = renderPersonaBody();
      else if (view === "album") bodyHtml = renderAlbumBody();
      else if (view === "invite-codes") bodyHtml = renderInviteCodesBody();
      else if (view === "chat-records") bodyHtml = renderChatRecordsBody();
      else if (view === "age-range") bodyHtml = renderAgeRangeBody();
      else if (view === "feedback") bodyHtml = renderFeedbackBody();
      else if (view === "help") bodyHtml = renderHelpBody();
      else if (view === "terms") bodyHtml = renderDocBody("terms");
      else if (view === "privacy") bodyHtml = renderDocBody("privacy");

      overlayEl.innerHTML = `
        <div class="settings-backdrop" data-action="close-overlay"></div>
        <div class="settings-sheet" data-view="${escapeHtml(view)}">
          <header class="settings-navbar">
            ${canBack
              ? `<button class="settings-nav-btn" type="button" aria-label="返回" data-action="back">‹</button>`
              : `<span class="settings-nav-spacer" aria-hidden="true"></span>`}
            <h2 class="settings-navbar__title">${escapeHtml(title)}</h2>
            <button class="settings-nav-btn settings-nav-btn--close" type="button" aria-label="关闭设置" data-action="close-overlay">×</button>
          </header>
          <div id="settings-inline-notice" class="settings-inline-notice" hidden></div>
          <div class="settings-body ${view === "help" ? "settings-body--flex" : ""}">
            ${bodyHtml}
          </div>
        </div>
      `;

      // 绑定实时输入事件（避免整页重绘导致焦点丢失）
      if (view === "feedback") {
        const ta = overlayEl.querySelector("#settings-fb-desc");
        const countEl = overlayEl.querySelector("#settings-fb-count");
        const submitBtn = overlayEl.querySelector('[data-action="submit-fb"]');
        if (ta) {
          ta.addEventListener("input", () => {
            fbDesc = ta.value;
            fbError = "";
            if (countEl) countEl.textContent = Array.from(fbDesc).length + "/500";
            if (submitBtn) {
              const ok = !!(fbType && fbDesc.trim() && fbConsent && !fbSubmitting);
              submitBtn.classList.toggle("is-disabled", !ok);
            }
          });
        }
      } else if (view === "chat-records") {
        const input = overlayEl.querySelector("#settings-chat-email");
        if (input) {
          input.addEventListener("input", () => {
            chatEmail = input.value;
            if (chatEmailErr) {
              chatEmailErr = "";
              input.classList.remove("is-error");
              const errEl = overlayEl.querySelector(".settings-field-error");
              if (errEl) errEl.remove();
            }
          });
        }
      } else if (view === "help") {
        const input = overlayEl.querySelector("#settings-help-input");
        if (input) {
          input.addEventListener("compositionstart", () => {
            helpComposing = true;
          });
          input.addEventListener("compositionend", () => {
            helpComposing = false;
            helpQuery = input.value;
            updateHelpSearchView();
          });
          input.addEventListener("input", () => {
            helpQuery = input.value;
            if (!helpComposing) {
              updateHelpSearchView();
            }
          });
        }
      }
    }

    function handleClick(event) {
      const target = event.target.closest("[data-action], [data-nav]");
      if (!target) return;

      const nav = target.getAttribute("data-nav");
      if (nav) {
        pushView(nav);
        return;
      }

      const action = target.getAttribute("data-action");
      if (action === "close-overlay") {
        // 阻止点击子弹窗内容区触发关闭
        if (event.target !== target && target.classList.contains("settings-backdrop")) return;
        onPlayTap();
        close();
        return;
      }
      if (action === "back") {
        popView();
        return;
      }
      if (action === "open-profile") {
        onPlayTap();
        close();
        onOpenProfile();
        return;
      }
      if (action === "open-album-keepsakes") {
        const petId = target.getAttribute("data-pet") || "";
        onPlayTap();
        close();
        if (onOpenHoloCard) {
          onOpenHoloCard(petId);
        } else {
          onOpenAlbum(petId);
        }
        return;
      }
      if (action === "toggle-sfx") {
        const next = !getSfxOn();
        setSfxOn(next);
        if (next) onPlayTap();
        persist();
        render();
        showNotice(next ? "互动音效已开启" : "互动音效已静音", "info");
        return;
      }
      if (action === "toggle-tick") {
        const next = !getTickNoiseOn();
        setTickNoiseOn(next);
        onPlayTap();
        persist();
        render();
        if (next && !getSfxOn()) {
          showNotice("呼噜滴答已开启（需同时开启互动音效才会发声）", "info");
        } else {
          showNotice(next ? "发条钟呼噜滴答已开启" : "发条钟呼噜滴答已关闭", "info");
        }
        return;
      }
      if (action === "copy-code") {
        const code = target.getAttribute("data-code") || "";
        copyText(code).then((ok) => showNotice(ok ? "激活码已复制" : "激活码：" + code, "info"));
        return;
      }
      if (action === "copy-email") {
        copyText(SUPPORT_EMAIL).then((ok) => showNotice(ok ? "邮箱已复制" : "客服邮箱：" + SUPPORT_EMAIL, "info"));
        return;
      }
      if (action === "switch-persona-pet") {
        const nextPet = target.getAttribute("data-pet") === "koi" ? "koi" : "yutu";
        if (personaPetId !== nextPet) {
          personaPetId = nextPet;
          onPlayTap();
          render();
        }
        return;
      }
      if (action === "select-persona") {
        const nextPersonaId = target.getAttribute("data-persona") || "";
        const store = getStore();
        const pid = personaPetId === "koi" ? "koi" : "yutu";
        if (!store || !store.pets || !store.pets[pid]) return;
        const resolved = Voice ? Voice.resolvePersonaId(pid, nextPersonaId) : nextPersonaId;
        store.pets[pid].personaId = resolved;
        persist();
        onPlayTap();
        onPersonaChange(pid, resolved);
        const petLabel = pid === "yutu" ? "玉兔" : "锦鲤";
        const pName = Voice ? Voice.getPersonaDef(resolved).name : resolved;
        render();
        showNotice(`${petLabel}已切换为「${pName}」`, "info");
        return;
      }
      if (action === "select-age") {
        if (ageSaving || ageToastVisible) return;
        ageSelected = target.getAttribute("data-value") || "";
        onPlayTap();
        render();
        return;
      }
      if (action === "save-age") {
        if (!ageSelected || ageSaving || ageToastVisible) return;
        const store = getStore();
        const res = Store && Store.setAgeRange
          ? Store.setAgeRange(store, ageSelected)
          : { ok: true, ageRange: ageSelected };
        if (!res || !res.ok) {
          showNotice((res && res.message) || "保存失败，请重试", "warning");
          return;
        }
        persist();
        onPlayTap();
        ageToastVisible = true;
        render();
        const token = ++ageReturnToken;
        ageReturnTimer = setTimeout(() => {
          ageReturnTimer = null;
          if (token !== ageReturnToken || !isOpen) return;
          ageToastVisible = false;
          if (stack.length > 1) {
            stack.pop();
            render();
          } else {
            close();
          }
          onShowSceneFeedback("年龄区间已保存", "system");
        }, 900);
        return;
      }
      if (action === "toggle-fb-type") {
        if (fbSubmitting) return;
        fbTypeOpen = !fbTypeOpen;
        fbError = "";
        onPlayTap();
        render();
        return;
      }
      if (action === "pick-fb-type") {
        if (fbSubmitting) return;
        fbType = target.getAttribute("data-value") || "";
        fbTypeOpen = false;
        fbError = "";
        onPlayTap();
        render();
        return;
      }
      if (action === "toggle-fb-consent") {
        if (fbSubmitting) return;
        fbConsent = !fbConsent;
        fbError = "";
        onPlayTap();
        render();
        return;
      }
      if (action === "open-fb-consent") {
        fbConsentModal = true;
        onPlayTap();
        render();
        return;
      }
      if (action === "close-fb-consent") {
        if (target.classList.contains("settings-subdialog-mask") && event.target !== target) return;
        fbConsentModal = false;
        render();
        return;
      }
      if (action === "agree-fb-consent") {
        fbConsent = true;
        fbConsentModal = false;
        fbError = "";
        onPlayTap();
        render();
        return;
      }
      if (action === "submit-fb") {
        if (fbSubmitting) return;
        if (!fbType) {
          fbError = "请选择诉求类型";
          render();
          return;
        }
        if (!fbDesc.trim()) {
          fbError = "请填写问题详细描述";
          render();
          return;
        }
        if (!fbConsent) {
          fbError = "请勾选同意知情同意书";
          render();
          return;
        }
        fbSubmitting = true;
        fbError = "";
        render();
        const payload = { type: fbType, description: fbDesc.trim(), consent: true };
        const token = ++submitRequestToken;
        feedbackDelayTimer = setTimeout(() => {
          feedbackDelayTimer = null;
          if (token !== submitRequestToken || !isOpen || currentView() !== "feedback") {
            fbSubmitting = false;
            return;
          }
          const store = getStore();
          const res = Store && Store.submitUserFeedback
            ? Store.submitUserFeedback(store, payload)
            : { ok: true, receiptNumber: "H5-FB-LOCAL-001" };
          fbSubmitting = false;
          if (!res || !res.ok) {
            fbError = (res && res.message) || "提交失败，请重试";
            render();
            return;
          }
          persist();
          fbType = "";
          fbDesc = "";
          fbConsent = false;
          fbTypeOpen = false;
          fbReceipt = res.receiptNumber;
          render();
          const body = overlayEl.querySelector(".settings-body");
          if (body) body.scrollTop = 0;
        }, 600);
        return;
      }
      if (action === "export-chat-email") {
        if (chatExporting) return;
        const norm = Store && Store.normalizeEmail ? Store.normalizeEmail(chatEmail) : chatEmail.trim().toLowerCase();
        const valid = Store && Store.validateEmail ? Store.validateEmail(norm) : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(norm);
        if (!valid) {
          chatEmailErr = "请输入有效的邮箱地址";
          render();
          return;
        }
        chatEmail = norm;
        chatEmailErr = "";
        chatExporting = true;
        render();
        const token = ++chatExportToken;
        chatExportTimer = setTimeout(() => {
          chatExportTimer = null;
          if (token !== chatExportToken || !isOpen || currentView() !== "chat-records") {
            chatExporting = false;
            return;
          }
          chatExporting = false;
          render();
          showNotice("导出申请已提交，请留意邮箱", "info");
        }, 450);
        return;
      }
      if (action === "export-chat-json") {
        try {
          const store = getStore() || {};
          const diaries = Array.isArray(store.diaries)
            ? store.diaries
            : (Array.isArray(store.diaryEntries) ? store.diaryEntries : []);
          const payload = {
            exportedAt: new Date().toISOString(),
            user: { nickname: store.user && store.user.nickname, publicId: store.user && store.user.publicId },
            diaries: diaries,
            listenHistory: Array.isArray(store.listenHistory) ? store.listenHistory : [],
            chatMessages: Array.isArray(store.chatMessages) ? store.chatMessages : []
          };
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "eggbabe-chat-records.json";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          showNotice("本地记录文件已开始下载", "info");
        } catch (e) {
          showNotice("当前环境不支持直接下载文件", "warning");
        }
        return;
      }
      if (action === "ask-delete-chat") {
        chatConfirmDelete = true;
        onPlayTap();
        render();
        return;
      }
      if (action === "cancel-delete-chat") {
        if (target.classList.contains("settings-subdialog-mask") && event.target !== target) return;
        chatConfirmDelete = false;
        render();
        return;
      }
      if (action === "confirm-delete-chat") {
        const store = getStore();
        if (Store && Store.clearLocalChatRecords) Store.clearLocalChatRecords(store);
        persist();
        chatConfirmDelete = false;
        render();
        showNotice("全部聊天记录已删除", "info");
        return;
      }
      if (action === "clear-help-search") {
        helpQuery = "";
        helpComposing = false;
        const input = overlayEl.querySelector("#settings-help-input");
        if (input) {
          input.value = "";
          if (input.focus) input.focus();
        }
        updateHelpSearchView();
        return;
      }
      if (action === "toggle-faq-cat") {
        const cat = target.getAttribute("data-cat");
        if (cat) {
          helpOpenCats[cat] = !helpOpenCats[cat];
          updateHelpSearchView();
        }
        return;
      }
      if (action === "toggle-faq-item") {
        const fKey = target.getAttribute("data-fkey");
        if (fKey) {
          helpOpenFaqs[fKey] = !helpOpenFaqs[fKey];
          updateHelpSearchView();
        }
        return;
      }
      if (action === "scroll-doc") {
        const targetId = target.getAttribute("data-target");
        const sec = targetId && overlayEl.querySelector("#" + targetId);
        if (sec && sec.scrollIntoView) {
          sec.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }

    function handleKeydown(event) {
      if (event.key === "Escape" && isOpen) {
        if (fbConsentModal) {
          fbConsentModal = false;
          render();
        } else if (chatConfirmDelete) {
          chatConfirmDelete = false;
          render();
        } else {
          popView();
        }
      }
    }

    function destroy() {
      close();
      if (overlayEl) {
        overlayEl.removeEventListener("click", handleClick);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeydown);
      }
    }

    if (overlayEl) {
      overlayEl.addEventListener("click", handleClick);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeydown);
    }

    return {
      open,
      close,
      destroy,
      pushView,
      popView,
      isOpen: () => isOpen,
      getCurrentView: currentView
    };
  }

  return {
    SUPPORT_EMAIL,
    HOTLINE,
    REALITY_HELP,
    FAQ_GROUPS,
    TERMS_SECTIONS,
    PRIVACY_SECTIONS,
    VIEW_TITLES,
    createSettingsPanel
  };
});
