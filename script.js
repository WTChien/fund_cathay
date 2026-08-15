const fallbackData = {
  updatedDate: "2026/08/14",
  sourceStatus: "暫用備援資料",
  funds: [
    {
      name: "國泰中小成長",
      fullName: "國泰中小成長基金",
      risk: "RR5",
      purpose: "國內股票型，波動較大，適合慢慢看。",
      nav: "337.64",
      previousNav: "336.43",
      change: "1.21",
      changeText: "+1.21 (+0.36%)",
      changeTone: "up",
      currency: "TWD",
      trendLabel: "備援資料",
      trend: [50, 52, 54, 55, 56, 57, 54],
      link: "https://www.cathaysite.com.tw/fund-details/F03"
    },
    {
      name: "國泰大中華",
      fullName: "國泰大中華基金",
      risk: "RR5",
      purpose: "國內股票型，主要看大中華相關市場。",
      nav: "177.06",
      previousNav: "175.45",
      change: "1.61",
      changeText: "+1.61 (+0.92%)",
      changeTone: "up",
      currency: "TWD",
      trendLabel: "備援資料",
      trend: [50, 52, 54, 55, 56, 57, 55],
      link: "https://www.cathaysite.com.tw/fund-details/F06"
    },
    {
      name: "國泰科技生化",
      fullName: "國泰科技生化基金",
      risk: "RR5",
      purpose: "國內股票型，偏科技與生化產業。",
      nav: "283.45",
      previousNav: "279.96",
      change: "3.49",
      changeText: "+3.49 (+1.25%)",
      changeTone: "up",
      currency: "TWD",
      trendLabel: "備援資料",
      trend: [50, 52, 54, 55, 56, 57, 56],
      link: "https://www.cathaysite.com.tw/fund-details/F07"
    }
  ]
};

async function loadFunds() {
  try {
    const response = await fetch("/api/funds", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("API failed");
    }
    const data = await response.json();
    renderFunds(data);
  } catch (error) {
    renderFunds(fallbackData);
  }
}

function renderFunds(pageData) {
  document.getElementById("updated-date").textContent = pageData.updatedDate;
  document.getElementById("source-status").textContent = pageData.sourceStatus;

  const fundList = document.getElementById("fund-list");
  fundList.innerHTML = pageData.funds
    .map((fund) => {
      const bars = fund.trend
        .map((height) => `<span style="height: ${height}%"></span>`)
        .join("");

      return `
        <article class="fund-card">
          <div class="fund-top">
            <h2 class="fund-name">${fund.name}</h2>
            <span class="risk-pill">${fund.risk}</span>
          </div>
          <p class="fund-purpose">${fund.purpose}</p>
          <div class="value-panel">
            <span class="label">最新淨值</span>
            <strong class="nav-value">${fund.nav}</strong>
            <span class="change ${fund.changeTone}">${fund.changeText}</span>
          </div>
          <div class="trend">
            <div class="trend-title">
              <span>${fund.currency}</span>
              <span>${fund.trendLabel}</span>
            </div>
            <div class="bars" aria-hidden="true">${bars}</div>
          </div>
          <a class="fund-link" href="${fund.link}" target="_blank" rel="noreferrer">查看官方資料</a>
        </article>
      `;
    })
    .join("");
}

loadFunds();
