// Writes the bundle size and the first-play download size to the CI job summary
// (and to the terminal). Run with `npm run size-report` after `npm run test:e2e`,
// which builds dist/ and writes size-report/first-play.json.
// Node runs this file directly (type stripping), so keep to plain, erasable TypeScript.
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export interface DistFile {
  path: string;
  bytes: number;
  gzipBytes?: number;
}

export interface DistSummary {
  codeBytes: number;
  codeGzipBytes: number;
  assetBytes: number;
  totalBytes: number;
}

const CODE = /\.(js|css|html)$/;

export function summariseDist(files: DistFile[]): DistSummary {
  const summary = { codeBytes: 0, codeGzipBytes: 0, assetBytes: 0, totalBytes: 0 };
  for (const file of files) {
    summary.totalBytes += file.bytes;
    if (CODE.test(file.path)) {
      summary.codeBytes += file.bytes;
      summary.codeGzipBytes += file.gzipBytes ?? 0;
    } else {
      summary.assetBytes += file.bytes;
    }
  }
  return summary;
}

/** Decimal units, as the budget is: 15 MB is 15,000,000 bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

export interface FirstPlay {
  totalBytes: number;
  budgetBytes: number;
  files: { path: string; bytes: number }[];
}

const NOT_MEASURED = 'not measured';

/** The Markdown table for the CI job summary. Either input may be missing. */
export function renderSummary(dist: DistSummary | null, firstPlay: FirstPlay | null): string {
  const code = dist ? `${formatBytes(dist.codeBytes)} (${formatBytes(dist.codeGzipBytes)} gzip)` : NOT_MEASURED;
  const whole = dist ? formatBytes(dist.totalBytes) : NOT_MEASURED;
  let play = NOT_MEASURED;
  if (firstPlay) {
    const percent = Math.round((firstPlay.totalBytes / firstPlay.budgetBytes) * 100);
    const verdict = firstPlay.totalBytes < firstPlay.budgetBytes ? '✅' : '❌ over budget';
    play = `${formatBytes(firstPlay.totalBytes)} of ${formatBytes(firstPlay.budgetBytes)} (${percent}%) ${verdict}`;
  }

  const lines = [
    '## Sizes',
    '',
    '| What | Size |',
    '| --- | --- |',
    `| Code bundle (JS, CSS, HTML) | ${code} |`,
    `| Whole \`dist/\` | ${whole} |`,
    `| First play | ${play} |`,
    '',
    'First play is every same-origin file the page downloads before you can fly (at `?quality=high`), uncompressed.',
  ];
  if (firstPlay && firstPlay.files.length > 0) {
    const largest = [...firstPlay.files].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
    lines.push('', '### Largest first-play files', '', '| File | Size |', '| --- | --- |');
    for (const file of largest) lines.push(`| \`${file.path}\` | ${formatBytes(file.bytes)} |`);
  }
  return lines.join('\n') + '\n';
}

function readDist(folder: string): DistSummary | null {
  if (!existsSync(folder)) return null;
  const files: DistFile[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const data = readFileSync(full);
      const file: DistFile = { path: path.relative(folder, full), bytes: data.length };
      if (CODE.test(name)) file.gzipBytes = gzipSync(data).length;
      files.push(file);
    }
  };
  walk(folder);
  return summariseDist(files);
}

function readFirstPlay(file: string): FirstPlay | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as FirstPlay;
}

function main(): void {
  // A report must never fail the build: anything it cannot read is shown as "not measured".
  let dist: DistSummary | null = null;
  let firstPlay: FirstPlay | null = null;
  try {
    dist = readDist('dist');
  } catch (error) {
    console.warn('Could not measure dist/:', error);
  }
  try {
    firstPlay = readFirstPlay('size-report/first-play.json');
  } catch (error) {
    console.warn('Could not read size-report/first-play.json:', error);
  }
  const text = renderSummary(dist, firstPlay);
  console.log(text);
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    try {
      appendFileSync(summaryFile, text);
    } catch (error) {
      console.warn('Could not write the job summary:', error);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
