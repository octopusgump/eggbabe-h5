#!/usr/bin/env python3
"""Idempotently inject the click-emote module (emotes.js) into the pet mesh demos.

    python3 assets/shared/emotes/patch_emotes.py           # patch both demos
    python3 assets/shared/emotes/patch_emotes.py --strip   # remove the injection only

Everything injected is wrapped in markers, so re-running first strips the old
injection (restoring the original bytes) and then injects the current version:
  * CSS block   /* EMOTES:BEGIN */ ... /* EMOTES:END */      (before </style>)
  * JS block    // EMOTES:BEGIN ... // EMOTES:END            (before "live state machine")
  * one-liners  /*EMO*/ ... /*EMO-END*/                      (render / tick / pointer / __demo)
Only insertions are made; no original line is modified.
"""
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
ASSETS = HERE.parent.parent

CSS = """/* EMOTES:BEGIN */
  .emo-bubble { position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none; transform: translate(-50%, -100%) scale(.86); transform-origin: var(--tail, 50%) 100%;
    padding: 7px 12px 8px; background: #fffdf8; color: #5a4636; font: 600 14px/1.35 "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
    border-radius: 14px; box-shadow: 0 4px 14px rgba(80,50,20,.18); white-space: nowrap; opacity: 0; transition: opacity .2s ease, transform .25s cubic-bezier(.3,1.6,.5,1); }
  .emo-bubble.show { opacity: 1; transform: translate(-50%, -100%) scale(1); }
  .emo-bubble::after { content: ""; position: absolute; left: var(--tail, 50%); bottom: -5px; width: 11px; height: 11px; background: #fffdf8; border-radius: 2px; transform: translateX(-50%) rotate(45deg); }
  .emo-fx { position: absolute; left: 0; top: 0; z-index: 3; pointer-events: none; opacity: 0; font: 800 18px/1 "PingFang SC", "Noto Sans CJK SC", sans-serif; white-space: nowrap;
    text-shadow: 0 1px 0 #fff, 0 0 4px rgba(255,255,255,.85); will-change: transform, opacity; }
  .emo-tear { width: 7px; height: 10px; border-radius: 50% 50% 50% 50% / 38% 38% 62% 62%; background: radial-gradient(circle at 38% 62%, #f2fbff 0, #8fcdf4 45%, #4f9fdc 100%); box-shadow: 0 0 2px rgba(255,255,255,.8); }
/* EMOTES:END */
"""

LINES = {
    "yutu": {
        "laugh": ["哈哈哈，好痒呀～", "嘿嘿，再来一次！", "笑得耳朵都抖啦"],
        "sad": ["呜…胡萝卜掉了", "没人陪我玩…", "心里空空的…"],
        "think": ["嗯…月亮上有什么呢？", "让我想想哦…", "今天吃什么好呢？"],
        "cute": ["抱抱我嘛～", "人家最可爱啦♡", "眯眯眼，看不见你啦"],
    },
    "koi": {
        "laugh": ["咕噜噜，笑出泡泡啦！", "哈哈，好运来啦～", "痒痒的，嘻嘻"],
        "sad": ["呜…泡泡破掉了", "鳍鳍好累哦…", "今天运气有点差…"],
        "think": ["咦？水面上是什么？", "让我咕噜一下…", "嗯…好运藏在哪？"],
        "cute": ["摸摸我，好运加倍♡", "转个圈给你看～", "嘿嘿，我最锦鲤啦"],
    },
}

# source px (same space as HEAD / NECK); pupils from dark connected components of the base texture
FACES = {
    "yutu": {
        "rect": [110, 395, 500, 650], "closedTex": True, "stalk": False,
        "eyes": [{"x": 221, "y": 523, "r": 27, "ex": 207, "ey": 519, "erx": 43, "ery": 52},
                 {"x": 383, "y": 524, "r": 27, "ex": 401, "ey": 519, "erx": 44, "ery": 51}],
        "mouth": {"x": 301, "y": 590, "w": 46, "h": 30}, "eraseMouth": None,
        "cheeks": [[165, 592], [437, 592]], "cheekR": 30,
        "browLen": 46, "browGap": 6, "gloom": {"x": 301, "y": 402, "w": 54, "h": 44},
        "lookUp": [4, -11], "bubble": {"x": 301, "y": -6},
        "anchors": {"L": [128, 455], "R": [474, 455], "top": [301, 300]},
    },
    "koi": {
        "rect": [130, 160, 480, 440], "closedTex": False, "stalk": True, "stalkK": 1.5,
        "eyes": [{"x": 220, "y": 279, "r": 27, "ex": 217, "ey": 276, "erx": 51, "ery": 57},
                 {"x": 373, "y": 279, "r": 27, "ex": 373, "ey": 277, "erx": 52, "ery": 56}],
        "mouth": {"x": 298, "y": 356, "w": 96, "h": 40},
        "eraseMouth": {"x0": 226, "y0": 328, "x1": 370, "y1": 386, "dy": 54},
        "cheeks": [[182, 350], [428, 350]], "cheekR": 28,
        "browLen": 46, "browGap": 8, "gloom": {"x": 298, "y": 166, "w": 54, "h": 38},
        "lookUp": [5, -14], "bubble": {"x": 302, "y": 12},
        "anchors": {"L": [108, 235], "R": [496, 235], "top": [384, 112]},
    },
}

