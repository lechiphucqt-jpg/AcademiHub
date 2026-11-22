import type { AccentPreset, Book, BrandingConfig, HubState } from '../types/academic';

export const HUB_SCHEMA_VERSION = '2.0.0';

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'cobalt', name: 'Cobalt Học Thuật', accent: '#1d4ed8', hover: '#1e40af' },
  { id: 'emerald', name: 'Lục Bảo Khoa Học', accent: '#047857', hover: '#065f46' },
  { id: 'indigo', name: 'Chàm Nghiên Cứu', accent: '#4338ca', hover: '#3730a3' },
  { id: 'burgundy', name: 'Đỏ Đô Nhân Văn', accent: '#9f1239', hover: '#881337' },
  { id: 'slate', name: 'Than Chì Tối Giản', accent: '#0f172a', hover: '#1e293b' },
];

export const DEFAULT_BRANDING: BrandingConfig = {
  appName: 'AcademiHub',
  institutionName: 'Hệ sinh thái Quản trị Sách Học thuật Tương tác',
  accentPresetId: 'cobalt',
  customAccentHex: '#1d4ed8',
  customAccentHoverHex: '#1e40af',
  logoDataUrl: null,
  themeMode: 'light',
};

const ENGLISH_CHORES_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unit 1: Household Chores — Ghép cặp Từ vựng Tương tác</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 24px;
      line-height: 1.5;
    }
    .container { max-width: 820px; margin: 0 auto; }
    .header {
      display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline;
      gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; margin-bottom: 20px;
    }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
    .subtitle { font-size: 13px; color: #475569; margin-top: 4px; }
    .score-box {
      font-size: 13px; font-weight: 600; color: #1d4ed8;
      font-variant-numeric: tabular-nums;
    }
    .grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .col-title {
      font-size: 12px; font-weight: 600; color: #64748b;
      margin-bottom: 10px; letter-spacing: 0.02em;
    }
    .card-list { display: flex; flex-direction: column; gap: 10px; }
    .item-btn {
      width: 100%; text-align: left; padding: 12px 14px;
      background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 14px; color: #0f172a; cursor: pointer;
      transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }
    .item-btn:hover:not(:disabled) { border-color: #1d4ed8; background: #eff6ff; }
    .item-btn.selected { border-color: #1d4ed8; background: #dbeafe; font-weight: 600; }
    .item-btn.matched {
      border-color: #059669; background: #ecfdf5; color: #065f46;
      cursor: default;
    }
    .item-btn.wrong { border-color: #dc2626; background: #fef2f2; color: #991b1b; }
    .phonetic { display: block; font-size: 12px; color: #64748b; font-weight: 400; margin-top: 2px; }
    .feedback {
      margin-top: 20px; padding: 14px 16px; border-radius: 8px;
      background: #ffffff; border: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
      font-size: 14px;
    }
    .reset-btn {
      padding: 8px 16px; border-radius: 6px; border: 1px solid #cbd5e1;
      background: #0f172a; color: #ffffff; font-size: 13px; font-weight: 500;
      cursor: pointer;
    }
    .reset-btn:hover { background: #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>Ghép cụm từ việc nhà (Household Chores)</h1>
        <p class="subtitle">Chọn 1 cụm từ tiếng Anh ở cột trái, sau đó chọn nghĩa tiếng Việt tương ứng ở cột phải.</p>
      </div>
      <div class="score-box" id="scoreLabel">Đã ghép: 0 / 6 · Chính xác: 0</div>
    </div>

    <div class="grid">
      <div>
        <div class="col-title">Cụm từ tiếng Anh</div>
        <div class="card-list" id="leftCol"></div>
      </div>
      <div>
        <div class="col-title">Nghĩa tiếng Việt</div>
        <div class="card-list" id="rightCol"></div>
      </div>
    </div>

    <div class="feedback">
      <div id="statusText">Sẵn sàng: Hãy chọn một cụm từ bên trái để bắt đầu.</div>
      <button class="reset-btn" id="resetBtn" type="button">Làm lại bài tập</button>
    </div>
  </div>

  <script>
    const PAIRS = [
      { id: 1, en: "do the heavy lifting", ipa: "/duː ðə ˈhevi ˈlɪftɪŋ/", vi: "làm những công việc nặng nhọc" },
      { id: 2, en: "do the laundry", ipa: "/duː ðə ˈlɔːndri/", vi: "giặt giũ quần áo" },
      { id: 3, en: "do the washing-up", ipa: "/duː ðə ˌwɒʃɪŋ ˈʌp/", vi: "rửa chén bát sau bữa ăn" },
      { id: 4, en: "put out the rubbish", ipa: "/pʊt aʊt ðə ˈrʌbɪʃ/", vi: "mang rác ra ngoài đổ" },
      { id: 5, en: "shop for groceries", ipa: "/ʃɒp fɔː ˈɡrəʊsəriz/", vi: "đi chợ / mua thực phẩm hàng ngày" },
      { id: 6, en: "breadwinner", ipa: "/ˈbredwɪnə(r)/", vi: "người trụ cột kiếm tiền trong gia đình" }
    ];

    let selectedLeft = null;
    let matchedIds = new Set();
    let attempts = 0;

    function shuffle(arr) {
      return [...arr].sort(() => Math.random() - 0.5);
    }

    let rightOrder = shuffle(PAIRS);

    function render() {
      const leftCol = document.getElementById("leftCol");
      const rightCol = document.getElementById("rightCol");
      leftCol.innerHTML = "";
      rightCol.innerHTML = "";

      PAIRS.forEach((p) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "item-btn" + (matchedIds.has(p.id) ? " matched" : selectedLeft === p.id ? " selected" : "");
        btn.disabled = matchedIds.has(p.id);
        btn.innerHTML = (matchedIds.has(p.id) ? "[Đúng] " : "") + p.en + '<span class="phonetic">' + p.ipa + "</span>";
        btn.onclick = () => {
          selectedLeft = p.id;
          document.getElementById("statusText").textContent = 'Đang chọn "' + p.en + '" — hãy chọn nghĩa tương ứng bên phải.';
          render();
        };
        leftCol.appendChild(btn);
      });

      rightOrder.forEach((p) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "item-btn" + (matchedIds.has(p.id) ? " matched" : "");
        btn.disabled = matchedIds.has(p.id);
        btn.textContent = (matchedIds.has(p.id) ? "[Đúng] " : "") + p.vi;
        btn.onclick = () => handleRightPick(p, btn);
        rightCol.appendChild(btn);
      });

      const scoreEl = document.getElementById("scoreLabel");
      scoreEl.textContent = "Đã ghép: " + matchedIds.size + " / " + PAIRS.length + " · Lượt thử: " + attempts;
    }

    function handleRightPick(rightPair, btnEl) {
      if (!selectedLeft) {
        document.getElementById("statusText").textContent = "Vui lòng chọn một cụm từ ở cột tiếng Anh trước.";
        return;
      }
      attempts++;
      if (selectedLeft === rightPair.id) {
        matchedIds.add(rightPair.id);
        selectedLeft = null;
        if (matchedIds.size === PAIRS.length) {
          document.getElementById("statusText").textContent =
            "Xuất sắc! Bạn đã hoàn thành toàn bộ 6/6 cặp từ sau " + attempts + " lượt thử.";
        } else {
          document.getElementById("statusText").textContent =
            'Chính xác! "' + rightPair.en + '" nghĩa là "' + rightPair.vi + '".';
        }
        render();
      } else {
        btnEl.classList.add("wrong");
        document.getElementById("statusText").textContent = "Chưa khớp. Hãy thử ghép lại cặp từ này.";
        setTimeout(() => {
          btnEl.classList.remove("wrong");
          render();
        }, 420);
      }
    }

    document.getElementById("resetBtn").onclick = () => {
      selectedLeft = null;
      matchedIds = new Set();
      attempts = 0;
      rightOrder = shuffle(PAIRS);
      document.getElementById("statusText").textContent = "Đã đặt lại bài tập. Hãy chọn cụm từ bên trái.";
      render();
    };

    render();
  </script>
</body>
</html>`;

const CARBON_SIMULATOR_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Carbon Footprint Interactive Lab</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc; color: #0f172a; padding: 24px;
    }
    .wrap { max-width: 820px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
    .lead { font-size: 13px; color: #475569; margin-bottom: 20px; }
    .layout { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 20px; }
    @media (max-width: 680px) { .layout { grid-template-columns: 1fr; } }
    .panel {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px;
    }
    .control { margin-bottom: 16px; }
    .control:last-child { margin-bottom: 0; }
    .label-row {
      display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 6px;
    }
    .val { font-variant-numeric: tabular-nums; color: #047857; }
    input[type="range"] { width: 100%; accent-color: #047857; cursor: pointer; }
    .metric-big {
      font-size: 36px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1;
    }
    .unit { font-size: 13px; color: #64748b; margin-top: 4px; }
    .status-line {
      margin-top: 14px; padding: 10px 12px; border-radius: 8px; font-size: 13px; font-weight: 600;
      border: 1px solid #e2e8f0;
    }
    .bars { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
    .bar-row { font-size: 12px; }
    .bar-meta { display: flex; justify-content: space-between; margin-bottom: 4px; color: #334155; }
    .track { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
    .fill { height: 100%; transition: width 0.2s ease; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Mô phỏng Dấu chân Carbon hàng tháng (Carbon Footprint Lab)</h1>
    <p class="lead">Điều chỉnh thói quen sinh hoạt bằng thanh trượt để quan sát lượng phát thải CO₂ ước tính và mức đánh giá môi trường.</p>
    <div class="layout">
      <div class="panel">
        <div class="control">
          <div class="label-row">
            <label for="elec">Điện năng tiêu thụ (kWh/tháng)</label>
            <span class="val" id="elecVal">180 kWh</span>
          </div>
          <input id="elec" type="range" min="40" max="600" step="10" value="180" />
        </div>
        <div class="control">
          <div class="label-row">
            <label for="moto">Di chuyển xe máy/ô tô (km/tuần)</label>
            <span class="val" id="motoVal">70 km</span>
          </div>
          <input id="moto" type="range" min="0" max="300" step="5" value="70" />
        </div>
        <div class="control">
          <div class="label-row">
            <label for="plastic">Chai nhựa dùng một lần (chai/tuần)</label>
            <span class="val" id="plasticVal">6 chai</span>
          </div>
          <input id="plastic" type="range" min="0" max="30" step="1" value="6" />
        </div>
        <div class="control">
          <div class="label-row">
            <label for="trees">Cây xanh chăm sóc / bù đắp (cây)</label>
            <span class="val" id="treesVal">2 cây</span>
          </div>
          <input id="trees" type="range" min="0" max="20" step="1" value="2" />
        </div>
      </div>

      <div class="panel">
        <div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:8px;">Tổng phát thải ròng ước tính</div>
        <div class="metric-big" id="totalCo2">0 kg</div>
        <div class="unit">CO₂ tương đương / tháng (tương đương <span id="treesNeeded">0</span> cây trưởng thành để hấp thụ)</div>
        <div class="status-line" id="ratingBox">Đánh giá: Mức xanh bền vững</div>
        <div class="bars">
          <div class="bar-row">
            <div class="bar-meta"><span>Điện năng (Electricity)</span><span id="bElec">0 kg</span></div>
            <div class="track"><div class="fill" id="fElec" style="background:#0284c7;width:0%"></div></div>
          </div>
          <div class="bar-row">
            <div class="bar-meta"><span>Giao thông (Transport)</span><span id="bMoto">0 kg</span></div>
            <div class="track"><div class="fill" id="fMoto" style="background:#d97706;width:0%"></div></div>
          </div>
          <div class="bar-row">
            <div class="bar-meta"><span>Rác thải nhựa (Single-use Plastic)</span><span id="bPlastic">0 kg</span></div>
            <div class="track"><div class="fill" id="fPlastic" style="background:#dc2626;width:0%"></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const ids = ["elec", "moto", "plastic", "trees"];
    function update() {
      const elec = Number(document.getElementById("elec").value);
      const moto = Number(document.getElementById("moto").value);
      const plastic = Number(document.getElementById("plastic").value);
      const trees = Number(document.getElementById("trees").value);

      document.getElementById("elecVal").textContent = elec + " kWh";
      document.getElementById("motoVal").textContent = moto + " km";
      document.getElementById("plasticVal").textContent = plastic + " chai";
      document.getElementById("treesVal").textContent = trees + " cây";

      const cElec = elec * 0.65;
      const cMoto = moto * 4.3 * 0.11;
      const cPlastic = plastic * 4.3 * 0.083;
      const offset = trees * 1.8;
      const total = Math.max(0, cElec + cMoto + cPlastic - offset);

      document.getElementById("totalCo2").textContent = total.toFixed(1) + " kg";
      document.getElementById("treesNeeded").textContent = Math.ceil(total / 1.8);

      const maxPart = Math.max(cElec, cMoto, cPlastic, 1);
      document.getElementById("bElec").textContent = cElec.toFixed(1) + " kg";
      document.getElementById("fElec").style.width = Math.min(100, (cElec / maxPart) * 100) + "%";
      document.getElementById("bMoto").textContent = cMoto.toFixed(1) + " kg";
      document.getElementById("fMoto").style.width = Math.min(100, (cMoto / maxPart) * 100) + "%";
      document.getElementById("bPlastic").textContent = cPlastic.toFixed(1) + " kg";
      document.getElementById("fPlastic").style.width = Math.min(100, (cPlastic / maxPart) * 100) + "%";

      const box = document.getElementById("ratingBox");
      if (total < 140) {
        box.style.background = "#ecfdf5"; box.style.borderColor = "#a7f3d0"; box.style.color = "#065f46";
        box.textContent = "Đánh giá: THẤP — Lối sống xanh, phát thải dưới ngưỡng trung bình.";
      } else if (total < 280) {
        box.style.background = "#fffbeb"; box.style.borderColor = "#fde68a"; box.style.color = "#92400e";
        box.textContent = "Đánh giá: TRUNG BÌNH — Nên tắt thiết bị chờ và tăng đi xe buýt/xe đạp.";
      } else {
        box.style.background = "#fef2f2"; box.style.borderColor = "#fecaca"; box.style.color = "#991b1b";
        box.textContent = "Đánh giá: CAO — Cần cắt giảm mạnh tiêu thụ điện giờ cao điểm và nhựa dùng 1 lần.";
      }
    }
    ids.forEach((id) => document.getElementById(id).addEventListener("input", update));
    update();
  </script>
</body>
</html>`;

const BOHR_EFFECT_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mô phỏng Hiệu ứng Bohr & Đường cong phân ly O₂-Hemoglobin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc; color: #0f172a; padding: 24px;
    }
    .wrap { max-width: 880px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .sub { font-size: 13px; color: #475569; margin-bottom: 18px; }
    .stage { display: grid; grid-template-columns: 1.35fr 0.85fr; gap: 18px; }
    @media (max-width: 720px) { .stage { grid-template-columns: 1fr; } }
    .card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;
    }
    .svg-box { width: 100%; height: auto; display: block; }
    .ctrl { margin-bottom: 16px; }
    .ctrl-top { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
    .num { font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; }
    input[type="range"] { width: 100%; accent-color: #0284c7; cursor: pointer; }
    .preset-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .preset-btn {
      padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px;
      border: 1px solid #cbd5e1; background: #f8fafc; color: #0f172a; cursor: pointer;
    }
    .preset-btn.active { background: #0284c7; border-color: #0284c7; color: #ffffff; }
    .readout {
      padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc;
      font-size: 13px; line-height: 1.55;
    }
    .eq {
      font-family: Georgia, serif; font-style: italic; font-size: 13px; color: #334155;
      margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Hiệu ứng Bohr: Ái lực gắn kết O₂ của Hemoglobin</h1>
    <p class="sub">Quan sát sự dịch chuyển đường cong phân ly Oxy-Hemoglobin khi pH máu thay đổi giữa trạng thái nghỉ và vận động cường độ cao.</p>

    <div class="stage">
      <div class="card">
        <svg id="chart" class="svg-box" viewBox="0 0 480 310" role="img" aria-label="Đồ thị đường cong phân ly Oxy-Hemoglobin">
          <rect x="52" y="20" width="405" height="235" fill="#f8fafc" stroke="#e2e8f0" />
          <g id="gridLines" stroke="#e2e8f0" stroke-width="1"></g>
          <!-- Reference normal pH 7.4 curve -->
          <path id="refCurve" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5,5" />
          <!-- Active curve -->
          <path id="activeCurve" fill="none" stroke="#0284c7" stroke-width="3" />
          <!-- Tissue pO2 = 40 mmHg marker -->
          <line x1="214" y1="20" x2="214" y2="255" stroke="#cbd5e1" stroke-dasharray="3,3" />
          <circle id="markerDot" cx="214" cy="100" r="6" fill="#0284c7" stroke="#ffffff" stroke-width="2" />
          <text x="255" y="294" text-anchor="middle" font-size="12" fill="#334155" font-weight="600">Phân áp Oxy — pO₂ (mmHg)</text>
          <text x="16" y="138" text-anchor="middle" font-size="12" fill="#334155" font-weight="600" transform="rotate(-90 16 138)">Độ bão hòa HbO₂ (%)</text>
          <text x="218" y="36" font-size="11" fill="#475569">Mô cơ nghỉ (40 mmHg)</text>
        </svg>
        <div class="eq">Phương trình cân bằng: Hb(O₂)₄ + H⁺ ⇌ HbH⁺ + 4 O₂ (Nét đứt xám: pH chuẩn 7.4)</div>
      </div>

      <div class="card">
        <div class="preset-row">
          <button type="button" class="preset-btn" data-ph="7.6" data-temp="36">Kiềm hóa (pH 7.6)</button>
          <button type="button" class="preset-btn active" data-ph="7.4" data-temp="37">Nghỉ ngơi (pH 7.4)</button>
          <button type="button" class="preset-btn" data-ph="7.2" data-temp="38.5">Chạy nước rút (pH 7.2)</button>
        </div>

        <div class="ctrl">
          <div class="ctrl-top">
            <label for="phSlider">Độ pH máu động mạch</label>
            <span class="num" id="phOut">7.40</span>
          </div>
          <input id="phSlider" type="range" min="7.0" max="7.6" step="0.05" value="7.4" />
        </div>

        <div class="ctrl">
          <div class="ctrl-top">
            <label for="tempSlider">Nhiệt độ mô cơ (°C)</label>
            <span class="num" id="tempOut">37.0 °C</span>
          </div>
          <input id="tempSlider" type="range" min="35" max="40" step="0.5" value="37" />
        </div>

        <div class="readout" id="summaryBox"></div>
      </div>
    </div>
  </div>

  <script>
    const grid = document.getElementById("gridLines");
    for (let i = 0; i <= 5; i++) {
      const y = 255 - i * 47;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", "52"); line.setAttribute("x2", "457");
      line.setAttribute("y1", y); line.setAttribute("y2", y);
      grid.appendChild(line);
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", "44"); t.setAttribute("y", y + 4);
      t.setAttribute("text-anchor", "end"); t.setAttribute("font-size", "11"); t.setAttribute("fill", "#64748b");
      t.textContent = (i * 20) + "%";
      grid.appendChild(t);
    }
    for (let j = 0; j <= 5; j++) {
      const x = 52 + j * 81;
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", x); t.setAttribute("y", "272");
      t.setAttribute("text-anchor", "middle"); t.setAttribute("font-size", "11"); t.setAttribute("fill", "#64748b");
      t.textContent = j * 20;
      grid.appendChild(t);
    }

    function hillSat(po2, p50) {
      const n = 2.7;
      const pn = Math.pow(po2, n);
      return (pn / (pn + Math.pow(p50, n))) * 100;
    }

    function buildPath(p50) {
      let d = "";
      for (let po2 = 0; po2 <= 100; po2 += 2) {
        const sat = hillSat(po2, p50);
        const x = 52 + (po2 / 100) * 405;
        const y = 255 - (sat / 100) * 235;
        d += (po2 === 0 ? "M " : " L ") + x.toFixed(1) + " " + y.toFixed(1);
      }
      return d;
    }

    document.getElementById("refCurve").setAttribute("d", buildPath(26.8));

    function render() {
      const ph = parseFloat(document.getElementById("phSlider").value);
      const temp = parseFloat(document.getElementById("tempSlider").value);
      document.getElementById("phOut").textContent = ph.toFixed(2);
      document.getElementById("tempOut").textContent = temp.toFixed(1) + " °C";

      const p50 = 26.8 * Math.pow(10, 0.48 * (7.4 - ph)) * Math.pow(10, 0.024 * (temp - 37));
      const satAt40 = hillSat(40, p50);
      const releasedAt40 = 100 - satAt40;

      const curve = document.getElementById("activeCurve");
      const dot = document.getElementById("markerDot");
      curve.setAttribute("d", buildPath(p50));

      const color = ph < 7.35 ? "#dc2626" : ph > 7.45 ? "#059669" : "#0284c7";
      curve.setAttribute("stroke", color);
      dot.setAttribute("fill", color);
      dot.setAttribute("cy", (255 - (satAt40 / 100) * 235).toFixed(1));

      const shiftLabel = ph < 7.35
        ? "DỊCH PHẢI (Giảm ái lực O₂ — tăng nhả O₂ cho cơ đang hoạt động)"
        : ph > 7.45
        ? "DỊCH TRÁI (Tăng ái lực O₂ — giữ chặt O₂ hơn)"
        : "TRẠNG THÁI CHUẨN (Cân bằng sinh lý bình thường)";

      document.getElementById("summaryBox").innerHTML =
        "<strong>Trạng thái:</strong> " + shiftLabel + "<br/>" +
        "<strong>Giá trị P₅₀:</strong> " + p50.toFixed(1) + " mmHg<br/>" +
        "<strong>Bão hòa tại mô (40 mmHg):</strong> " + satAt40.toFixed(1) + "% (nhả ra <strong>" + releasedAt40.toFixed(1) + "%</strong> lượng O₂).";
    }

    document.getElementById("phSlider").addEventListener("input", render);
    document.getElementById("tempSlider").addEventListener("input", render);
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("phSlider").value = btn.dataset.ph;
        document.getElementById("tempSlider").value = btn.dataset.temp;
        render();
      });
    });
    render();
  </script>
</body>
</html>`;

const PRISM_DISPERSION_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Thí nghiệm Tán sắc Ánh sáng qua Lăng kính</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc; color: #0f172a; padding: 24px;
    }
    .wrap { max-width: 840px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
    p.desc { font-size: 13px; color: #475569; margin-bottom: 18px; }
    .panel {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px;
      margin-bottom: 16px;
    }
    .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    @media (max-width: 600px) { .controls { grid-template-columns: 1fr; } }
    .lbl { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
    input[type="range"] { width: 100%; accent-color: #1d4ed8; cursor: pointer; }
    .metrics {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px;
      border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 13px;
    }
    .m-val { font-size: 18px; font-weight: 700; font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Phòng thí nghiệm Tán sắc Ánh sáng (Lăng kính Thủy tinh)</h1>
    <p class="desc">Thay đổi góc tới i₁ và góc chiết quang A để quan sát góc lệch D của tia đỏ (n = 1.51) và tia tím (n = 1.56).</p>
    <div class="panel">
      <svg viewBox="0 0 640 250" style="width:100%;height:auto;display:block;background:#0f172a;border-radius:8px;">
        <polygon points="320,30 210,220 430,220" fill="rgba(148,163,184,0.18)" stroke="#94a3b8" stroke-width="2" />
        <line id="incidentRay" x1="40" y1="140" x2="265" y2="125" stroke="#f8fafc" stroke-width="3" />
        <line id="redInside" x1="265" y1="125" x2="375" y2="125" stroke="#ef4444" stroke-width="2" />
        <line id="violetInside" x1="265" y1="125" x2="378" y2="136" stroke="#8b5cf6" stroke-width="2" />
        <line id="redOut" x1="375" y1="125" x2="600" y2="155" stroke="#ef4444" stroke-width="2.5" />
        <line id="greenOut" x1="376" y1="130" x2="600" y2="178" stroke="#22c55e" stroke-width="2" />
        <line id="violetOut" x1="378" y1="136" x2="600" y2="205" stroke="#8b5cf6" stroke-width="2.5" />
        <text x="64" y="122" fill="#e2e8f0" font-size="12">Chùm sáng trắng</text>
        <text x="530" y="148" fill="#fca5a5" font-size="12">Tia Đỏ</text>
        <text x="526" y="216" fill="#c4b5fd" font-size="12">Tia Tím</text>
      </svg>
    </div>

    <div class="panel">
      <div class="controls">
        <div>
          <div class="lbl"><label for="inc">Góc tới i₁</label><span id="incVal">45°</span></div>
          <input id="inc" type="range" min="30" max="70" step="1" value="45" />
        </div>
        <div>
          <div class="lbl"><label for="apex">Góc chiết quang A</label><span id="apexVal">60°</span></div>
          <input id="apex" type="range" min="40" max="65" step="1" value="60" />
        </div>
      </div>
      <div class="metrics">
        <div><div style="color:#64748b;font-size:12px;">Góc lệch tia Đỏ (Dđ)</div><div class="m-val" style="color:#dc2626;" id="dRed">38.2°</div></div>
        <div><div style="color:#64748b;font-size:12px;">Góc lệch tia Tím (Dt)</div><div class="m-val" style="color:#6d28d9;" id="dViolet">42.5°</div></div>
        <div><div style="color:#64748b;font-size:12px;">Góc tán sắc (ΔD)</div><div class="m-val" style="color:#1d4ed8;" id="deltaD">4.3°</div></div>
      </div>
    </div>
  </div>
  <script>
    function calcDeviation(i1Deg, ADeg, n) {
      const toRad = Math.PI / 180;
      const toDeg = 180 / Math.PI;
      const r1 = Math.asin(Math.sin(i1Deg * toRad) / n);
      const r2 = ADeg * toRad - r1;
      const sinI2 = n * Math.sin(r2);
      if (Math.abs(sinI2) >= 1) return null;
      const i2 = Math.asin(sinI2) * toDeg;
      return i1Deg + i2 - ADeg;
    }
    function update() {
      const i1 = Number(document.getElementById("inc").value);
      const A = Number(document.getElementById("apex").value);
      document.getElementById("incVal").textContent = i1 + "°";
      document.getElementById("apexVal").textContent = A + "°";

      const dR = calcDeviation(i1, A, 1.51);
      const dV = calcDeviation(i1, A, 1.56);

      document.getElementById("dRed").textContent = dR !== null ? dR.toFixed(1) + "°" : "Phản xạ TP";
      document.getElementById("dViolet").textContent = dV !== null ? dV.toFixed(1) + "°" : "Phản xạ TP";
      document.getElementById("deltaD").textContent = dR !== null && dV !== null ? (dV - dR).toFixed(1) + "°" : "—";

      const incY = 180 - (i1 - 30) * 1.6;
      document.getElementById("incidentRay").setAttribute("y1", incY.toFixed(1));
      const redY = dR !== null ? Math.min(238, 125 + dR * 1.35) : 235;
      const violetY = dV !== null ? Math.min(244, 125 + dV * 1.85) : 244;
      const greenY = (redY + violetY) / 2;
      document.getElementById("redOut").setAttribute("y2", redY.toFixed(1));
      document.getElementById("greenOut").setAttribute("y2", greenY.toFixed(1));
      document.getElementById("violetOut").setAttribute("y2", violetY.toFixed(1));
    }
    document.getElementById("inc").addEventListener("input", update);
    document.getElementById("apex").addEventListener("input", update);
    update();
  </script>
</body>
</html>`;

export const INITIAL_BOOKS: Book[] = [
  {
    id: 'book-eng-10',
    title: 'Tiếng Anh 10 — Global Success Interactive',
    subject: 'Ngoại ngữ',
    gradeLevel: 'Lớp 10 THPT',
    author: 'Tổ Biên soạn Học liệu Số',
    description:
      'Giáo trình Tiếng Anh lớp 10 tích hợp học liệu HTML5 tương tác trực quan cho từng Unit và Lesson, tối ưu hóa kỹ năng từ vựng, ngữ pháp và dự án thực tế.',
    coverImage: '/src/assets/images/book_cover_english_10_1795356527029.jpg',
    updatedAt: '2026-11-20T08:30:00.000Z',
    units: [
      {
        id: 'unit-eng-1',
        order: 1,
        title: 'Unit 1: Family Life',
        description: 'Từ vựng về chia sẻ việc nhà, vai trò thành viên gia đình và đối chiếu thì Hiện tại đơn – Hiện tại tiếp diễn.',
        lessons: [
          {
            id: 'lesson-eng-1-1',
            order: 1,
            title: 'Lesson 1: Vocabulary & Household Chores',
            summary: 'Luyện nhận diện cụm động từ về công việc gia đình qua mô-đun ghép cặp tương tác và tài liệu tóm tắt.',
            objectives: [
              'Ghi nhớ và phát âm chuẩn 6 cụm từ trọng tâm về việc nhà.',
              'Vận dụng cấu trúc chia sẻ trách nhiệm trong hội thoại gia đình.',
            ],
            contents: [
              {
                id: 'content-eng-1-1-html',
                title: 'Bài tập Ghép cặp Từ vựng Việc nhà (HTML5)',
                type: 'interactive-html',
                description: 'Học liệu tương tác HTML5 tự chứa, tự động xáo trộn đáp án và thống kê số lượt thử.',
                estimatedMinutes: 8,
                htmlContent: ENGLISH_CHORES_HTML,
                sourceFilename: 'unit1_lesson1_household_chores.html',
                updatedAt: '2026-11-20T08:30:00.000Z',
              },
              {
                id: 'content-eng-1-1-quiz',
                title: 'Kiểm tra nhanh Ngữ pháp & Từ vựng Unit 1',
                type: 'quiz',
                description: 'Bộ 3 câu hỏi trắc nghiệm kiểm tra mức độ hiểu bài ngay sau hoạt động ghép cặp.',
                estimatedMinutes: 5,
                updatedAt: '2026-11-20T08:30:00.000Z',
                quizQuestions: [
                  {
                    id: 'q1',
                    question: 'My father is the _____ of our family; he works hard to support all of us.',
                    options: ['homemaker', 'breadwinner', 'groceries', 'laundry'],
                    correctIndex: 1,
                    explanation: '"Breadwinner" chỉ người trụ cột kiếm thu nhập chính trong gia đình.',
                  },
                  {
                    id: 'q2',
                    question: 'Please _____ the rubbish before the garbage truck arrives at 7 p.m.',
                    options: ['do', 'make', 'put out', 'shop for'],
                    correctIndex: 2,
                    explanation: 'Cụm động từ chuẩn là "put out the rubbish" (mang rác ra ngoài đổ).',
                  },
                  {
                    id: 'q3',
                    question: 'Look! Minh _____ the washing-up while his sister is tidying the living room.',
                    options: ['does', 'is doing', 'did', 'do'],
                    correctIndex: 1,
                    explanation: 'Có dấu hiệu "Look!" diễn tả hành động đang diễn ra tại thời điểm nói → Present Continuous ("is doing").',
                  },
                ],
              },
              {
                id: 'content-eng-1-1-game',
                title: 'Đấu Trường Minigames Ôn Tập (Vòng quay, Tốc độ, Lật thẻ)',
                type: 'game',
                description: 'Trò chơi tương tác ôn luyện từ vựng và phản xạ tiếng Anh thời gian thực.',
                estimatedMinutes: 6,
                updatedAt: '2026-11-22T08:30:00.000Z',
                quizQuestions: [
                  {
                    id: 'gq1',
                    question: 'Which word means "the person who earns money to support their family"?',
                    options: ['Breadwinner', 'Homemaker', 'Shopkeeper', 'Babysitter'],
                    correctIndex: 0,
                    explanation: 'Breadwinner is the primary earner of financial support for a family.',
                  },
                  {
                    id: 'gq2',
                    question: 'Complete the collocation: "_____ the heavy lifting"',
                    options: ['Do', 'Make', 'Take', 'Put'],
                    correctIndex: 0,
                    explanation: '"Do the heavy lifting" means doing the most difficult work.',
                  },
                  {
                    id: 'gq3',
                    question: 'Opposite of "pessimistic" is:',
                    options: ['Optimistic', 'Careful', 'Persistent', 'Honest'],
                    correctIndex: 0,
                    explanation: 'Optimistic (lạc quan) is the antonym of pessimistic (bi quan).',
                  },
                  {
                    id: 'gq4',
                    question: 'What is the correct phrasal verb: "_____ after your younger brother"?',
                    options: ['Look', 'See', 'Watch', 'Find'],
                    correctIndex: 0,
                    explanation: '"Look after" means to take care of someone.',
                  },
                ],
              },
            ],
          },
          {
            id: 'lesson-eng-1-2',
            order: 2,
            title: 'Lesson 2: Present Simple vs. Present Continuous',
            summary: 'Hệ thống hóa dấu hiệu nhận biết và các động từ trạng thái (stative verbs) không chia tiếp diễn.',
            objectives: [
              'Phân biệt thói quen lặp lại với hành động đang diễn ra.',
              'Tránh lỗi chia tiếp diễn với nhóm động từ tri giác/trạng thái.',
            ],
            contents: [
              {
                id: 'content-eng-1-2-read',
                title: 'Tài liệu Hệ thống Ngữ pháp Trọng tâm',
                type: 'reading',
                description: 'Bản tóm tắt cấu trúc, dấu hiệu nhận biết và ví dụ đối chiếu chuẩn hóa.',
                estimatedMinutes: 6,
                updatedAt: '2026-11-20T08:45:00.000Z',
                readingMarkdown: `### 1. Present Simple (Hiện tại đơn)
Dùng cho **thói quen hàng ngày**, lịch trình cố định hoặc sự thật hiển nhiên.
- Công thức: \`S + V(s/es)\`
- Dấu hiệu: *every day, usually, often, twice a week*.
- Ví dụ: *My mother usually cooks dinner at 6 p.m.*

### 2. Present Continuous (Hiện tại tiếp diễn)
Dùng cho **hành động đang xảy ra ngay lúc nói** hoặc kế hoạch tạm thời trong tuần/tháng này.
- Công thức: \`S + am/is/are + V-ing\`
- Dấu hiệu: *now, at the moment, Look!, Listen!, today*.
- Ví dụ: *Today my mother is busy, so my dad is cooking dinner.*

### 3. Lưu ý về Stative Verbs
Các động từ chỉ trạng thái (*know, believe, love, want, need*) thường **không** dùng ở dạng tiếp diễn.`,
              },
            ],
          },
        ],
      },
      {
        id: 'unit-eng-2',
        order: 2,
        title: 'Unit 2: Humans and the Environment',
        description: 'Chủ đề sống xanh, đo lường dấu chân carbon và hành động giảm rác thải nhựa học đường.',
        lessons: [
          {
            id: 'lesson-eng-2-1',
            order: 1,
            title: 'Lesson 1: Carbon Footprint Simulator',
            summary: 'Mô hình tính toán tương tác giúp học sinh liên hệ trực tiếp từ vựng môi trường với dữ liệu sinh hoạt thực tế.',
            objectives: [
              'Hiểu khái niệm Carbon Footprint và các nguồn phát thải CO₂ phổ biến.',
              'Thảo luận giải pháp giảm phát thải dựa trên kết quả mô phỏng.',
            ],
            contents: [
              {
                id: 'content-eng-2-1-html',
                title: 'Bộ Mô phỏng Dấu chân Carbon (HTML5 Interactive)',
                type: 'interactive-html',
                description: 'Điều chỉnh thông số điện, giao thông, chai nhựa và số cây xanh để tính CO₂ theo thời gian thực.',
                estimatedMinutes: 10,
                htmlContent: CARBON_SIMULATOR_HTML,
                sourceFilename: 'unit2_lesson1_carbon_simulator.html',
                updatedAt: '2026-11-21T09:00:00.000Z',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'book-bio-11',
    title: 'Sinh Học 11 — Cơ Chế Sinh Lý Tương Tác',
    subject: 'Khoa học Tự nhiên',
    gradeLevel: 'Lớp 11 THPT',
    author: 'Nhóm Nghiên cứu STEM Sinh học',
    description:
      'Bộ sách học thuật chuyên sâu về trao đổi khí, tuần hoàn và cảm ứng sinh vật với mô phỏng đồ thị sinh lý học tương tác trực tiếp trên trình duyệt.',
    coverImage: '/src/assets/images/book_cover_biology_11_1795356526032.jpg',
    updatedAt: '2026-11-21T10:15:00.000Z',
    units: [
      {
        id: 'unit-bio-1',
        order: 1,
        title: 'Chương 1: Trao đổi chất và Hô hấp ở Động vật',
        description: 'Cơ chế vận chuyển O₂ và CO₂ trong máu, điều hòa ái lực Hemoglobin theo pH và nhiệt độ mô.',
        lessons: [
          {
            id: 'lesson-bio-1-1',
            order: 1,
            title: 'Bài 1: Hiệu ứng Bohr & Đường cong phân ly HbO₂',
            summary: 'Khám phá trực quan sự dịch chuyển đường cong phân ly Oxy-Hemoglobin qua mô phỏng SVG tương tác.',
            objectives: [
              'Giải thích nguyên nhân đường cong phân ly dịch phải khi vận động mạnh.',
              'Đọc và phân tích chỉ số P₅₀ trên đồ thị bão hòa Oxy.',
            ],
            contents: [
              {
                id: 'content-bio-1-1-html',
                title: 'Mô phỏng Đồ thị Hiệu ứng Bohr (SVG Interactive)',
                type: 'interactive-html',
                description: 'Thay đổi pH máu (7.0 – 7.6) và nhiệt độ mô để xem đồ thị Hill dịch chuyển tức thời.',
                estimatedMinutes: 12,
                htmlContent: BOHR_EFFECT_HTML,
                sourceFilename: 'chuong1_bai1_bohr_effect_lab.html',
                updatedAt: '2026-11-21T10:15:00.000Z',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'book-phy-12',
    title: 'Vật Lý 12 — Quang Học & Sóng Tương Tác',
    subject: 'Vật Lý',
    gradeLevel: 'Lớp 12 THPT',
    author: 'Phòng Thí nghiệm Quang học Số',
    description:
      'Hệ thống thí nghiệm ảo về tán sắc ánh sáng, giao thoa khe Young và lượng tử ánh sáng giúp học sinh kiểm chứng định luật ngay trong sách.',
    coverImage: '/src/assets/images/book_cover_physics_12_1795356527151.jpg',
    updatedAt: '2026-11-21T14:20:00.000Z',
    units: [
      {
        id: 'unit-phy-1',
        order: 1,
        title: 'Chương 1: Sóng Ánh sáng & Tán sắc',
        description: 'Phân tích sự phụ thuộc của chiết suất thủy tinh theo bước sóng và góc lệch qua lăng kính.',
        lessons: [
          {
            id: 'lesson-phy-1-1',
            order: 1,
            title: 'Bài 1: Thí nghiệm Tán sắc qua Lăng kính',
            summary: 'Điều chỉnh góc tới và góc chiết quang để đo góc lệch tia đỏ, tia tím và góc tán sắc.',
            objectives: [
              'So sánh góc lệch của tia đỏ và tia tím khi truyền qua cùng lăng kính.',
              'Quan sát điều kiện xảy ra hiện tượng phản xạ toàn phần ở mặt bên thứ hai.',
            ],
            contents: [
              {
                id: 'content-phy-1-1-html',
                title: 'Phòng Thí nghiệm Tán sắc Lăng kính (HTML5)',
                type: 'interactive-html',
                description: 'Mô phỏng đường truyền tia sáng trắng và góc lệch định lượng theo công thức Snell.',
                estimatedMinutes: 10,
                htmlContent: PRISM_DISPERSION_HTML,
                sourceFilename: 'chuong1_bai1_prism_dispersion.html',
                updatedAt: '2026-11-21T14:20:00.000Z',
              },
              {
                id: 'content-phy-1-1-sim',
                title: 'Phòng Thí Nghiệm Số: Chuyển Động Ném Xiên & Con Lắc (STEM)',
                type: 'simulation',
                simulationType: 'physics-projectile',
                description: 'Mô phỏng động học tương tác cao: thay đổi vận tốc ban đầu, góc bắn và gia tốc trọng trường.',
                estimatedMinutes: 10,
                updatedAt: '2026-11-22T09:00:00.000Z',
              },
            ],
          },
        ],
      },
    ],
  },
];

export const INITIAL_HUB_STATE: HubState = {
  schemaVersion: HUB_SCHEMA_VERSION,
  branding: DEFAULT_BRANDING,
  books: INITIAL_BOOKS,
};
