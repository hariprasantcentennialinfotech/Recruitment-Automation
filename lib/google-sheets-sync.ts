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
  columns?: string[]
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
    const norm = col.toLowerCase().trim()

    // 1. Direct match in customFields extracted by Gemini
    if (custom[col] !== undefined && custom[col] !== '') return String(custom[col])
    for (const [k, v] of Object.entries(custom)) {
      if (k.toLowerCase().trim() === norm && v !== '') return String(v)
    }

    // 2. Intelligent mapping to candidate document properties
    if (norm.includes('name') || norm === 'candidate') return candidate.fullName || ''
    if (norm.includes('email') || norm === 'mail') return candidate.email || ''
    if (norm.includes('phone') || norm.includes('mobile') || norm.includes('contact')) return candidate.phone || ''
    if (norm.includes('location') || norm.includes('city') || norm.includes('country')) return candidate.location || ''
    if (norm.includes('title') || norm.includes('designation') || norm.includes('role') || norm.includes('position')) return candidate.currentTitle || ''
    if (norm.includes('company') || norm.includes('organization') || norm.includes('employer')) return candidate.currentCompany || ''
    if (norm.includes('experience') || norm.includes('years') || norm.includes('exp')) return candidate.totalExperience || ''
    if (norm.includes('matching') && norm.includes('skill')) return (candidate.matchingSkills || []).join(', ')
    if (norm.includes('missing') && norm.includes('skill')) return (candidate.missingSkills || []).join(', ')
    if (norm.includes('skill')) return (candidate.skills || []).join(', ')
    if (norm.includes('score') || norm.includes('rating')) return candidate.matchScore !== undefined ? `${candidate.matchScore}%` : ''
    if (norm.includes('recommendation') || norm.includes('decision') || norm.includes('fit')) return candidate.recommendation || ''
    if (norm.includes('education') || norm.includes('degree') || norm.includes('qualification')) {
      if (Array.isArray(candidate.education)) {
        return candidate.education.map((e: any) => typeof e === 'string' ? e : `${e.degree || ''} (${e.institution})`).join('; ')
      }
      return String(candidate.education || '')
    }
    if (norm.includes('certif')) return (candidate.certifications || []).join(', ')
    if (norm.includes('authorization') || norm.includes('visa') || norm.includes('work auth')) return candidate.workAuthorization || ''
    if (norm.includes('availability') || norm.includes('notice')) return candidate.availability || ''
    if (norm.includes('resume') || norm.includes('link') || norm.includes('cv') || norm.includes('drive')) return resumeRef
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

    const rowValues = formatCandidateRow(candidate, activeColumns)

    // Check for existing candidate row (by email or normalized name)
    let targetRowIndex = -1
    const candidateEmail = (candidate.email || '').toLowerCase().trim()
    const candidateName = (candidate.fullName || '').toLowerCase().trim()

    // Find email column index and name column index
    let nameColIdx = 0
    let emailColIdx = 1
    for (let c = 0; c < activeColumns.length; c++) {
      const colLower = activeColumns[c].toLowerCase().trim()
      if (colLower.includes('name') || colLower === 'candidate') nameColIdx = c
      if (colLower.includes('email') || colLower === 'mail') emailColIdx = c
    }

    for (let i = 1; i < existingRows.length; i++) {
      const row = existingRows[i]
      const rowName = (row[nameColIdx] || '').toLowerCase().trim()
      const rowEmail = (row[emailColIdx] || '').toLowerCase().trim()

      if ((candidateEmail && rowEmail === candidateEmail) || (candidateName && rowName === candidateName)) {
        targetRowIndex = i + 1 // 1-indexed for Sheets API
        break
      }
    }

    let finalRowId = targetRowIndex

    if (targetRowIndex > 0) {
      // Update existing row
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(sheetName)}!A${targetRowIndex}:Z${targetRowIndex}?valueInputOption=USER_ENTERED`

      const updateRes = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      })

      if (!updateRes.ok) {
        throw new Error(`Sheets update failed with HTTP ${updateRes.status}: ${await updateRes.text()}`)
      }
    } else {
      // Append new row
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(sheetName)}!A:Z:append?valueInputOption=USER_ENTERED`

      const appendRes = await fetch(appendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      })

      if (!appendRes.ok) {
        throw new Error(`Sheets append failed with HTTP ${appendRes.status}: ${await appendRes.text()}`)
      }

      finalRowId = existingRows.length + 1
    }

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
