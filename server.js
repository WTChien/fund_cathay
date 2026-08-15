const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const SITCA_URL = "https://www.sitca.org.tw/ROC/Industry/IN2106.aspx?pid=IN2213_02";
const CATHAY_COMPANY_ID = "A0037";
const CACHE_MS = 1000 * 60 * 30;

const targetFunds = [
  {
    code: "T3703Y",
    name: "國泰中小成長",
    fullName: "國泰中小成長基金",
    purpose: "國內股票型，波動較大，適合慢慢看。",
    link: "https://www.cathaysite.com.tw/fund-details/F03"
  },
  {
    code: "T3706Y",
    name: "國泰大中華",
    fullName: "國泰大中華基金",
    purpose: "國內股票型，主要看大中華相關市場。",
    link: "https://www.cathaysite.com.tw/fund-details/F06"
  },
  {
    code: "T3707Y",
    name: "國泰科技生化",
    fullName: "國泰科技生化基金",
    purpose: "國內股票型，偏科技與生化產業。",
    link: "https://www.cathaysite.com.tw/fund-details/F07"
  }
];

let cache = null;

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode < 200 || res.statusCode >= 400) {
          reject(new Error(`SITCA returned ${res.statusCode}`));
          return;
        }
        resolve(text);
      });
    });

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("SITCA request timed out"));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function extractInput(html, name) {
  const pattern = new RegExp(`name="${name}"[^>]*value="([^"]*)"`);
  const match = html.match(pattern);
  return match ? match[1] : "";
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanCell(value) {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function parseRows(html) {
  const rows = [];
  const rowPattern = /<tr class=DTeven>(.*?)<\/tr>/gis;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells = [];
    const cellPattern = /<td[^>]*>(.*?)<\/td>/gis;
    let cellMatch;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      cells.push(cleanCell(cellMatch[1]));
    }

    if (cells.length >= 10) {
      rows.push({
        typeCode: cells[0],
        companyCode: cells[1],
        companyName: cells[2],
        code: cells[3],
        taxId: cells[4],
        fundName: cells[5],
        currency: cells[6],
        nav: cells[7],
        previousNav: cells[8],
        change: cells[9]
      });
    }
  }

  return rows;
}

function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00+08:00`);
}

function formatSitcaDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatDisplayDate(sitcaDate) {
  return `${sitcaDate.slice(0, 4)}/${sitcaDate.slice(4, 6)}/${sitcaDate.slice(6, 8)}`;
}

async function fetchSitcaByDate(sitcaDate) {
  const html = await request(SITCA_URL, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 fund-cathay"
    }
  });

  const params = new URLSearchParams();
  params.set("__VIEWSTATE", extractInput(html, "__VIEWSTATE"));
  params.set("__VIEWSTATEGENERATOR", extractInput(html, "__VIEWSTATEGENERATOR"));
  params.set("__EVENTVALIDATION", extractInput(html, "__EVENTVALIDATION"));
  params.set("ctl00$ContentPlaceHolder1$txtQ_Date", sitcaDate);
  params.set("ctl00$ContentPlaceHolder1$ddlQ_Comid", CATHAY_COMPANY_ID);
  params.set("ctl00$ContentPlaceHolder1$BtnQuery", "查詢");

  return request(
    SITCA_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(params.toString()),
        "User-Agent": "Mozilla/5.0 fund-cathay"
      }
    },
    params.toString()
  );
}

function makeTrend(previousNav, nav) {
  if (!Number.isFinite(previousNav) || !Number.isFinite(nav) || previousNav <= 0) {
    return [50, 50, 50, 50, 50, 50, 50];
  }

  const base = 54;
  const delta = Math.max(-18, Math.min(18, ((nav - previousNav) / previousNav) * 120));
  return [base - 4, base - 2, base, base + 1, base + 2, base + 3, base + delta].map(
    (value) => Math.max(22, Math.min(82, Math.round(value)))
  );
}

async function fetchFundsFromSitca() {
  const start = taipeiToday();

  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() - offset);
    const sitcaDate = formatSitcaDate(date);
    const html = await fetchSitcaByDate(sitcaDate);
    const rows = parseRows(html);
    const byCode = new Map(rows.map((row) => [row.code, row]));

    if (targetFunds.every((fund) => byCode.has(fund.code))) {
      const funds = targetFunds.map((fund) => {
        const row = byCode.get(fund.code);
        const nav = Number(row.nav);
        const previousNav = Number(row.previousNav);
        const change = Number(row.change);
        const changePercent =
          Number.isFinite(previousNav) && previousNav !== 0
            ? (change / previousNav) * 100
            : 0;

        return {
          ...fund,
          risk: "RR5",
          nav: row.nav,
          previousNav: row.previousNav,
          change: row.change,
          changeText: `${change >= 0 ? "+" : ""}${row.change} (${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%)`,
          changeTone: change > 0 ? "up" : change < 0 ? "down" : "flat",
          currency: row.currency,
          trendLabel: "SITCA 最新淨值",
          trend: makeTrend(previousNav, nav)
        };
      });

      return {
        updatedDate: formatDisplayDate(sitcaDate),
        sourceStatus: "SITCA 投信投顧公會",
        funds
      };
    }
  }

  throw new Error("No recent SITCA data found for all target funds");
}

async function getFundData() {
  if (cache && Date.now() - cache.time < CACHE_MS) {
    return cache.data;
  }

  const data = await fetchFundsFromSitca();
  cache = { time: Date.now(), data };
  return data;
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const publicDir = path.join(__dirname, "dist");
  const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(publicDir, "index.html"), (fallbackError, fallbackData) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallbackData);
      });
      return;
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8"
    };
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/funds")) {
    try {
      sendJson(res, 200, await getFundData());
    } catch (error) {
      sendJson(res, 502, {
        error: "SITCA_FETCH_FAILED",
        message: error.message
      });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Fund site running at http://${HOST}:${PORT}`);
});
