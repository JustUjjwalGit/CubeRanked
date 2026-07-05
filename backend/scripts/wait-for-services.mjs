import net from "node:net";

const targets = [
  ["PostgreSQL", process.env.DATABASE_URL],
  ["Redis", process.env.REDIS_URL],
];

for (const [name, rawUrl] of targets) {
  if (!rawUrl) {
    throw new Error(`${name} URL is missing`);
  }

  await waitForTcp(name, rawUrl);
}

function waitForTcp(name, rawUrl) {
  const url = new URL(rawUrl);
  const host = url.hostname;
  const port = Number(url.port || (url.protocol.startsWith("postgres") ? 5432 : 6379));
  const started = Date.now();
  const timeoutMs = 60_000;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host, port });

      socket.once("connect", () => {
        socket.end();
        console.log(`${name} is ready`);
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();

        if (Date.now() - started > timeoutMs) {
          reject(new Error(`${name} did not become ready at ${host}:${port}`));
          return;
        }

        setTimeout(attempt, 1_000);
      });
    };

    attempt();
  });
}
