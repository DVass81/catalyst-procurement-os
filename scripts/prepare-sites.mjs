import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const exportDirectory = resolve(root, "out");
const distributionDirectory = resolve(root, "dist");
const clientDirectory = resolve(distributionDirectory, "client");
const serverDirectory = resolve(distributionDirectory, "server");

await rm(distributionDirectory, { force: true, recursive: true });
await mkdir(serverDirectory, { recursive: true });
await cp(exportDirectory, clientDirectory, { recursive: true });

const worker = `const worker = {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};

export default worker;
`;

await writeFile(resolve(serverDirectory, "index.js"), worker, "utf8");
