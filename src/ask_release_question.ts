const endpoint = process.env.QUESTION_SERVICE_URL ?? "http://localhost:3000/questions";
const question = process.argv.slice(2).join(" ") || "Did the latest build pass, and is the release clear to proceed?";

async function main(): Promise<void> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, topK: 4 })
  });
  const result: unknown = await response.json();
  console.log(JSON.stringify(result, null, 2));
}

void main();
