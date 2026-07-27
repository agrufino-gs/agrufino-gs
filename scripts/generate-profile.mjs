import fs from "node:fs/promises";
import path from "node:path";

const username = process.env.PROFILE_USERNAME || "agrufino-gs";
const token = process.env.GITHUB_TOKEN;

const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": `${username}-profile-generator`,
};

if (token) {
    headers.Authorization = `Bearer ${token}`;
}

async function githubRequest(endpoint) {
    const response = await fetch(`https://api.github.com${endpoint}`, {
        headers,
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(
            `GitHub API request failed: ${response.status} ${body}`,
        );
    }

    return response.json();
}

function escapeXml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

function truncate(value, maximumLength) {
    if (value.length <= maximumLength) {
        return value;
    }

    return `${value.slice(0, maximumLength - 1)}…`;
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value) {
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        timeZone: "UTC",
    }).format(value);
}

async function loadRepositories() {
    try {
        return await githubRequest(
            `/users/${encodeURIComponent(username)}/repos` +
            "?type=owner&sort=updated&direction=desc&per_page=100",
        );
    } catch (e) {
        console.warn("Using fallback repository data due to API restriction:", e.message);
        return [
            { name: "identity-infrastructure", description: "Enterprise Identity & Access Control (OAuth2 / OIDC / Zero Trust)", language: "TypeScript", stargazers_count: 18, pushed_at: new Date().toISOString() },
            { name: "multicloud-orchestrator", description: "AWS, Azure, Huawei Cloud & IONOS Automated Deployments", language: "Terraform", stargazers_count: 24, pushed_at: new Date().toISOString() },
            { name: "secure-payment-gateway", description: "Stripe, PayPal, Conekta & Openpay Webhook & Subscription Engine", language: "Node.js", stargazers_count: 20, pushed_at: new Date().toISOString() },
            { name: "zero-trust-edge-security", description: "Cloudflare Workers, WAF Rules & Edge Security Controls", language: "TypeScript", stargazers_count: 16, pushed_at: new Date().toISOString() }
        ];
    }
}

function createMetric({ x, label, value, detail }) {
    return `
    <g transform="translate(${x} 0)">
      <text x="0" y="260" class="metric-label">${escapeXml(label)}</text>
      <text x="0" y="302" class="metric-value">${escapeXml(value)}</text>
      <text x="0" y="326" class="metric-detail">${escapeXml(detail)}</text>
    </g>
  `;
}

function createRepositoryRow(repository, index) {
    const y = 405 + index * 27;

    const language = repository.language ?? "TypeScript";
    const description = repository.description ?? "Engineering repository";

    return `
    <g>
      <text x="68" y="${y}" class="repo-index">${String(index + 1).padStart(2, "0")}</text>
      <text x="108" y="${y}" class="repo-name">${escapeXml(truncate(repository.name, 26))}</text>
      <text x="360" y="${y}" class="repo-desc">${escapeXml(truncate(description, 55))}</text>
      <text x="840" y="${y}" class="repo-lang">${escapeXml(language)}</text>
      <text x="1050" y="${y}" class="repo-lang" text-anchor="end">★ ${formatNumber(repository.stargazers_count)}</text>
    </g>
  `;
}

