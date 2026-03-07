/**
 * Rei-AIOS STEP 27 — PaperViewer
 * 取得した論文本文を閲覧・検索するCLIインターフェース。
 *
 * 使い方:
 *   npx tsx src/aios/knowledge/paper-viewer.ts <arxiv_id>
 *   npx tsx src/aios/knowledge/paper-viewer.ts <arxiv_id> --dfumt
 *   npx tsx src/aios/knowledge/paper-viewer.ts <arxiv_id> --section <番号>
 */

import { PaperFullTextFetcher } from './paper-full-text-fetcher';

const COLORS = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  cyan:    '\x1b[36m',
  yellow:  '\x1b[33m',
  green:   '\x1b[32m',
  red:     '\x1b[31m',
  dim:     '\x1b[2m',
};

function highlight(text: string, keywords: string[]): string {
  let result = text;
  for (const kw of keywords) {
    const re = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(re, `${COLORS.yellow}$1${COLORS.reset}`);
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('使い方: npx tsx paper-viewer.ts <arxiv_id> [--dfumt] [--section N] [--refs]');
    console.log('例:     npx tsx paper-viewer.ts 2301.00001 --dfumt');
    process.exit(1);
  }

  const arxivId    = args[0];
  const dfumtOnly  = args.includes('--dfumt');
  const refsMode   = args.includes('--refs');
  const sectionIdx = args.indexOf('--section');
  const targetSection = sectionIdx >= 0 ? parseInt(args[sectionIdx + 1]) - 1 : -1;

  const fetcher = new PaperFullTextFetcher({
    dbPath: './dist/paper-cache.db',
    log: msg => process.stderr.write(msg + '\n'),
  });

  console.log(`${COLORS.bold}${COLORS.cyan}論文取得中: arxiv:${arxivId}${COLORS.reset}`);

  const result = await fetcher.fetchFromArxivPaper({
    id: arxivId, title: '', summary: '', authors: [],
    published: '', updated: '', categories: [], link: '', dfumtVector: [],
  });
  const { paper, dfumtSections, axiomCandidates, relevanceScore } = result;

  // ─── ヘッダー ─────────────────────────────────────────────
  console.log(`\n${COLORS.bold}タイトル: ${paper.title}${COLORS.reset}`);
  console.log(`ソース: ${paper.source} | 文字数: ${paper.charCount} | セクション: ${paper.sections.length}件`);
  console.log(`D-FUMT関連度: ${(relevanceScore * 100).toFixed(0)}% | 関連セクション: ${dfumtSections.length}件`);

  if (paper.abstract) {
    console.log(`\n${COLORS.bold}【アブストラクト】${COLORS.reset}`);
    console.log(paper.abstract);
  }

  // ─── 公理候補 ─────────────────────────────────────────────
  if (axiomCandidates.length > 0) {
    console.log(`\n${COLORS.bold}${COLORS.green}【公理候補】${COLORS.reset}`);
    axiomCandidates.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  }

  // ─── セクション表示 ──────────────────────────────────────
  if (refsMode) {
    console.log(`\n${COLORS.bold}【参考文献】${COLORS.reset}`);
    paper.references.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
    fetcher.close();
    return;
  }

  const sectionsToShow = dfumtOnly ? dfumtSections
    : targetSection >= 0 ? [paper.sections[targetSection]].filter(Boolean)
    : paper.sections;

  if (sectionsToShow.length === 0) {
    console.log(`\n${COLORS.dim}（D-FUMT関連セクションが見つかりませんでした）${COLORS.reset}`);
  } else {
    console.log(`\n${COLORS.bold}【セクション】${dfumtOnly ? '（D-FUMT関連のみ）' : ''}${COLORS.reset}`);
    for (const sec of sectionsToShow) {
      const marker = sec.relevant ? `${COLORS.green}●${COLORS.reset}` : `${COLORS.dim}○${COLORS.reset}`;
      console.log(`\n${marker} ${COLORS.bold}${sec.heading}${COLORS.reset}`);
      if (sec.keywords.length > 0) {
        console.log(`  ${COLORS.yellow}[${sec.keywords.slice(0, 5).join(', ')}]${COLORS.reset}`);
      }
      console.log(highlight(sec.text.slice(0, 800), sec.keywords));
      if (sec.text.length > 800) console.log(`${COLORS.dim}... (${sec.text.length - 800}文字省略)${COLORS.reset}`);
    }
  }

  fetcher.close();
}

main().catch(err => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
