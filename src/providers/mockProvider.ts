import { Finding, Severity, Category } from '../types/index.js';
import { parseUnifiedDiff, DiffFile } from '../utils/diffParser.js';

interface RuleDefinition {
  ruleId: string;
  severity: Severity;
  category: Category;
  title: string;
  check: (line: string) => boolean;
}

const SINGLE_LINE_RULES: RuleDefinition[] = [
  {
    ruleId: 'MOCK-001',
    severity: 'critical',
    category: 'security',
    title: 'eval usage',
    check: (line: string) => line.includes('eval('),
  },
  {
    ruleId: 'MOCK-002',
    severity: 'critical',
    category: 'security',
    title: 'hardcoded credential',
    check: (line: string) =>
      /(api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i.test(line),
  },
  {
    ruleId: 'MOCK-003',
    severity: 'high',
    category: 'security',
    title: 'SQL string concatenation',
    check: (line: string) => {
      const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE)\b/i;
      // SQL keyword inside a string concatenated with '+'
      return (
        sqlKeywords.test(line) &&
        (line.includes('+') || /['"].*?\b(SELECT|INSERT|UPDATE|DELETE)\b.*?['"]\s*\+/i.test(line))
      );
    },
  },
  {
    ruleId: 'MOCK-005',
    severity: 'medium',
    category: 'correctness',
    title: 'loose null comparison',
    check: (line: string) => line.includes('== null') || line.includes('!= null'),
  },
  {
    ruleId: 'MOCK-006',
    severity: 'medium',
    category: 'performance',
    title: 'deep-clone via JSON',
    check: (line: string) => line.includes('JSON.parse(JSON.stringify('),
  },
  {
    ruleId: 'MOCK-007',
    severity: 'low',
    category: 'style',
    title: 'console.log left in',
    check: (line: string) => line.includes('console.log('),
  },
  {
    ruleId: 'MOCK-008',
    severity: 'low',
    category: 'style',
    title: 'unresolved marker',
    check: (line: string) => line.includes('TODO') || line.includes('FIXME'),
  },
  {
    ruleId: 'MOCK-INJ',
    severity: 'critical',
    category: 'security',
    title: 'prompt-injection content',
    check: (line: string) => {
      const lower = line.toLowerCase();
      return (
        lower.includes('ignore previous instructions') ||
        lower.includes('disregard all prior') ||
        lower.includes('you are now')
      );
    },
  },
];

/**
 * Detects MOCK-004 (empty catch blocks) on added lines across single or multiline syntax.
 */
function checkEmptyCatch(file: DiffFile): Finding[] {
  const findings: Finding[] = [];

  for (let i = 0; i < file.addedLines.length; i++) {
    const lineObj = file.addedLines[i];
    if (!lineObj) continue;

    const content = lineObj.content;

    // Check if line contains a catch statement
    if (/\bcatch\s*(\([^)]*\))?\s*\{/.test(content)) {
      // Check if it's an empty catch on a single line: catch (e) {} or catch {}
      if (/\bcatch\s*(\([^)]*\))?\s*\{\s*\}/.test(content)) {
        findings.push({
          id: `MOCK-004:${file.path}:${lineObj.newLineNumber}`,
          ruleId: 'MOCK-004',
          path: file.path,
          line: lineObj.newLineNumber,
          severity: 'high',
          category: 'correctness',
          title: 'swallowed exception',
          evidence: content,
        });
        continue;
      }

      // Check across subsequent added lines if opening { is immediately closed with }
      if (i + 1 < file.addedLines.length) {
        const nextLineObj = file.addedLines[i + 1];
        if (nextLineObj && nextLineObj.content.trim() === '}') {
          findings.push({
            id: `MOCK-004:${file.path}:${lineObj.newLineNumber}`,
            ruleId: 'MOCK-004',
            path: file.path,
            line: lineObj.newLineNumber,
            severity: 'high',
            category: 'correctness',
            title: 'swallowed exception',
            evidence: content,
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Runs all MOCK rules against a unified diff and returns structured, deduplicated, sorted findings.
 */
export function runMockReview(rawDiff: string, maxFindings: number = 100): Finding[] {
  const files = parseUnifiedDiff(rawDiff);
  const allFindingsMap = new Map<string, Finding>();

  for (const file of files) {
    // 1. Single-line rules (MOCK-001, MOCK-002, MOCK-003, MOCK-005, MOCK-006, MOCK-007, MOCK-008, MOCK-INJ)
    for (const addedLine of file.addedLines) {
      for (const rule of SINGLE_LINE_RULES) {
        if (rule.check(addedLine.content)) {
          const findingId = `${rule.ruleId}:${file.path}:${addedLine.newLineNumber}`;
          allFindingsMap.set(findingId, {
            id: findingId,
            ruleId: rule.ruleId,
            path: file.path,
            line: addedLine.newLineNumber,
            severity: rule.severity,
            category: rule.category,
            title: rule.title,
            evidence: addedLine.content,
          });
        }
      }
    }

    // 2. Multiline/Catch block rule (MOCK-004)
    const catchFindings = checkEmptyCatch(file);
    for (const finding of catchFindings) {
      allFindingsMap.set(finding.id, finding);
    }
  }

  // Convert map to array for sorting
  const findings = Array.from(allFindingsMap.values());

  // Sort order: path (lexicographic), then line (ascending), then ruleId (lexicographic)
  findings.sort((a, b) => {
    if (a.path !== b.path) {
      return a.path.localeCompare(b.path);
    }
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return a.ruleId.localeCompare(b.ruleId);
  });

  // Truncate to maxFindings if specified
  return findings.slice(0, maxFindings);
}