import fs from "node:fs/promises";
import path from "node:path";

const username = process.env.PROFILE_USERNAME;
const token = process.env.GITHUB_TOKEN;

if (!username) {
    throw new Error("PROFILE_USERNAME is required.");
}

if (!token) {
    throw new Error("GITHUB_TOKEN is required.");
}

const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": `${username}-profile-generator`,
};

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
    return githubRequest(
        `/users/${encodeURIComponent(username)}/repos` +
        "?type=owner&sort=updated&direction=desc&per_page=100",
    );
}

async function loadLanguageTotals(repositories) {
    const totals = new Map();

    const selectedRepositories = repositories
        .filter((repository) => !repository.fork)
        .slice(0, 15);

    await Promise.all(
        selectedRepositories.map(async (repository) => {
            try {
                const languages = await githubRequest(
                    `/repos/${encodeURIComponent(username)}/` +
                    `${encodeURIComponent(repository.name)}/languages`,
                );

                for (const [language, bytes] of Object.entries(languages)) {
                    totals.set(language, (totals.get(language) ?? 0) + bytes);
                }
            } catch (error) {
                console.warn(
                    `Could not load languages for ${repository.name}:`,
                    error.message,
                );
            }
        }),
    );

    return [...totals.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 4)
        .map(([language]) => language);
}

function createMetric({
    x,
    label,
    value,
    detail,
}) {
    return `
    <g transform="translate(${x} 0)">
      <text
        x="0"
        y="260"
        class="metric-label"
      >${escapeXml(label)}</text>

      <text
        x="0"
        y="305"
        class="metric-value"
      >${escapeXml(value)}</text>

      <text
        x="0"
        y="333"
        class="metric-detail"
      >${escapeXml(detail)}</text>
    </g>
  `;
}

function createRepositoryRow(repository, index) {
    const y = 390 + index * 29;

    const language = repository.language ?? "Multi-language";
    const description =
        repository.description ??
        "Engineering repository";

    return `
    <g>
      <text
        x="66"
        y="${y}"
        class="repo-index"
      >${String(index + 1).padStart(2, "0")}</text>

      <text
        x="107"
        y="${y}"
        class="repo-name"
      >${escapeXml(truncate(repository.name, 27))}</text>

      <text
        x="355"
        y="${y}"
        class="repo-description"
      >${escapeXml(truncate(description, 49))}</text>

      <text
        x="823"
        y="${y}"
        class="repo-language"
      >${escapeXml(language)}</text>

      <text
        x="1050"
        y="${y}"
        class="repo-stars"
        text-anchor="end"
      >★ ${formatNumber(repository.stargazers_count)}</text>
    </g>
  `;
}

