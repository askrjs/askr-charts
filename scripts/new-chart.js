import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const CHART_NAME_RE = /^[a-z0-9-]+$/;

function printUsage() {
  console.log("Usage: npm run new:chart -- <chart-name>");
  console.log("Example: npm run new:chart -- dashboard-sparkline");
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

async function replacePlaceholdersInChartFiles(dirPath, chartName) {
  const files = await walkFiles(dirPath);

  for (const filePath of files) {
    if (!/\.(css|md|json|ts|tsx|js)$/.test(filePath)) continue;
    const content = await readFile(filePath, "utf8");
    const updated = content.replaceAll("__CHART_NAME__", chartName);
    if (updated !== content) {
      await writeFile(filePath, updated, "utf8");
    }
  }
}

async function main() {
  const chartName = process.argv[2]?.trim();

  if (!chartName) {
    printUsage();
    process.exit(1);
  }

  if (!CHART_NAME_RE.test(chartName)) {
    console.error("Chart name must match /^[a-z0-9-]+$/.");
    process.exit(1);
  }

  const root = process.cwd();
  const templateDir = path.join(root, "templates", "chart");
  const outputDir = path.join(root, "src", "charts", chartName);

  if (!(await pathExists(templateDir))) {
    console.error("Missing templates/chart directory.");
    process.exit(1);
  }

  if (await pathExists(outputDir)) {
    console.error(`Chart already exists: ${chartName}`);
    process.exit(1);
  }

  await mkdir(path.dirname(outputDir), { recursive: true });
  await cp(templateDir, outputDir, { recursive: true });
  await replacePlaceholdersInChartFiles(outputDir, chartName);

  console.log(`Created chart at src/charts/${chartName}`);
  console.log("Next step: add exports in package.json for your new chart entrypoints.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
