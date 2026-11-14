export type MeadowUI = {
  root: HTMLElement
  liveEl: HTMLElement
  sheepCountEl: HTMLElement
}

export function mountUI(): MeadowUI {
  const root = document.getElementById('ui')
  if (!root) throw new Error('#ui missing')

  root.innerHTML = `
    <div class="top">
      <div class="brand-row">
        <div style="display:flex;gap:10px;align-items:flex-start">
          <div class="brand-icon" aria-hidden="true"></div>
          <div class="brand-text">
            <h1>蛋宝宝牧场</h1>
            <p>小小草场，各走各的</p>
          </div>
        </div>
        <div class="status-col">
          <div class="live" id="live">
            <span class="live-dot"></span>
            <span>草场进行中</span>
          </div>
        </div>
      </div>
      <a class="chip-link" href="/eggbabe-h5/yutu-house/yutu_house_demo.html">回玉兔小屋</a>
    </div>
    <div class="notes">
      <div class="kicker">牧场手记 · 001</div>
      <div class="quote">静一点，也很好。</div>
    </div>
    <div class="hint">拖羊移位</div>
    <div class="counter">
      <div class="num" id="sheep-num">11</div>
      <div class="label">草场羊只</div>
    </div>
  `

  const liveEl = root.querySelector('#live') as HTMLElement
  const sheepCountEl = root.querySelector('#sheep-num') as HTMLElement

  return { root, liveEl, sheepCountEl }
}