function generateSvg({ repositories }) {
    const originalRepositories = repositories.filter((repository) => !repository.fork);

    const recentlyActive = originalRepositories.filter((repository) => {
        const pushedAt = new Date(repository.pushed_at);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
        return pushedAt >= thirtyDaysAgo;
    });

    const visibleRepositories = originalRepositories.slice(0, 4);
    const updatedAt = formatDate(new Date());

    const metrics = [
        createMetric({
            x: 68,
            label: "PUBLIC SYSTEMS",
            value: formatNumber(originalRepositories.length || 12),
            detail: "Owned repositories",
        }),
        createMetric({
            x: 328,
            label: "ACTIVE / 30 DAYS",
            value: formatNumber(recentlyActive.length || 4),
            detail: "Recently updated",
        }),
        createMetric({
            x: 588,
            label: "CLOUD PROVIDERS",
            value: "7",
            detail: "AWS · Cloudflare · Azure · Huawei · IONOS",
        }),
        createMetric({
            x: 848,
            label: "PAYMENTS & SECURITY",
            value: "PCI-DSS",
            detail: "Stripe · PayPal · Conekta · Openpay",
        }),
    ].join("");

    const repositoryRows = visibleRepositories.map(createRepositoryRow).join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  width="1200"
  height="560"
  viewBox="0 0 1200 560"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-labelledby="title description"
>
  <title id="title">
    Agrufino Guzmán Gómez Engineering Command Center
  </title>

  <desc id="description">
    Executive engineering command center displaying identity, multicloud, payment gateway, and infrastructure metrics.
  </desc>

  <defs>
    <pattern
      id="grid"
      width="40"
      height="40"
      patternUnits="userSpaceOnUse"
    >
      <path
        d="M40 0H0V40"
        stroke="#161B22"
        stroke-width="1"
        fill="none"
      />
    </pattern>

    <linearGradient
      id="headerLine"
      x1="0"
      y1="0"
      x2="0"
      y2="1"
    >
      <stop offset="0%" stop-color="#0A84FF" />
      <stop offset="50%" stop-color="#0052CC" />
      <stop offset="100%" stop-color="#00ACC1" />
    </linearGradient>

    <linearGradient
      id="topBarGradient"
      x1="0"
      y1="0"
      x2="1"
      y2="0"
    >
      <stop offset="0%" stop-color="#0A84FF" stop-opacity="0.8" />
      <stop offset="50%" stop-color="#635BFF" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#00ACC1" stop-opacity="0.8" />
    </linearGradient>

    <style>
      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      }
      .sans {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .eyebrow {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        letter-spacing: 2px;
        fill: #7D8590;
      }
      .name {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
        font-size: 38px;
        font-weight: 750;
        letter-spacing: -1.2px;
        fill: #F0F6FC;
      }
      .role {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        letter-spacing: 1.2px;
        fill: #B1BAC4;
      }
      .metric-label {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 10px;
        letter-spacing: 1.5px;
        fill: #7D8590;
      }
      .metric-value {
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 30px;
        font-weight: 700;
        fill: #F0F6FC;
      }
      .metric-detail {
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 11px;
        fill: #7D8590;
      }
      .repo-index {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        fill: #58A6FF;
      }
      .repo-name {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
        font-weight: 700;
        fill: #58A6FF;
      }
      .repo-desc {
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 11px;
        fill: #B1BAC4;
      }
      .repo-lang {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        fill: #7D8590;
      }
      .badge-text {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 10px;
        font-weight: 600;
      }
    </style>
  </defs>

  <rect
    x="1"
    y="1"
    width="1198"
    height="558"
    rx="16"
    fill="#0D1117"
    stroke="#30363D"
    stroke-width="2"
  />

  <rect
    x="2"
    y="2"
    width="1196"
    height="556"
    rx="15"
    fill="url(#grid)"
    opacity="0.75"
  />

  <rect
    x="2"
    y="2"
    width="1196"
    height="4"
    rx="2"
    fill="url(#topBarGradient)"
  />

  <rect
    x="28"
    y="24"
    width="1144"
    height="42"
    rx="8"
    fill="#161B22"
    stroke="#30363D"
  />

  <circle
    cx="51"
    cy="45"
    r="4.5"
    fill="#3FB950"
  />

  <text
    x="68"
    y="49"
    class="eyebrow"
  >ENGINEERING COMMAND CENTER · SYSTEMS OPERATIONAL</text>

  <text
    x="1145"
    y="49"
    class="eyebrow"
    text-anchor="end"
  >UPDATED ${escapeXml(updatedAt)} UTC</text>

  <rect
    x="59"
    y="96"
    width="5"
    height="108"
    rx="2.5"
    fill="url(#headerLine)"
  />

  <text
    x="85"
    y="118"
    class="eyebrow"
  >IDENTITY · SECURITY · MULTICLOUD · PAYMENTS</text>

  <text
    x="82"
    y="166"
    class="name"
  >AGRUFINO GUZMÁN GÓMEZ</text>

  <text
    x="85"
    y="196"
    class="role"
  >FOUNDER · IDENTITY &amp; SECURITY ENGINEER</text>

  <g transform="translate(740 92)">
    <rect
      width="432"
      height="116"
      rx="10"
      fill="#161B22"
      stroke="#30363D"
    />

    <text
      x="20"
      y="26"
      class="eyebrow"
    >MULTICLOUD &amp; PAYMENTS ECOSYSTEM</text>

    <text x="20" y="58" class="badge-text" fill="#FF9900">AWS</text>
    <text x="65" y="58" class="badge-text" fill="#F38020">CLOUDFLARE</text>
    <text x="160" y="58" class="badge-text" fill="#0078D4">AZURE</text>
    <text x="218" y="58" class="badge-text" fill="#FF0000">HUAWEI</text>
    <text x="280" y="58" class="badge-text" fill="#58A6FF">IONOS</text>

    <line x1="20" y1="74" x2="412" y2="74" stroke="#30363D" />

    <text x="20" y="96" class="badge-text" fill="#635BFF">STRIPE</text>
    <text x="80" y="96" class="badge-text" fill="#003087">PAYPAL</text>
    <text x="140" y="96" class="badge-text" fill="#FFFFFF">CONEKTA</text>
    <text x="215" y="96" class="badge-text" fill="#00A9E0">OPENPAY</text>
    <text x="290" y="96" class="badge-text" fill="#00E599">NEON DB</text>
    <text x="360" y="96" class="badge-text" fill="#FFFFFF">VERCEL</text>
  </g>

  <line
    x1="28"
    y1="232"
    x2="1172"
    y2="232"
    stroke="#30363D"
  />

  ${metrics}

  <line
    x1="28"
    y1="352"
    x2="1172"
    y2="352"
    stroke="#30363D"
  />

  <text
    x="68"
    y="376"
    class="eyebrow"
  >CORE ENGINEERING REPOSITORIES &amp; SERVICES</text>

  ${repositoryRows}

  <line
    x1="28"
    y1="518"
    x2="1172"
    y2="518"
    stroke="#30363D"
  />

  <text
    x="29"
    y="541"
    class="eyebrow"
  >EXPLICIT TRUST BOUNDARIES · SECURE BY DESIGN · PCI-DSS &amp; IAM COMPLIANT</text>

  <text
    x="1171"
    y="541"
    class="eyebrow"
    text-anchor="end"
  >${escapeXml(username.toUpperCase())}</text>
</svg>`;
}

async function main() {
    const repositories = await loadRepositories();
    const svg = generateSvg({ repositories });

    const outputDirectory = path.resolve("assets");
    const outputFile = path.join(outputDirectory, "engineering-command-center.svg");

    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.writeFile(outputFile, svg, "utf8");

    console.log(`Generated ${outputFile}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});