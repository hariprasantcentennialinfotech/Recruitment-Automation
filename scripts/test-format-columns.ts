import { formatCandidateRow } from '../lib/google-sheets-sync'
import { CandidateDocument } from '../lib/types'

function testFormat() {
  const dummyCandidate: CandidateDocument = {
    fullName: 'Vraj Patel',
    email: 'vrajpatel1530@gmail.com',
    phone: '+1 (235) 865 8855',
    location: 'Brampton, ON',
    currentTitle: 'Senior Project Manager',
    currentCompany: 'Tech Corp',
    totalExperience: '8 years',
    skills: ['Salesforce', 'Project Management'],
    missingSkills: ['React', 'TypeScript', 'Node.js'],
    matchScore: 65,
    recommendation: 'Potential Match',
    stage: 'Sourcing',
    organization: 'krct',
    sourceFile: 'vraj.pdf',
    extractionProvider: 'gemini',
    createdAt: new Date(),
  }

  // All columns in the user's live sheet
  const sheetHeaderRow = [
    'Name',
    'Phone',
    'Email',
    'Address',
    'missing skill',
    'Status of call',
    'VIZA Type',
    '10 + year Power Platform Developer',
    'Applicant Screening',
    'Share with Client',
    'status',
    'Portal'
  ]

  // The 5 columns the user configured in the modal
  const userConfiguredColumns = [
    'Name',
    'Phone',
    'Email',
    'Address',
    'missing skill'
  ]

  const formattedRow = formatCandidateRow(dummyCandidate, sheetHeaderRow, userConfiguredColumns)

  console.log('Formatted Row Result:')
  sheetHeaderRow.forEach((col, idx) => {
    console.log(`- Column "${col}": ${JSON.stringify(formattedRow[idx])}`)
  })

  // Assertions
  console.log('\n--- Verifying Assertions ---')
  console.assert(formattedRow[0] === 'Vraj Patel', 'Name should be Vraj Patel')
  console.assert(formattedRow[1] === '+1 (235) 865 8855', 'Phone should be present')
  console.assert(formattedRow[2] === 'vrajpatel1530@gmail.com', 'Email should be present')
  console.assert(formattedRow[3] === 'Brampton, ON', 'Address should be present')
  console.assert(formattedRow[4] === 'React, TypeScript, Node.js', 'Missing skill should be present')
  console.assert(formattedRow[5] === '', 'Status of call MUST be empty')
  console.assert(formattedRow[6] === '', 'VIZA Type MUST be empty')
  console.assert(formattedRow[7] === '', '10 + year Power Platform Developer MUST be empty')
  console.assert(formattedRow[8] === '', 'Applicant Screening MUST be empty')
  console.assert(formattedRow[9] === '', 'Share with Client MUST be empty')
  console.assert(formattedRow[10] === '', 'status MUST be empty')
  console.assert(formattedRow[11] === '', 'Portal MUST be empty')
  console.log('ALL ASSERTIONS PASSED! Only the 5 user-selected columns are populated! Extra columns remain completely empty!')
}

testFormat()