TARGETS = {
    "yutu": ASSETS / "v2b" / "yutu_mesh_demo.html",
    "koi": ASSETS / "koi-v2b" / "koi_mesh_demo.html",
}


def strip(s: str) -> str:
    s = re.sub(r"/\* EMOTES:BEGIN \*/.*?/\* EMOTES:END \*/\n", "", s, flags=re.S)
    s = re.sub(r"  // EMOTES:BEGIN\n.*?  // EMOTES:END\n", "", s, flags=re.S)
    s = re.sub(r"/\*EMO\*/.*?/\*EMO-END\*/", "", s, flags=re.S)
    return s


def insert_before(s: str, anchor: str, text: str, start: int = 0, last: bool = False) -> str:
    i = s.rfind(anchor) if last else s.find(anchor, start)
    if i < 0 or (last and i < start):
        raise SystemExit("anchor not found: %r" % anchor)
    return s[:i] + text + s[i:]


def patch(pet: str, path: pathlib.Path) -> None:
    src = path.read_text(encoding="utf-8")
    s = strip(src)
    face = dict(FACES[pet], lines=LINES[pet])
    js = (HERE / "emotes.js").read_text(encoding="utf-8")
    js = js.replace("/*@FACE@*/null", json.dumps(face, ensure_ascii=False))
    if not js.endswith("\n"):
        js += "\n"

    s = insert_before(s, "</style>", CSS)
    s = insert_before(s, "  /* ---------- live state machine", "  // EMOTES:BEGIN\n" + js + "  // EMOTES:END\n")
    r = s.find("function render(")
    s = insert_before(s, "// accessories", "/*EMO*/drawFace(p, cr, sr);\n    /*EMO-END*/", start=r)
    tk = s.find("function tick(now)")
    s = insert_before(s, "const t = now - t0;", "/*EMO*/updateBubble(now);\n    /*EMO-END*/", start=tk)
    s = insert_before(s, 'else if (mode === "minihop")', '/*EMO*/else if (mode === "emote") tickEmote(now, t);\n    /*EMO-END*/', start=tk)
    pd = s.find('stage.addEventListener("pointerdown"')
    s = insert_before(s, 'if (mode !== "idle") return;', (
        '/*EMO*/if (mode === "emote") { ptr = { id: ev.pointerId, x0: h.stageX, t: performance.now(), face: h.face, side: h.x < CX ? -1 : 1, petting: false };'
        ' try { stage.setPointerCapture(ev.pointerId); } catch (e) {} return; }\n    /*EMO-END*/'), start=pd)
    up = s.find("function up(ev)")
    s = insert_before(s, 'if (now - p.t > 500 || mode !== "idle") return;',
                      '/*EMO*/if (now - p.t <= 500 && (mode === "idle" || mode === "emote")) { startEmote(now, p); return; }\n    /*EMO-END*/', start=up)
    s = insert_before(s, "})();\n</script>", (
        "/*EMO*/  window.__demo.emote = function (kind, side) { live = true; return startEmote(performance.now(), null, kind, side); };\n"
        "  window.__demo.seekEmote = seekEmote;\n  window.__demo.emoteKinds = EMO_KINDS;\n/*EMO-END*/"), last=True)
    path.write_text(s, encoding="utf-8")
    print("patched", path.relative_to(ASSETS.parent), "(%+d bytes vs original)" % (len(s) - len(strip(src))))


def main() -> None:
    for pet, path in TARGETS.items():
        if "--strip" in sys.argv:
            path.write_text(strip(path.read_text(encoding="utf-8")), encoding="utf-8")
            print("stripped", path)
        else:
            patch(pet, path)


if __name__ == "__main__":
    main()
