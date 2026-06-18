import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

function loadEnvFile() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(line)) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index);
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const isDev = process.argv.includes("--dev");
const port = Number(process.env.PORT || 4173);
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 3_000_000) throw new Error("Слишком большой запрос");
  }
  return JSON.parse(body || "{}");
}

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function financeAssistant(request, response) {
  if (!process.env.OPENAI_API_KEY) {
    return json(response, 503, { error: "GPT ещё не подключён. Добавьте OPENAI_API_KEY в файл .env и перезапустите приложение." });
  }
  try {
    const { question, data, selectedMonth } = await readBody(request);
    if (!question || !data?.transactions) return json(response, 400, { error: "Не хватает вопроса или финансовых данных." });

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        store: false,
        max_output_tokens: 1000,
        instructions: "Ты финансовый аналитик внутри личного приложения. Отвечай по-русски, кратко и конкретно. Анализируй только переданные данные, называй период и суммы. Не выдумывай операции. Отделяй факты от предположений. Не давай категоричных инвестиционных, налоговых или юридических указаний.",
        input: `Текущий выбранный месяц: ${selectedMonth}.\nВопрос пользователя: ${question}\n\nПолный набор данных приложения (счета, категории, бюджеты и все операции):\n${JSON.stringify(data)}`,
      }),
    });
    const payload = await apiResponse.json();
    if (!apiResponse.ok) return json(response, apiResponse.status, { error: payload?.error?.message || "OpenAI API вернул ошибку." });
    const answer = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n").trim();
    return json(response, 200, { answer: answer || "Не удалось сформировать ответ." });
  } catch (error) {
    return json(response, 500, { error: error instanceof Error ? error.message : "Ошибка GPT-интеграции" });
  }
}

let vite;
if (isDev) {
  const { createServer: createViteServer } = await import("vite");
  vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
}

const server = createServer(async (request, response) => {
  if (request.url === "/api/assistant" && request.method === "POST") return financeAssistant(request, response);
  if (vite) return vite.middlewares(request, response, () => json(response, 404, { error: "Не найдено" }));

  const base = resolve("dist");
  const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  let target = normalize(join(base, pathname === "/" ? "index.html" : pathname));
  if (!target.startsWith(base)) return json(response, 403, { error: "Недоступно" });
  if (!existsSync(target) || statSync(target).isDirectory()) target = join(base, "index.html");
  response.writeHead(200, { "Content-Type": `${mime[extname(target)] || "application/octet-stream"}; charset=utf-8` });
  createReadStream(target).pipe(response);
});

server.listen(port, "0.0.0.0", () => console.log(`Капитал запущен: http://localhost:${port}${isDev ? " (dev)" : ""}`));
