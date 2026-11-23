/** STS UAT – Record Admin PDF (WeasyPrint). Same content as generate-uat-records.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const htmlOut = path.join(root, "docs/STS_UAT_Records.html");
const pdfOut = path.join(root, "docs/STS_UAT_Records.pdf");
const logoPath = path.join(root, "public/nmp-logo.png");

import { modules, role, sections } from "./uat-records-content.mjs";


const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

let rowsHtml = "";
sections.forEach(([title, tests], si) => {
  rowsHtml += `<tr class="section"><td colspan="7">Application ${si + 1}: ${esc(title)}</td></tr>`;
  tests.forEach(([desc, steps, exp, fmt], ti) => {
    const fmtHtml = fmt
      ? fmt.map((f) => `<div class="${/:$/.test(f) ? "fmt-label" : "fmt-val"}">${esc(f)}</div>`).join("")
      : "";
    rowsHtml += `<tr>
      <td class="c-no">${si + 1}.${ti + 1}.</td>
      <td class="c-desc"><div>${esc(desc)}</div>${fmtHtml}</td>
      <td class="c-steps"><ul>${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></td>
      <td class="c-exp">${esc(exp)}</td>
      <td class="c-check"></td>
      <td class="c-check"></td>
      <td class="c-comments"></td>
    </tr>`;
  });
});

const logoData = fs.readFileSync(logoPath).toString("base64");
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>STS UAT – Record Admin</title>
<style>
  @page {
    size: A4 landscape;
    margin: 18mm 12mm 16mm 12mm;
    @bottom-center {
      content: "Support Ticketing System – User Acceptance Testing (Record Admin)  |  Page " counter(page) " of " counter(pages);
      font-family: Calibri, Arial, sans-serif;
      font-size: 8pt;
      color: #595959;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: Calibri, Arial, sans-serif;
    font-size: 9.5pt;
    color: #000;
    margin: 0;
  }
  .brand { text-align: center; margin-bottom: 10px; }
  .brand img { width: 48px; height: 48px; }
  .brand .ph { font-weight: 700; font-size: 9pt; color: #5B1A18; margin: 2px 0 0; }
  .brand .en {
    font-weight: 700; font-size: 9pt; color: #5B1A18; margin: 0 0 6px;
    border-bottom: 1.5px solid #000; padding-bottom: 4px; display: inline-block; min-width: 60%;
  }
  table.info, table.tests {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.info td, table.tests th, table.tests td {
    border: 1px solid #000;
    padding: 5px 7px;
    vertical-align: top;
    word-wrap: break-word;
  }
  table.info td.label { font-weight: 700; width: 14%; }
  table.info td.value { width: 24%; }
  table.info td.label2 { font-weight: 700; width: 16%; }
  table.info td.value2 { width: 46%; }
  table.tests { margin-top: 12px; }
  table.tests th {
    text-align: center;
    font-weight: 700;
    background: #fff;
    vertical-align: middle;
  }
  tr.section td {
    background: #B4C6E7;
    font-weight: 700;
  }
  .c-no { width: 5%; text-align: left; }
  .c-desc { width: 14%; }
  .c-steps { width: 22%; }
  .c-exp { width: 28%; }
  .c-check { width: 5%; }
  .c-comments { width: 21%; }
  .c-steps ul { margin: 0; padding-left: 1.1em; }
  .c-steps li { margin: 0 0 2px; }
  .fmt-label { font-weight: 700; margin-top: 4px; }
  .fmt-val { font-style: italic; }
</style>
</head>
<body>
  <div class="brand">
    <img src="data:image/png;base64,${logoData}" alt="NMP logo" />
    <p class="ph">PAMBANSANG MUSEO NG PILIPINAS</p>
    <p class="en">NATIONAL MUSEUM OF THE PHILIPPINES</p>
  </div>

  <table class="info">
    <tr>
      <td class="label">Information System</td>
      <td class="value">Support Ticketing System (STS) – National Museum of the Philippines</td>
      <td class="label2">UAT Number</td>
      <td class="value2"></td>
    </tr>
    <tr>
      <td class="label">Module</td>
      <td colspan="3">${esc(modules)}</td>
    </tr>
    <tr>
      <td class="label">Testing Start Date</td>
      <td class="value"></td>
      <td class="label2">Testing End Date</td>
      <td class="value2"></td>
    </tr>
    <tr>
      <td class="label">Name of Tester</td>
      <td class="value"></td>
      <td class="label2"></td>
      <td class="value2"></td>
    </tr>
    <tr>
      <td class="label">Role Tested</td>
      <td class="value">${esc(role)}</td>
      <td class="label2"></td>
      <td class="value2"></td>
    </tr>
  </table>

  <table class="tests">
    <thead>
      <tr>
        <th class="c-no">Test No.</th>
        <th class="c-desc">Description of Task</th>
        <th class="c-steps">Steps to Execute</th>
        <th class="c-exp">Expected Result</th>
        <th class="c-check">Pass</th>
        <th class="c-check">Fail</th>
        <th class="c-comments">Comments / Suggestions</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;

fs.writeFileSync(htmlOut, html);
const result = spawnSync("weasyprint", [htmlOut, pdfOut], { encoding: "utf8" });
if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "weasyprint failed");
  process.exit(result.status ?? 1);
}
console.log("wrote", pdfOut);
