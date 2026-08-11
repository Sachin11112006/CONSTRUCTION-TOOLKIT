// ===== Tab switching =====
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ===== Unit labels for display =====
const UNIT_SHORT = {
  millimeter: 'mm',
  centimeter: 'cm',
  meter: 'm',
  kilometer: 'km',
  inch: 'in',
  feet: 'ft',
};

function fmt(num) {
  // Trim to a reasonable number of significant digits without ugly trailing zeros
  if (!isFinite(num)) return String(num);
  const rounded = Math.abs(num) >= 1000 ? num.toFixed(2) : num.toPrecision(6);
  return parseFloat(rounded).toString();
}

// ===== Unit Converter =====
const swapBtn = document.getElementById('swap-btn');
const fromUnitEl = document.getElementById('from_unit');
const toUnitEl = document.getElementById('to_unit');
const convertBtn = document.getElementById('convert-btn');
const convertResult = document.getElementById('convert-result');

swapBtn.addEventListener('click', () => {
  const tmp = fromUnitEl.value;
  fromUnitEl.value = toUnitEl.value;
  toUnitEl.value = tmp;
});

convertBtn.addEventListener('click', async () => {
  const value = document.getElementById('value').value;
  const from_unit = fromUnitEl.value;
  const to_unit = toUnitEl.value;

  if (value === '') {
    convertResult.innerHTML = '<span class="error-line">Enter a value to convert.</span>';
    return;
  }

  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, from_unit, to_unit }),
    });
    const data = await res.json();

    if (!res.ok) {
      convertResult.innerHTML = `<span class="error-line">${data.error}</span>`;
      return;
    }

    convertResult.innerHTML =
      `<span class="label">${fmt(parseFloat(value))} ${UNIT_SHORT[from_unit]} =</span> ` +
      `<span class="value-line">${fmt(data.result)} ${UNIT_SHORT[to_unit]}</span>`;
  } catch (err) {
    convertResult.innerHTML = '<span class="error-line">Could not reach the server.</span>';
  }
});

// ===== Perimeter & Area Calculator =====
const calcBtn = document.getElementById('calculate-btn');
const calcResult = document.getElementById('calculate-result');

calcBtn.addEventListener('click', async () => {
  const length = document.getElementById('length').value;
  const breadth = document.getElementById('breadth').value;
  const input_unit = document.getElementById('calc_input_unit').value;
  const output_unit = document.getElementById('calc_output_unit').value;

  if (length === '' || breadth === '') {
    calcResult.innerHTML = '<span class="error-line">Enter both length and breadth.</span>';
    return;
  }

  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ length, breadth, input_unit, output_unit }),
    });
    const data = await res.json();

    if (!res.ok) {
      calcResult.innerHTML = `<span class="error-line">${data.error}</span>`;
      return;
    }

    const u = UNIT_SHORT[data.output_unit];
    calcResult.innerHTML =
      `<span class="label">Perimeter:</span> <span class="value-line">${fmt(data.perimeter)} ${u}</span><br>` +
      `<span class="label">Area:</span> <span class="value-line">${fmt(data.area)} ${u}&sup2;</span>`;
  } catch (err) {
    calcResult.innerHTML = '<span class="error-line">Could not reach the server.</span>';
  }
});

// ===== Multiple Shapes (list + totals) =====
const rowsContainer = document.getElementById('rows-container');
const addRowBtn = document.getElementById('add-row-btn');
const calcAllBtn = document.getElementById('calculate-all-btn');
const multiResult = document.getElementById('multi-result');

let rowCounter = 0;

function unitOptionsHtml(selectedKey) {
  return Object.entries(UNIT_SHORT)
    .map(([key, short]) => `<option value="${key}" ${key === selectedKey ? 'selected' : ''}>${short}</option>`)
    .join('');
}

