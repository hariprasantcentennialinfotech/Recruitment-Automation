const text = `Shakir Imran (PMP, SAFe, PSM, ITIL 4, MBA)
Senior Project Manager, Enterprise Systems Integration
Toronto, Ontario | 437 229 3538 | shakir.tunde@gmail.com
PROFESSIONAL SUMMARY
Senior Project Manager with 8+ years leading overall project planning...
HIGHLIGHT OF QUALIFICATIONS
• 10+ years of experience in project management...`

const fileName = 'Shakir_Imran_Resume_Centennial_SalesforcePM.pdf'

function extractName(text: string, fileName: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) =>
      l.length > 2 &&
      l.length < 60 &&
      !l.includes('@') &&
      !l.includes('|') &&
      !/^[\d\s.,%/\\]+$/.test(l) &&
      !/resume|cv|curriculum|page|objective|summary|skills|experience|education|competenc|profile|project|certif|highlight|qualification|responsibilit|accomplish|overview|employ|history|background|reference|award|interest|activit|declaration|technical|leadership|career/i.test(l) &&
      /[a-zA-Z]/.test(l)
    )

  let name = ''
  for (const rawLine of lines.slice(0, 8)) {
    // Strip trailing credentials in parentheses or after comma, e.g. "Shakir Imran (PMP, ...)" -> "Shakir Imran"
    const cleaned = rawLine
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/,\s*(?:PMP|SAFe|PSM|ITIL|MBA|CPA|PhD|MD|BSc|MSc|CSM|AWS|GCP|CISSP|CISA|PRINCE2|P\.Eng).*$/i, '')
      .trim()

    // Accept line as a name if it looks like "First Last" or "First Middle Last" (2-4 capitalized words)
    if (/^[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3}$/.test(cleaned)) {
      // Reject if it is all uppercase and contains common dictionary keywords
      const isAllUpper = cleaned === cleaned.toUpperCase()
      const isHeaderWord = /QUALIFICATION|HIGHLIGHT|EXPERIENCE|SUMMARY|SKILLS|EDUCATION|CERTIFICATE|MANAGEMENT|PROJECT|DEVELOPER|ENGINEER/i.test(cleaned)
      if (!isAllUpper || !isHeaderWord) {
        name = cleaned
        break
      }
    }
  }

  // If not found in text, extract from filename
  if (!name) {
    const fileBase = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    const nameMatch = fileBase.match(/^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,2})/)
    if (nameMatch && !/resume|cv|candidate|application/i.test(nameMatch[1])) {
      name = nameMatch[1].trim()
    }
  }

  return name || 'Candidate'
}

console.log('Extracted name:', extractName(text, fileName))
