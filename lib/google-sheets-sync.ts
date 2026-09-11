import crypto from 'node:crypto'
import { CandidateDocument, SheetsSyncStatus } from '@/lib/types'
import { candidateProfilesCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

/**
 * Google Sheets Candidate Synchronization Engine.
 * Formats candidate records into standardized columns and synchronizes them to Google Sheets.
 * Server-side only — never exposes tokens or credentials to client code.
 */

export const DEFAULT_SHEET_COLUMNS = [
  'Candidate Name',
  'Email',
  'Phone',
  'Location',
  'Current Title',
  'Total Experience',
  'Matching Skills',
  'Missing Skills',
  'Work Authorization',
  'Availability',
  'Resume',
  'Status',
]

import { getSheetsAccessToken } from '@/lib/google-auth-token'
export { getSheetsAccessToken }

/**
 * Formats a candidate profile into row values matching target columns dynamically.
 */
export function formatCandidateRow(
  candidate: CandidateDocument,
  columns?: string[],
  selectedColumns?: string[]
): string[] {
  const resumeRef = candidate.resumeUrl
    ? candidate.resumeUrl
    : candidate.sourceFileId
    ? `https://drive.google.com/file/d/${candidate.sourceFileId}/view`
    : candidate.sourceFile || ''

  if (!columns || columns.length === 0) {
    return [
      candidate.fullName || 'Candidate',
      candidate.email || '',
      candidate.phone || '',
      candidate.location || 'Remote',
      candidate.currentTitle || 'Software Professional',
      candidate.totalExperience || 'Experienced',
      (candidate.matchingSkills || candidate.skills || []).slice(0, 8).join(', '),
      (candidate.missingSkills || []).slice(0, 6).join(', '),
      candidate.workAuthorization || 'Authorized',
      candidate.availability || 'Immediate / 2 weeks',
      resumeRef,
      candidate.recommendation || 'New',
    ]
  }

  const custom = candidate.customFields || {}

  return columns.map((col) => {
    const colTrimmed = col.trim()
    if (!colTrimmed) return ''
    const norm = colTrimmed.toLowerCase()

    // STRICT CHECK: If user specified a subset of selected columns, ONLY populate those columns!
    if (selectedColumns && selectedColumns.length > 0) {
      const isSelected = selectedColumns.some((sc) => {
        const scNorm = sc.toLowerCase().trim()
        return (
          scNorm === norm ||
          (norm.includes(scNorm) && scNorm.length > 3) ||
          (scNorm.includes(norm) && norm.length > 3)
        )
      })
      if (!isSelected) {
        return '' // Leave unselected column empty
      }
    }

    // 1. Direct match in customFields extracted by Gemini
    if (custom[col] !== undefined && custom[col] !== '') return String(custom[col])
    for (const [k, v] of Object.entries(custom)) {
      if (k.toLowerCase().trim() === norm && v !== '') return String(v)
    }

    // 2. Missed / Missing details or requirements in resume (MUST check BEFORE "resume" link check!)
    if (
      norm.includes('missed') ||
      norm.includes('missing') ||
      norm.includes('gap') ||
      norm.includes('lacking') ||
      (norm.includes('not') && norm.includes('found'))
    ) {
      if (candidate.missingSkills && candidate.missingSkills.length > 0) {
        return candidate.missingSkills.join(', ')
      }
      return 'None'
    }

    // 3. Intelligent mapping to candidate document properties
    if (norm.includes('name') || norm === 'candidate') return candidate.fullName || ''
    if (norm.includes('email') || norm === 'mail') return candidate.email || ''
    if (
      norm.includes('phone') ||
      norm.includes('mobile') ||
      norm.includes('contact') ||
      norm.includes('cell') ||
      norm.includes('tel')
    ) {
      return candidate.phone || ''
    }
    if (
      norm.includes('address') ||
      norm.includes('location') ||
      norm.includes('city') ||
      norm.includes('country') ||
      norm.includes('state')
    ) {
      return candidate.location || ''
    }
    if (norm.includes('title') || norm.includes('designation') || norm.includes('role') || norm.includes('position')) {
      return candidate.currentTitle || ''
    }
    if (norm.includes('company') || norm.includes('organization') || norm.includes('employer')) {
      return candidate.currentCompany || ''
    }
    if (norm.includes('experience') || norm.includes('years') || norm.includes('exp') || norm.includes('10 + year')) {
      return candidate.totalExperience || ''
    }
    if (norm.includes('matching') && norm.includes('skill')) {
      return (candidate.matchingSkills || []).join(', ')
    }
    if (norm.includes('skill')) {
      return (candidate.skills || []).join(', ')
    }
    if (norm.includes('score') || norm.includes('rating')) {
      return candidate.matchScore !== undefined ? `${candidate.matchScore}%` : ''
    }
    if (norm.includes('call') || norm.includes('screening')) {
      return candidate.recommendation || candidate.stage || 'New'
    }
    if (norm.includes('recommendation') || norm.includes('decision') || norm.includes('fit')) {
      return candidate.recommendation || ''
    }
    if (norm.includes('education') || norm.includes('degree') || norm.includes('qualification')) {
      if (Array.isArray(candidate.education)) {
        return candidate.education.map((e: any) => typeof e === 'string' ? e : `${e.degree || ''} (${e.institution})`).join('; ')
      }
      return String(candidate.education || '')
    }
    if (norm.includes('certif')) {
      return (candidate.certifications || []).join(', ')
    }
    if (norm.includes('viza') || norm.includes('visa') || norm.includes('authorization') || norm.includes('work auth')) {
      return candidate.workAuthorization || ''
    }
    if (norm.includes('availability') || norm.includes('notice')) {
      return candidate.availability || ''
    }
    if (norm.includes('share') || norm.includes('client')) {
      return candidate.recommendation === 'Strong Match' || candidate.recommendation === 'Good Match' ? 'Yes' : 'Under Review'
    }
    if (norm.includes('portal') || norm.includes('source')) {
      return (candidate as any).externalSource || (candidate as any).source || 'Google Drive'
    }

    // 4. Resume document / drive link reference (strictly for actual document link/file columns)
    if (
      (norm.includes('resume') && (norm.includes('link') || norm.includes('url') || norm.includes('file') || norm.includes('drive') || norm === 'resume')) ||
      (norm.includes('cv') && (norm.includes('link') || norm.includes('url') || norm.includes('file') || norm === 'cv')) ||
      norm.includes('drive link') ||
      norm === 'resume' ||
      norm === 'cv' ||
      norm === 'link' ||
      norm === 'url'
    ) {
      return resumeRef
    }

    if (norm.includes('status') || norm.includes('stage')) return candidate.stage || 'New'

    return ''
  })
}

/**
 * Synchronizes a candidate record to Google Sheets.
 * If the candidate already exists in the sheet by Email or Name, updates the row.
 * Otherwise, appends a new row.
 */
export async function syncCandidateToGoogleSheets(
  candidate: CandidateDocument,
  options: {
    spreadsheetId?: string
    sheetName?: string
    columns?: string[]
    allowSimulation?: boolean
  } = {}
): Promise<{
  success: boolean
  syncStatus: SheetsSyncStatus
  spreadsheetId: string
  sheetName: string
  rowId?: number
  error?: string
}> {
  const spreadsheetId = (options.spreadsheetId || candidate.googleSheetsSpreadsheetId || '').trim()
  const sheetName = (options.sheetName || candidate.googleSheetsSheetName || 'Candidate Tracking').trim()

  if (!spreadsheetId) {
    return {
      success: false,
      syncStatus: 'FAILED',
      spreadsheetId,
      sheetName,
      error: 'Google Sheets Spreadsheet ID is not configured for this job',
    }
  }

  const candCol = candidateProfilesCollection()
  const candId = candidate.id || candidate._id?.toString()

  // Mark candidate as SYNCING in MongoDB
  if (candId) {
    await candCol.updateOne(
      { _id: new ObjectId(candId) },
      {
        $set: {
          sheetsSyncStatus: 'SYNCING',
          googleSheetsSpreadsheetId: spreadsheetId,
          googleSheetsSheetName: sheetName,
          updatedAt: new Date(),
        },
      }
    )
  }

  const token = await getSheetsAccessToken(candidate.organization)

  // If live credentials are not present in .env
  if (!token) {
    if (options.allowSimulation) {
      const simulatedRow = candidate.googleSheetsRowId || Math.floor(Math.random() * 50) + 2
      if (candId) {
        await candCol.updateOne(
          { _id: new ObjectId(candId) },
          {
            $set: {
              sheetsSyncStatus: 'SYNCED',
              googleSheetsRowId: simulatedRow,
              sheetsSyncError: undefined,
              updatedAt: new Date(),
            },
          }
        )
      }
      return {
        success: true,
        syncStatus: 'SYNCED',
        spreadsheetId,
        sheetName,
        rowId: simulatedRow,
      }
    }

    const errMessage =
      'Google Sheets synchronization failed: Google Drive/Sheets is not connected for this organization. Please click "Connect Google Drive" in the Automation tab, or configure service account credentials in .env.'

    if (candId) {
      await candCol.updateOne(
        { _id: new ObjectId(candId) },
        {
          $set: {
            sheetsSyncStatus: 'FAILED',
            sheetsSyncError: errMessage,
            updatedAt: new Date(),
          },
        }
      )
    }

    return {
      success: false,
      syncStatus: 'FAILED',
      spreadsheetId,
      sheetName,
      error: errMessage,
    }
  }

  try {
    const range = `${sheetName}!A:Z`
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}`

    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    let existingRows: string[][] = []
    if (getRes.ok) {
      const getData = await getRes.json()
      existingRows = getData.values || []
    }

    let activeColumns = options.columns && options.columns.length > 0 ? options.columns : DEFAULT_SHEET_COLUMNS

    // If sheet is completely empty, insert header row first
    if (existingRows.length === 0) {
      const appendHeaderUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(sheetName)}!A1:Z1:append?valueInputOption=USER_ENTERED`

      await fetch(appendHeaderUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [activeColumns] }),
      })
      existingRows = [activeColumns]
    } else if (existingRows.length > 0 && existingRows[0].length > 0) {
      // Adopt existing sheet's header row as the active column definitions!
      activeColumns = existingRows[0]
    }

    const userSelectedColumns = options.columns && options.columns.length > 0 ? options.columns : undefined
    const rawRowValues = formatCandidateRow(candidate, activeColumns, userSelectedColumns)
    // Sanitize + and = to prevent Google Sheets formula #ERROR!
    const rowValues = rawRowValues.map((v) => {
      const s = String(v ?? '')
      if (s.startsWith('+') || s.startsWith('=')) {
        return `'${s}`
      }
      return s
    })

    // Pad row values up to 26 columns (A-Z) so that any stale displaced cells to the right are cleared
    const paddedValues = [...rowValues]
    while (paddedValues.length < 26) {
      paddedValues.push('')
    }

    // Check for existing candidate row (by email, phone, resume file link, or clean name)
    let targetRowIndex = -1
    const candidateEmail = (candidate.email || '').toLowerCase().trim()
    const candidateName = (candidate.fullName || '').toLowerCase().trim()
    const candidatePhone = (candidate.phone || '').replace(/\D/g, '').slice(-10)
    const sourceFileId = candidate.sourceFileId || ''
    const sourceFileName = (candidate.sourceFile || '').toLowerCase().trim()

    // Find email, name, phone, and resume column indexes
    let nameColIdx = 0
    let emailColIdx = 1
    let phoneColIdx = -1
    let resumeColIdx = -1

    for (let c = 0; c < activeColumns.length; c++) {
      const colLower = activeColumns[c].toLowerCase().trim()
      if (colLower.includes('name') || colLower === 'candidate') nameColIdx = c
      if (colLower.includes('email') || colLower === 'mail') emailColIdx = c
      if (colLower.includes('phone') || colLower.includes('mobile') || colLower.includes('contact')) phoneColIdx = c
      if (colLower.includes('resume') || colLower.includes('link') || colLower.includes('url')) resumeColIdx = c
    }

    // If candidate already has a known sheet row ID that points to an existing row
    if (candidate.googleSheetsRowId && candidate.googleSheetsRowId >= 2 && candidate.googleSheetsRowId <= existingRows.length) {
      targetRowIndex = candidate.googleSheetsRowId
    }

    if (targetRowIndex <= 0) {
      for (let i = 1; i < existingRows.length; i++) {
        const row = existingRows[i]
        const rowName = (row[nameColIdx] || row[0] || '').toLowerCase().trim()
        const rowEmail = (row[emailColIdx] || row[2] || '').toLowerCase().trim()
        const rowPhone = phoneColIdx >= 0 ? (row[phoneColIdx] || '').replace(/\D/g, '').slice(-10) : ''

        // 1. Exact email match
        if (candidateEmail && rowEmail && rowEmail === candidateEmail) {
          targetRowIndex = i + 1
          break
        }

        // 2. Drive file ID or resume file name match across ANY cell in the row
        if (sourceFileId) {
          const hasFileId = row.some((cell) => typeof cell === 'string' && cell.includes(sourceFileId))
          if (hasFileId) {
            targetRowIndex = i + 1
            break
          }
        }
        if (sourceFileName && sourceFileName.length > 5) {
          const hasFileName = row.some((cell) => typeof cell === 'string' && cell.toLowerCase().includes(sourceFileName))
          if (hasFileName) {
            targetRowIndex = i + 1
            break
          }
        }

        // 3. Phone match (last 10 or 7 digits)
        if (candidatePhone && candidatePhone.length >= 7 && rowPhone && rowPhone.length >= 7) {
          if (rowPhone.slice(-7) === candidatePhone.slice(-7)) {
            targetRowIndex = i + 1
            break
          }
        }

        // 4. Clean human name match (only if not generic "Candidate" and not empty)
        const isRealName = candidateName && candidateName !== 'candidate' && candidateName.length >= 4
        const isRealRowName = rowName && rowName !== 'candidate' && rowName.length >= 4
        if (isRealName && isRealRowName && candidateName === rowName) {
          targetRowIndex = i + 1
          break
        }
      }
    }

    // 5. If candidate still not found, reuse an unassigned placeholder "Candidate" row (no email, no phone)
    if (targetRowIndex <= 0) {
      for (let i = 1; i < existingRows.length; i++) {
        const row = existingRows[i]
        const rowName = (row[nameColIdx] || row[0] || '').toLowerCase().trim()
        const rowEmail = (row[emailColIdx] || row[2] || '').toLowerCase().trim()
        const rowPhone = phoneColIdx >= 0 ? (row[phoneColIdx] || '').replace(/\D/g, '').trim() : ''

        if (rowName === 'candidate' && !rowEmail && !rowPhone) {
          targetRowIndex = i + 1
          break
        }
      }
    }

    // 6. If still not found, find first completely empty row in Column A or append after last row
    if (targetRowIndex <= 0) {
      let firstEmptyRow = -1
      for (let i = 1; i < existingRows.length; i++) {
        const row = existingRows[i]
        if (!row[0]?.trim() && !row[nameColIdx]?.trim()) {
          firstEmptyRow = i + 1
          break
        }
      }
      targetRowIndex = firstEmptyRow > 0 ? firstEmptyRow : existingRows.length + 1
    }

    // Write row directly starting at Column A (never use :append which can offset into Column W)
    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(sheetName)}!A${targetRowIndex}:Z${targetRowIndex}?valueInputOption=USER_ENTERED`

    const writeRes = await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [paddedValues] }),
    })

    if (!writeRes.ok) {
      throw new Error(`Sheets sync failed with HTTP ${writeRes.status}: ${await writeRes.text()}`)
    }

    const finalRowId = targetRowIndex

    // Update candidate in MongoDB
    if (candId) {
      await candCol.updateOne(
        { _id: new ObjectId(candId) },
        {
          $set: {
            sheetsSyncStatus: 'SYNCED',
            googleSheetsRowId: finalRowId,
            sheetsSyncError: undefined,
            updatedAt: new Date(),
          },
        }
      )
    }

    return {
      success: true,
      syncStatus: 'SYNCED',
      spreadsheetId,
      sheetName,
      rowId: finalRowId,
    }
  } catch (error: any) {
    console.error('Google Sheets sync error:', error)
    if (candId) {
      await candCol.updateOne(
        { _id: new ObjectId(candId) },
        {
          $set: {
            sheetsSyncStatus: 'FAILED',
            sheetsSyncError: error.message || 'Sheets sync failed',
            updatedAt: new Date(),
          },
        }
      )
    }

    return {
      success: false,
      syncStatus: 'FAILED',
      spreadsheetId,
      sheetName,
      error: error.message || 'Failed to sync row to Google Sheets',
    }
  }
}