function addRow(defaultUnit = 'meter') {
  rowCounter += 1;
  const row = document.createElement('div');
  row.className = 'calc-row';
  row.dataset.rowId = rowCounter;
  row.innerHTML = `
    <input type="number" step="any" inputmode="decimal" class="row-length" placeholder="Length">
    <input type="number" step="any" inputmode="decimal" class="row-breadth" placeholder="Breadth">
    <select class="row-unit">${unitOptionsHtml(defaultUnit)}</select>
    <button type="button" class="row-remove" title="Remove shape">×</button>
  `;
  rowsContainer.appendChild(row);
  updateRemoveButtons();
}

function updateRemoveButtons() {
  const rows = rowsContainer.querySelectorAll('.calc-row');
  rows.forEach(row => {
    const btn = row.querySelector('.row-remove');
    btn.disabled = rows.length === 1;
  });
}

rowsContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('row-remove')) {
    const rows = rowsContainer.querySelectorAll('.calc-row');
    if (rows.length > 1) {
      e.target.closest('.calc-row').remove();
      updateRemoveButtons();
    }
  }
});

addRowBtn.addEventListener('click', () => addRow());

// Start with two rows so the "list" behavior is obvious right away
addRow();
addRow();

calcAllBtn.addEventListener('click', async () => {
  const output_unit = document.getElementById('multi_output_unit').value;
  const rows = rowsContainer.querySelectorAll('.calc-row');

  const entries = Array.from(rows).map(row => ({
    length: row.querySelector('.row-length').value,
    breadth: row.querySelector('.row-breadth').value,
    input_unit: row.querySelector('.row-unit').value,
  }));

  const hasEmpty = entries.some(en => en.length === '' || en.breadth === '');
  if (hasEmpty) {
    multiResult.innerHTML = '<span class="error-line">Fill in length and breadth for every shape.</span>';
    return;
  }

  try {
    const res = await fetch('/api/calculate_batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, output_unit }),
    });
    const data = await res.json();

    if (!res.ok) {
      multiResult.innerHTML = `<span class="error-line">${data.error}</span>`;
      return;
    }

    const u = UNIT_SHORT[data.output_unit];

    const tableRows = data.results.map((r, i) => `
      <tr>
        <td>#${i + 1}</td>
        <td>${fmt(r.length)} ${UNIT_SHORT[r.input_unit]} × ${fmt(r.breadth)} ${UNIT_SHORT[r.input_unit]}</td>
        <td>${fmt(r.perimeter)} ${u}</td>
        <td>${fmt(r.area)} ${u}&sup2;</td>
      </tr>
    `).join('');

    multiResult.innerHTML = `
      <div class="table-scroll">
        <table class="result-table">
          <thead>
            <tr><th>#</th><th>Dimensions</th><th>Perimeter</th><th>Area</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div class="totals-line">
        <span class="label">Total perimeter</span>
        <span class="value-line">${fmt(data.total_perimeter)} ${u}</span>
      </div>
      <div class="totals-line">
        <span class="label">Total area</span>
        <span class="value-line">${fmt(data.total_area)} ${u}&sup2;</span>
      </div>
    `;
  } catch (err) {
    multiResult.innerHTML = '<span class="error-line">Could not reach the server.</span>';
  }
});

// ===== Calculator =====
const calcDisplay = document.getElementById('calc-display');
const calcButtons = document.querySelectorAll('.calc-btn');

let calcState = {
  current: '0',      // string shown on screen / being typed
  previous: null,     // number waiting to be combined
  operator: null,      // pending operator: +, -, *, /
  startFresh: false,  // true right after pressing an operator or "="
};

function calcRender() {
  calcDisplay.textContent = calcState.current;
  calcButtons.forEach(btn => {
    if (btn.dataset.action === 'op') {
      btn.classList.toggle('is-active', btn.dataset.op === calcState.operator);
    }
  });
}

function calcInputDigit(d) {
  if (calcState.startFresh) {
    calcState.current = d;
    calcState.startFresh = false;
    return;
  }
  calcState.current = calcState.current === '0' ? d : calcState.current + d;
}

function calcInputDecimal() {
  if (calcState.startFresh) {
    calcState.current = '0.';
    calcState.startFresh = false;
    return;
  }
  if (!calcState.current.includes('.')) {
    calcState.current += '.';
  }
}

function calcApplyOperator(a, b, op) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? NaN : a / b;
    default: return b;
  }
}

