/* ================================
   MAIN
================================ */
async function run() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) {
    alert("Please upload an Excel file first.");
    return;
  }

  const curveType =
    document.querySelector('input[name="curveType"]:checked').value;

  const data = await readExcel(file);

  let epiData = [];
  let title = "";

  if (curveType === "weekly") {
    epiData = aggregateWeeklyOnset(
      data,
      "Epid Tahun (Tkh Onset)",
      "Epid Minggu (Tkh Onset)"
    );
    title = "Food Poisoning Epidemic Curve (Weekly, Onset-based)";
  }

  if (curveType === "daily") {
    epiData = aggregateDailyOnset(data, "Tarikh Onset");
    title = "Food Poisoning Epidemic Curve (Date of Onset)";
  }

  plotEpi(epiData, title, curveType);
}

/* ================================
   READ EXCEL
================================ */
function readExcel(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      resolve(XLSX.utils.sheet_to_json(sheet));
    };
    reader.readAsBinaryString(file);
  });
}

/* ================================
   WEEKLY (ONSET)
================================ */
function aggregateWeeklyOnset(data, yearCol, weekCol) {
  const map = {};

  data.forEach(row => {
    const year = row[yearCol];
    const week = row[weekCol];
    if (!year || !week) return;

    const key = `${year}-W${week}`;
    map[key] = (map[key] || 0) + 1;
  });

  return Object.entries(map)
    .map(([k, v]) => {
      const [year, week] = k.split("-W");
      return { label: `W${week}`, value: v };
    })
    .sort((a, b) =>
      parseInt(a.label.replace("W", "")) -
      parseInt(b.label.replace("W", ""))
    );
}

/* ================================
   DAILY (ONSET DATE)
================================ */
function aggregateDailyOnset(data, dateCol) {
  const map = {};

  data.forEach(row => {
    const rawDate = row[dateCol];
    if (!rawDate) return;

    const date = new Date(rawDate);
    if (isNaN(date)) return;

    const key = date.toISOString().split("T")[0];
    map[key] = (map[key] || 0) + 1;
  });

  return Object.entries(map)
    .map(([k, v]) => ({ label: k, value: v }))
    .sort((a, b) => new Date(a.label) - new Date(b.label));
}

/* ================================
   STATS
================================ */
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sd(arr) {
  const m = mean(arr);
  return Math.sqrt(
    arr.reduce((s, x) => s + Math.pow(x - m, 2), 0) /
    (arr.length - 1)
  );
}

/* ================================
   SUMMARY (EN + BM)
================================ */
function generateSummary(labels, values, m, s, curveType) {
  const action = m + 2 * s;
  const exceed = labels.filter((_, i) => values[i] > action);

  const unitEN =
    curveType === "weekly"
      ? "epidemiological week(s)"
      : "date(s)";

  const unitBM =
    curveType === "weekly"
      ? "minggu epidemiologi"
      : "tarikh";

  if (exceed.length === 0) {
    return {
      en:
        "No epidemiological week/date exceeded the Action Line. " +
        "No outbreak signal was detected.",
      bm:
        "Tiada minggu epidemiologi atau tarikh yang melepasi Garisan Tindakan. " +
        "Tiada isyarat wabak dikesan."
    };
  }

  return {
    en:
      "Cases exceeded the Action Line in " +
      unitEN +
      ": " +
      exceed.join(", ") +
      ", suggesting possible outbreak(s) requiring further investigation.",

    bm:
      "Bilangan kes melepasi Garisan Tindakan pada " +
      unitBM +
      " " +
      exceed.join(", ") +
      ", menunjukkan kemungkinan kejadian wabak yang memerlukan siasatan lanjut."
  };
}

/* ================================
   PLOT
================================ */
function plotEpi(data, title, curveType) {
  const x = data.map(d => d.label);
  const y = data.map(d => d.value);

  const m = mean(y);
  const s = sd(y);
  const action = m + 2 * s;

  const barColors = y.map(v =>
    v > action ? "#d62728" : "#1f77b4"
  );

  const summary = generateSummary(x, y, m, s, curveType);

// ---------- SHOW SUMMARY ----------
const summaryBox = document.getElementById("summaryBox");
const toggle = document.getElementById("toggleSummary");

summaryBox.innerHTML =
  "<b>English:</b> " +
  summary.en +
  "<br><br><b>Bahasa Melayu:</b> " +
  summary.bm;

summaryBox.style.display = toggle.checked ? "block" : "none";

toggle.onchange = () => {
  summaryBox.style.display = toggle.checked ? "block" : "none";
};

   
  const traces = [
    {
      x,
      y,
      type: "bar",
      name: "Cases",
      marker: { color: barColors },
      text: y,
      textposition: "outside",
      textfont: { size: 10 }
    },
    {
      x,
      y: Array(y.length).fill(m),
      mode: "lines",
      name: "Mean",
      line: { color: "green" }
    },
    {
      x,
      y: Array(y.length).fill(m + s),
      mode: "lines",
      name: "Alert (Mean + 1 SD)",
      line: { color: "orange", dash: "dash" }
    },
    {
      x,
      y: Array(y.length).fill(action),
      mode: "lines",
      name: "Action (Mean + 2 SD)",
      line: { color: "red", dash: "dot" }
    }
  ];

  Plotly.newPlot("chart", traces, {
title: {
  text: title,
  x: 0.5
},
    xaxis: {
      title:
        curveType === "weekly"
          ? "Epidemiological Week (Onset)"
          : "Date of Onset",
      tickangle: curveType === "weekly" ? 45 : 0
    },
    yaxis: {
      title: "Number of cases"
    },
    margin: { t: 120 }
  });
}
