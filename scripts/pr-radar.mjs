#!/usr/bin/env node
/**
 * Village PR Radar
 *
 * Produces a ranked markdown report for the Village pull-request queue using
 * only the GitHub CLI. The goal is to help Justin quickly decide what to merge,
 * what needs attention, and what has gone stale.
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_LIMIT = 60;
const DEFAULT_OUT = 'pr-radar.md';
const CHECK_FAILURES = new Set(['FAILURE', 'ERROR', 'TIMED_OUT', 'ACTION_REQUIRED', 'CANCELLED', 'STARTUP_FAILURE']);
const CHECK_SUCCESSES = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);

function printHelp() {
  console.log(`Village PR Radar

Usage:
  npm run pr:radar -- [options]
  node scripts/pr-radar.mjs [options]

Options:
  --repo <owner/name>   GitHub repo to inspect. Defaults to the current repo.
  --limit <number>      Max open PRs to load. Defaults to ${DEFAULT_LIMIT}.
  --out <path>          Markdown output path. Defaults to ${DEFAULT_OUT}.
  --no-write            Print the console summary without writing markdown.
  --json                Print analyzed PR JSON instead of the console summary.
  --help                Show this help.

Examples:
  npm run pr:radar
  npm run pr:radar -- --repo kitcopilot-dev/Village-App --limit 100
  npm run pr:radar -- --out /tmp/village-pr-radar.md
`);
}

function parseArgs(argv) {
  const options = {
    repo: undefined,
    limit: DEFAULT_LIMIT,
    out: DEFAULT_OUT,
    write: true,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case '--repo':
        if (!next) throw new Error('--repo requires owner/name');
        options.repo = next;
        index += 1;
        break;
      case '--limit': {
        if (!next) throw new Error('--limit requires a number');
        const parsed = Number.parseInt(next, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          throw new Error('--limit must be a positive number');
        }
        options.limit = parsed;
        index += 1;
        break;
      }
      case '--out':
        if (!next) throw new Error('--out requires a path');
        options.out = next;
        index += 1;
        break;
      case '--no-write':
        options.write = false;
        break;
      case '--json':
        options.json = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function runGh(args) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error('GitHub CLI not found. Install gh and run gh auth login first.');
    }
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `gh exited with status ${result.status}`);
  }

  return result.stdout.trim();
}

function getRepoName(explicitRepo) {
  if (explicitRepo) return explicitRepo;
  return runGh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
}

function loadPullRequests({ repo, limit }) {
  const fields = [
    'number',
    'title',
    'url',
    'headRefName',
    'baseRefName',
    'createdAt',
    'updatedAt',
    'author',
    'labels',
    'isDraft',
    'mergeable',
    'reviewDecision',
    'additions',
    'deletions',
    'changedFiles',
    'statusCheckRollup',
  ].join(',');

  const args = ['pr', 'list', '--state', 'open', '--limit', String(limit), '--json', fields];
  if (repo) args.push('--repo', repo);

  return JSON.parse(runGh(args));
}

function daysBetween(now, isoDate) {
  const date = new Date(isoDate);
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function summarizeChecks(checks = []) {
  if (!Array.isArray(checks) || checks.length === 0) {
    return { state: 'none', label: 'No checks', failing: 0, pending: 0, passing: 0, total: 0 };
  }

  return checks.reduce(
    (summary, check) => {
      const conclusion = check.conclusion || check.state;
      const status = check.status || (check.state ? 'COMPLETED' : undefined);

      if (CHECK_FAILURES.has(conclusion)) {
        summary.failing += 1;
      } else if (status && status !== 'COMPLETED') {
        summary.pending += 1;
      } else if (CHECK_SUCCESSES.has(conclusion) || conclusion === 'SUCCESS') {
        summary.passing += 1;
      } else if (conclusion === 'PENDING' || conclusion === 'EXPECTED') {
        summary.pending += 1;
      } else {
        summary.pending += 1;
      }

      summary.total += 1;
      return summary;
    },
    { state: 'pending', label: '', failing: 0, pending: 0, passing: 0, total: 0 },
  );
}

function finalizeCheckSummary(summary) {
  if (summary.total === 0) return summary;
  if (summary.failing > 0) {
    return { ...summary, state: 'failing', label: `${summary.failing} failing / ${summary.total}` };
  }
  if (summary.pending > 0) {
    return { ...summary, state: 'pending', label: `${summary.pending} pending / ${summary.total}` };
  }
  return { ...summary, state: 'passing', label: `${summary.passing} passing` };
}

function getSize(additions = 0, deletions = 0, files = 0) {
  const churn = additions + deletions;
  if (churn <= 80 && files <= 3) return { bucket: 'tiny', score: 4 };
  if (churn <= 300 && files <= 6) return { bucket: 'small', score: 3 };
  if (churn <= 900 && files <= 12) return { bucket: 'medium', score: 2 };
  return { bucket: 'large', score: 1 };
}

function getLane(pr, checks, ageDays, staleDays) {
  if (pr.isDraft) return 'draft';
  if (pr.mergeable === 'CONFLICTING') return 'conflict';
  if (checks.state === 'failing') return 'fix checks';
  if (pr.reviewDecision === 'CHANGES_REQUESTED') return 'changes requested';
  if (checks.state === 'pending') return 'checks pending';
  if (staleDays >= 21) return 'stale review';
  if (pr.mergeable === 'MERGEABLE' && ['passing', 'none'].includes(checks.state)) return 'ready';
  if (ageDays >= 14) return 'needs review';
  return 'review';
}

function scorePullRequest({ lane, size, ageDays, staleDays, checks }) {
  let score = 0;

  if (lane === 'ready') score += 50;
  if (lane === 'review') score += 30;
  if (lane === 'needs review') score += 20;
  if (lane === 'stale review') score += 10;
  if (['conflict', 'fix checks', 'changes requested', 'draft'].includes(lane)) score -= 30;
  if (checks.state === 'passing') score += 10;
  if (checks.state === 'none') score += 4;

  score += size.score * 5;
  score -= Math.min(15, Math.floor(ageDays / 7) * 2);
  score -= Math.min(15, Math.floor(staleDays / 7) * 3);

  return score;
}

function analyzePullRequests(pullRequests, now = new Date()) {
  return pullRequests
    .map((pr) => {
      const checks = finalizeCheckSummary(summarizeChecks(pr.statusCheckRollup));
      const size = getSize(pr.additions, pr.deletions, pr.changedFiles);
      const ageDays = daysBetween(now, pr.createdAt);
      const staleDays = daysBetween(now, pr.updatedAt);
      const lane = getLane(pr, checks, ageDays, staleDays);
      const score = scorePullRequest({ lane, size, ageDays, staleDays, checks });

      return {
        ...pr,
        checks,
        size,
        ageDays,
        staleDays,
        lane,
        score,
        labels: pr.labels?.map((label) => label.name) || [],
      };
    })
    .sort((a, b) => b.score - a.score || b.number - a.number);
}

function summarizeQueue(prs) {
  const empty = { total: prs.length, ready: 0, needsReview: 0, blocked: 0, stale: 0, large: 0, attention: 0 };
  return prs.reduce((summary, pr) => {
    if (pr.lane === 'ready') summary.ready += 1;
    if (['review', 'needs review', 'checks pending', 'stale review'].includes(pr.lane)) summary.needsReview += 1;
    const isBlocked = ['conflict', 'fix checks', 'changes requested', 'draft'].includes(pr.lane);
    const isStale = pr.staleDays >= 21;
    if (isBlocked) summary.blocked += 1;
    if (isStale) summary.stale += 1;
    if (isBlocked || isStale || pr.lane === 'checks pending') summary.attention += 1;
    if (pr.size.bucket === 'large') summary.large += 1;
    return summary;
  }, empty);
}

function escapeMarkdown(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .trim();
}

function renderRecommendation(pr) {
  if (pr.lane === 'ready') return 'Merge candidate';
  if (pr.lane === 'fix checks') return 'Fix CI/checks first';
  if (pr.lane === 'conflict') return 'Rebase or resolve conflict';
  if (pr.lane === 'changes requested') return 'Address requested changes';
  if (pr.lane === 'stale review') return 'Re-review or close if superseded';
  if (pr.lane === 'checks pending') return 'Wait for checks';
  if (pr.lane === 'draft') return 'Finish draft';
  return 'Review next';
}

function renderMarkdown({ repo, prs, generatedAt }) {
  const summary = summarizeQueue(prs);
  const ready = prs.filter((pr) => pr.lane === 'ready').slice(0, 10);
  const attention = prs
    .filter((pr) => ['conflict', 'fix checks', 'changes requested', 'stale review', 'draft'].includes(pr.lane))
    .slice(0, 10);

  const lines = [
    '# Village PR Radar',
    '',
    `Generated: ${generatedAt.toISOString()}`,
    `Repository: ${repo}`,
    '',
    '## Queue snapshot',
    '',
    `- Open PRs scanned: ${summary.total}`,
    `- Ready merge candidates: ${summary.ready}`,
    `- Need review / checks: ${summary.needsReview}`,
    `- Blocked: ${summary.blocked}`,
    `- Blocked/stale attention queue: ${summary.attention}`,
    `- Stale for 21+ days: ${summary.stale}`,
    `- Large PRs: ${summary.large}`,
    '',
    '## Best merge candidates',
    '',
  ];

  if (ready.length === 0) {
    lines.push('No clean merge candidates found yet.');
  } else {
    ready.forEach((pr, index) => {
      lines.push(`${index + 1}. [#${pr.number} ${escapeMarkdown(pr.title)}](${pr.url}) — ${pr.size.bucket}, ${pr.changedFiles} files, ${pr.checks.label}, updated ${pr.staleDays}d ago`);
    });
  }

  lines.push('', '## Needs attention', '');

  if (attention.length === 0) {
    lines.push('No blocked/stale PRs in the scanned queue.');
  } else {
    attention.forEach((pr) => {
      lines.push(`- [#${pr.number} ${escapeMarkdown(pr.title)}](${pr.url}) — **${pr.lane}**; ${renderRecommendation(pr)}; ${pr.checks.label}; updated ${pr.staleDays}d ago`);
    });
  }

  lines.push(
    '',
    '## Full queue',
    '',
    '| PR | Lane | Checks | Mergeable | Size | Age | Updated | Branch | Recommendation |',
    '| --- | --- | --- | --- | --- | ---: | ---: | --- | --- |',
  );

  prs.forEach((pr) => {
    lines.push(`| ${[
      `[#${pr.number} ${escapeMarkdown(pr.title)}](${pr.url})`,
      pr.lane,
      pr.checks.label,
      pr.mergeable || 'unknown',
      `${pr.size.bucket} (${pr.additions}+/${pr.deletions}-, ${pr.changedFiles} files)`,
      `${pr.ageDays}d`,
      `${pr.staleDays}d`,
      `\`${escapeMarkdown(pr.headRefName)}\``,
      renderRecommendation(pr),
    ].join(' | ')} |`);
  });

  lines.push(
    '',
    '---',
    '',
    'Tip: run `npm run pr:radar -- --out pr-radar.md` before a merge session, then start with the Best merge candidates list.',
  );

  return `${lines.join('\n')}\n`;
}

function printConsoleSummary({ repo, prs, outPath, wroteFile }) {
  const summary = summarizeQueue(prs);
  const top = prs.slice(0, 5);

  console.log(`Village PR Radar — ${repo}`);
  console.log(`Open: ${summary.total} | Ready: ${summary.ready} | Review/checks: ${summary.needsReview} | Attention: ${summary.attention} | Stale: ${summary.stale}`);
  console.log('');
  console.log('Top next actions:');

  if (top.length === 0) {
    console.log('  No open pull requests found.');
  } else {
    top.forEach((pr, index) => {
      console.log(`  ${index + 1}. #${pr.number} ${pr.title}`);
      console.log(`     ${pr.lane} · ${pr.size.bucket} · ${pr.checks.label} · updated ${pr.staleDays}d ago`);
      console.log(`     ${pr.url}`);
    });
  }

  if (wroteFile) {
    console.log('');
    console.log(`Markdown report written to ${outPath}`);
  }
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const repo = getRepoName(options.repo);
    const rawPrs = loadPullRequests({ repo, limit: options.limit });
    const prs = analyzePullRequests(rawPrs);

    if (options.json) {
      console.log(JSON.stringify({ repo, generatedAt: new Date().toISOString(), pullRequests: prs }, null, 2));
      return;
    }

    const outPath = resolve(process.cwd(), options.out);
    if (options.write) {
      writeFileSync(outPath, renderMarkdown({ repo, prs, generatedAt: new Date() }));
    }

    printConsoleSummary({ repo, prs, outPath, wroteFile: options.write });
  } catch (error) {
    console.error(`PR Radar failed: ${error.message}`);
    process.exit(1);
  }
}

main();