function calcSetOperator(op) {
  if (calcState.operator && !calcState.startFresh) {
    // Chain: resolve the pending operation first
    const result = calcApplyOperator(calcState.previous, parseFloat(calcState.current), calcState.operator);
    calcState.previous = result;
    calcState.current = calcNumToStr(result);
  } else {
    calcState.previous = parseFloat(calcState.current);
  }
  calcState.operator = op;
  calcState.startFresh = true;
}

function calcEquals() {
  if (calcState.operator === null || calcState.previous === null) return;
  const result = calcApplyOperator(calcState.previous, parseFloat(calcState.current), calcState.operator);
  calcState.current = calcNumToStr(result);
  calcState.previous = null;
  calcState.operator = null;
  calcState.startFresh = true;
}

function calcNumToStr(num) {
  if (Number.isNaN(num)) return 'Error';
  if (!isFinite(num)) return 'Error';
  // Avoid long floating point tails, but keep precision
  const rounded = Math.round(num * 1e10) / 1e10;
  return rounded.toString();
}

function calcClear() {
  calcState = { current: '0', previous: null, operator: null, startFresh: false };
}

function calcBackspace() {
  if (calcState.startFresh) return;
  calcState.current = calcState.current.length > 1 ? calcState.current.slice(0, -1) : '0';
}

function calcSign() {
  if (calcState.current === '0') return;
  calcState.current = calcState.current.startsWith('-')
    ? calcState.current.slice(1)
    : '-' + calcState.current;
}

function calcPercent() {
  const num = parseFloat(calcState.current) / 100;
  calcState.current = calcNumToStr(num);
}

calcButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.digit !== undefined) {
      calcInputDigit(btn.dataset.digit);
    } else {
      switch (btn.dataset.action) {
        case 'clear': calcClear(); break;
        case 'backspace': calcBackspace(); break;
        case 'sign': calcSign(); break;
        case 'percent': calcPercent(); break;
        case 'decimal': calcInputDecimal(); break;
        case 'op': calcSetOperator(btn.dataset.op); break;
        case 'equals': calcEquals(); break;
      }
    }
    calcRender();
  });
});

// Keyboard support while the Calculator tab is open
document.addEventListener('keydown', (e) => {
  const calcTab = document.getElementById('calc');
  if (!calcTab.classList.contains('active')) return;

  if (e.key >= '0' && e.key <= '9') {
    calcInputDigit(e.key);
  } else if (e.key === '.') {
    calcInputDecimal();
  } else if (['+', '-', '*', '/'].includes(e.key)) {
    calcSetOperator(e.key);
  } else if (e.key === 'Enter' || e.key === '=') {
    e.preventDefault();
    calcEquals();
  } else if (e.key === 'Backspace') {
    calcBackspace();
  } else if (e.key === 'Escape') {
    calcClear();
  } else {
    return;
  }
  calcRender();
});

// ===== PWA: service worker + install prompt =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline caching unavailable — app still works online */ });
  });
}

(function setupInstallBanner() {
  const banner = document.getElementById('install-banner');
  const installBtn = document.getElementById('install-btn');
  const dismissBtn = document.getElementById('install-dismiss');
  const bannerText = document.getElementById('install-banner-text');

  if (!banner || !installBtn || !dismissBtn) return;

  const DISMISS_KEY = 'installBannerDismissed';
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true; // iOS Safari

  if (isStandalone || sessionStorage.getItem(DISMISS_KEY)) {
    return; // already installed, or user dismissed this session
  }

  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  let deferredPrompt = null;

  dismissBtn.addEventListener('click', () => {
    banner.hidden = true;
    sessionStorage.setItem(DISMISS_KEY, '1');
  });

  if (isIOS) {
    // iOS Safari has no install API — guide the user to the manual step.
    bannerText.textContent = 'Install this app: tap the Share icon, then "Add to Home Screen".';
    installBtn.hidden = true;
    banner.hidden = false;
    return;
  }

  // Chrome / Edge / Android: capture the native prompt and trigger it ourselves.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    banner.hidden = false;
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    banner.hidden = true;
  });
})();
