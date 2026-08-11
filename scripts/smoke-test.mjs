const args = new Set(process.argv.slice(2));
const allowNotReady = args.has("--allow-not-ready");
const baseUrl = (
  process.env.APP_BASE_URL ||
  process.argv.find((arg) => arg.startsWith("http")) ||
  "http://localhost:3000"
).replace(/\/$/, "");

async function check(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: options.redirect ?? "follow",
    headers: {
      "User-Agent": "LaGrandiosa-Stage6-SmokeTest/1.0",
    },
  });

  return response;
}

const results = [];

const homepage = await check("/");
const csp = homepage.headers.get("content-security-policy") ?? "";
const nosniff = homepage.headers.get("x-content-type-options") ?? "";
const hsts = homepage.headers.get("strict-transport-security") ?? "";
const productionTarget = baseUrl.startsWith("https://");
results.push({
  name: "Public homepage",
  ok: homepage.ok,
  detail: `${homepage.status}`,
});
results.push({
  name: "Security headers",
  ok:
    csp.includes("default-src 'self'") &&
    nosniff.toLowerCase() === "nosniff" &&
    (!productionTarget || Boolean(hsts)),
  detail:
    `csp=${Boolean(csp)} nosniff=${nosniff || "missing"} hsts=${hsts || "not-required"}`,
});

const login = await check("/auth/login");
const loginCache = login.headers.get("cache-control") ?? "";
const loginRobots = login.headers.get("x-robots-tag") ?? "";
results.push({
  name: "Private login page",
  ok:
    login.ok &&
    loginCache.includes("no-store") &&
    loginRobots.includes("noindex"),
  detail:
    `${login.status} cache=${loginCache || "missing"} robots=${loginRobots || "missing"}`,
});

const portal = await check("/portal", { redirect: "manual" });
results.push({
  name: "Unauthenticated portal protection",
  ok: [301, 302, 303, 307, 308].includes(portal.status),
  detail: `${portal.status} ${portal.headers.get("location") ?? ""}`,
});

const commerce = await check("/api/health/commerce");
const commerceBody = await commerce.json().catch(() => ({}));
results.push({
  name: "Commerce health",
  ok: commerce.ok && commerceBody.ok === true && commerceBody.stage === "6",
  detail: `${commerce.status} stage=${commerceBody.stage ?? "unknown"}`,
});

const production = await check("/api/health/production");
const productionBody = await production.json().catch(() => ({}));
results.push({
  name: "Production readiness",
  ok:
    productionBody.ok === true &&
    (productionBody.launchReady === true || allowNotReady),
  detail:
    `${production.status} launchReady=${String(
      productionBody.launchReady,
    )} blockers=${(productionBody.automaticBlockers ?? []).join(",")}`,
});

console.log(`Smoke test target: ${baseUrl}`);
console.log("===============================================");
for (const result of results) {
  console.log(
    `${result.ok ? "PASS" : "FAIL"}  ${result.name} — ${result.detail}`,
  );
}

if (results.some((result) => !result.ok)) {
  process.exit(1);
}