function generateSvg({
    repositories,
    languages,
}) {
    const originalRepositories = repositories.filter(
        (repository) => !repository.fork,
    );

    const recentlyActive = originalRepositories.filter((repository) => {
        const pushedAt = new Date(repository.pushed_at);
        const thirtyDaysAgo = new Date();

        thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

        return pushedAt >= thirtyDaysAgo;
    });

    const totalStars = originalRepositories.reduce(
        (total, repository) =>
            total + repository.stargazers_count,
        0,
    );

    const visibleRepositories = originalRepositories.slice(0, 4);

    const updatedAt = formatDate(new Date());

    const metrics = [
        createMetric({
            x: 67,
            label: "PUBLIC SYSTEMS",
            value: formatNumber(originalRepositories.length),
            detail: "Owned repositories",
        }),
        createMetric({
            x: 326,
            label: "ACTIVE / 30 DAYS",
            value: formatNumber(recentlyActive.length),
            detail: "Recently updated",
        }),
        createMetric({
            x: 585,
            label: "PUBLIC STARS",
            value: formatNumber(totalStars),
            detail: "Across repositories",
        }),
        createMetric({
            x: 844,
            label: "PRIMARY LANGUAGES",
            value: escapeXml(languages.length || 0),
            detail: escapeXml(
                languages.slice(0, 3).join(" · ") || "Building",
            ),
        }),
    ].join("");

    const repositoryRows = visibleRepositories
        .map(createRepositoryRow)
        .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  width="1200"
  height="540"
  viewBox="0 0 1200 540"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-labelledby="title description"
>
  <title id="title">
    Agrufino Guzmán Gómez engineering command center
  </title>

  <desc id="description">
    Automatically generated engineering profile summary.
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
        stroke="#20252D"
        stroke-width="1"
        fill="none"
      />
    </pattern>

    <linearGradient
      id="headerLine"
      x1="0"
      y1="0"
      x2="1"
      y2="0"
    >
      <stop offset="0%" stop-color="#58A6FF" />
      <stop offset="50%" stop-color="#3FB950" />
      <stop offset="100%" stop-color="#58A6FF" />
    </linearGradient>

    <style>
      .mono {
        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;
      }

      .sans {
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      .eyebrow {
        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;
        font-size: 11px;
        letter-spacing: 2px;
        fill: #7D8590;
      }

      .name {
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
        font-size: 42px;
        font-weight: 700;
        letter-spacing: -1.7px;
        fill: #F0F6FC;
      }

      .role {
        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;
        font-size: 13px;
        letter-spacing: 1px;
        fill: #B1BAC4;
      }

      .metric-label {
        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;
        font-size: 10px;
        letter-spacing: 1.2px;
        fill: #7D8590;
      }

      .metric-value {
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          sans-serif;
        font-size: 31px;
        font-weight: 650;
        fill: #F0F6FC;
      }

      .metric-detail {
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          sans-serif;
        font-size: 11px;
        fill: #7D8590;
      }

      .repo-index,
      .repo-language,
      .repo-stars {
        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;
        font-size: 11px;
        fill: #7D8590;
      }

      .repo-name {
        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;
        font-size: 12px;
        font-weight: 700;
        fill: #58A6FF;
      }

      .repo-description {
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          sans-serif;
        font-size: 11px;
        fill: #B1BAC4;
      }
    </style>
  </defs>

  <rect
    x="1"
    y="1"
    width="1198"
    height="538"
    rx="20"
    fill="#0D1117"
    stroke="#30363D"
    stroke-width="2"
  />

  <rect
    x="2"
    y="2"
    width="1196"
    height="536"
    rx="19"
    fill="url(#grid)"
    opacity="0.65"
  />

  <rect
    x="28"
    y="24"
    width="1144"
    height="42"
    rx="9"
    fill="#161B22"
    stroke="#30363D"
  />

  <circle
    cx="51"
    cy="45"
    r="5"
    fill="#3FB950"
  />

  <text
    x="68"
    y="50"
    class="eyebrow"
  >ENGINEERING COMMAND CENTER</text>

  <text
    x="1145"
    y="50"
    class="eyebrow"
    text-anchor="end"
  >GENERATED ${escapeXml(updatedAt)} UTC</text>

  <rect
    x="59"
    y="104"
    width="5"
    height="104"
    rx="2.5"
    fill="url(#headerLine)"
  />

  <text
    x="91"
    y="128"
    class="eyebrow"
  >IDENTITY · SECURITY · CLOUD</text>

  <text
    x="88"
    y="178"
    class="name"
  >AGRUFINO GUZMÁN GÓMEZ</text>

  <text
    x="91"
    y="208"
    class="role"
  >FOUNDER · IDENTITY &amp; SECURITY ENGINEER</text>

  <g transform="translate(815 100)">
    <rect
      width="320"
      height="116"
      rx="13"
      fill="#161B22"
      stroke="#30363D"
    />

    <text
      x="20"
      y="28"
      class="eyebrow"
    >CLOUD EXPERIENCE</text>

    <text
      x="20"
      y="59"
      class="role"
      fill="#FF9900"
    >AWS</text>

    <text
      x="106"
      y="59"
      class="role"
      fill="#F38020"
    >CLOUDFLARE</text>

    <text
      x="233"
      y="59"
      class="role"
      fill="#0078D4"
    >AZURE</text>

    <line
      x1="20"
      y1="78"
      x2="300"
      y2="78"
      stroke="#30363D"
    />

    <text
      x="20"
      y="99"
      class="eyebrow"
    >MULTI-CLOUD ENGINEERING</text>
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
    y1="356"
    x2="1172"
    y2="356"
    stroke="#30363D"
  />

  <text
    x="66"
    y="380"
    class="eyebrow"
  >RECENT ENGINEERING REPOSITORIES</text>

  ${repositoryRows}

  <line
    x1="28"
    y1="502"
    x2="1172"
    y2="502"
    stroke="#30363D"
  />

  <text
    x="29"
    y="525"
    class="eyebrow"
  >SECURE BY DESIGN · EXPLICIT TRUST BOUNDARIES</text>

  <text
    x="1171"
    y="525"
    class="eyebrow"
    text-anchor="end"
  >${escapeXml(username.toUpperCase())}</text>
</svg>`;
}

async function main() {
    const repositories = await loadRepositories();
    const languages = await loadLanguageTotals(repositories);

    const svg = generateSvg({
        repositories,
        languages,
    });

    const outputDirectory = path.resolve("assets");
    const outputFile = path.join(
        outputDirectory,
        "engineering-command-center.svg",
    );

    await fs.mkdir(outputDirectory, {
        recursive: true,
    });

    await fs.writeFile(outputFile, svg, "utf8");

    console.log(`Generated ${outputFile}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});