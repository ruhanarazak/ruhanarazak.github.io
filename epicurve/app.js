async function run() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) {
    alert("Please upload an Excel file first.");
    return;
  }

  const data = await readExcel(file);

  const epiData = aggregateEpi(
    data,
    "Epid Tahun (Tkh Notifikasi)",
    "Epid Minggu (Tkh Notifikasi)"
  );

  plotEpi(epiData);
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
      const json = XLSX.utils.sheet_to_json(sheet);
      resolve(json);
    };
    reader.readAsBinaryString(file);
  });
}

/* ================================
   AGGREGATE EPI WEEK
================================ */
function aggregateEpi(data, yearCol, weekCol) {
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
      return { year, week: Number(week), cases: v };
    })
    .sort((a, b) => a.week - b.week);
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
    arr.reduce((s, x) => s + Math.pow(x - m, 2), 0) / (arr.length - 1)
  );
}

/* ================================
   PLOT
================================ */
function plotEpi(data) {
  const weeks = data.map(d => `W${d.week}`);
  const cases = data.map(d => d.cases);

  const m = mean(cases);
  const s = sd(cases);

  const traces = [
    {
      x: weeks,
      y: cases,
      type: "bar",
      name: "Weekly cases"
    },
    {
      x: weeks,
      y: Array(cases.length).fill(m),
      mode: "lines",
      name: "Mean"
    },
    {
      x: weeks,
      y: Array(cases.length).fill(m + s),
      mode: "lines",
      name: "Alert (Mean + 1 SD)",
      line: { dash: "dash" }
    },
    {
      x: weeks,
      y: Array(cases.length).fill(m + 2 * s),
      mode: "lines",
      name: "Action (Mean + 2 SD)",
      line: { dash: "dot" }
    }
  ];

  Plotly.newPlot("chart", traces, {
    title: "Food Poisoning Epidemic Curve (Weekly)",
    xaxis: { title: "Epidemiological Week" },
    yaxis: { title: "Number of cases" }
  });
}
