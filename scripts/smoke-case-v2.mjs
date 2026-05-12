// Smoke test for v2 case content.
//
// Imports case-01-proryv JSON files, runs the v2 validator path, prints
// entity counts, and exits 0 on success or non-zero on validation failure.
//
// Usage:
//   node scripts/smoke-case-v2.mjs
//   npm run smoke:v2

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { scanV2Content } from './lib/visible-language.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const casesRoot = join(__dirname, '..', 'src', 'game', 'cases')

const dupes = (label, ids) => {
  const errs = []
  const seen = new Set()
  for (const id of ids) {
    if (seen.has(id)) errs.push(`Duplicate ${label} id: ${id}`)
    else seen.add(id)
  }
  return errs
}

function validateV2(caseDir) {
  const load = (file) => JSON.parse(readFileSync(join(caseDir, file), 'utf8'))
  const caseManifest = load('case.json')
  const hypotheses = load('hypotheses.json')
  const documents = load('documents.json')
  const contacts = load('contacts.json')
  const interviews = load('interviews.json')
  const actions = load('actions.json')
  const recommendations = load('recommendations.json')
  const epilogues = load('epilogues.json')

  const errors = []
  const warnings = []

  const hypothesisIds = new Set(hypotheses.map((h) => h.id))
  const documentIds = new Set(documents.map((d) => d.id))
  const contactIds = new Set(contacts.map((c) => c.id))
  const interviewIds = new Set(interviews.map((i) => i.id))
  const recommendationIds = new Set(recommendations.map((r) => r.id))

  errors.push(...dupes('hypothesis', hypotheses.map((h) => h.id)))
  errors.push(...dupes('document', documents.map((d) => d.id)))
  errors.push(...dupes('contact', contacts.map((c) => c.id)))
  errors.push(...dupes('interview', interviews.map((i) => i.id)))
  errors.push(...dupes('action', actions.map((a) => a.id)))
  errors.push(...dupes('recommendation', recommendations.map((r) => r.id)))
  errors.push(...dupes('epilogue', epilogues.map((e) => e.id)))

  // KeyPhrase validation
  for (const doc of documents) {
    for (let i = 0; i < doc.keyPhrases.length; i++) {
      const kp = doc.keyPhrases[i]
      const prefix = `document[${doc.id}].keyPhrases[${i}]`
      if (!Array.isArray(kp.range) || kp.range.length !== 2) {
        errors.push(`${prefix}: range must be a [start, end) pair`)
      } else {
        const [start, end] = kp.range
        if (start < 0 || end > doc.body.length || start >= end) {
          errors.push(`${prefix}: range [${start}, ${end}) out of bounds (body length ${doc.body.length})`)
        }
      }
      if (Array.isArray(kp.worksOn)) {
        for (const hid of kp.worksOn) {
          if (!hypothesisIds.has(hid)) {
            errors.push(`${prefix}.worksOn references unknown hypothesis: ${hid}`)
          }
        }
      }
    }
  }

  for (const ct of contacts) {
    if (ct.gateRequirement?.requiredHypothesis) {
      if (!hypothesisIds.has(ct.gateRequirement.requiredHypothesis)) {
        errors.push(`contact[${ct.id}].gateRequirement.requiredHypothesis references unknown hypothesis: ${ct.gateRequirement.requiredHypothesis}`)
      }
    }
    if (!interviewIds.has(ct.interviewId)) {
      errors.push(`contact[${ct.id}].interviewId references unknown interview: ${ct.interviewId}`)
    }
  }

  for (const intv of interviews) {
    if (!contactIds.has(intv.contactId)) {
      errors.push(`interview[${intv.id}].contactId references unknown contact: ${intv.contactId}`)
    }
    const nodeIds = new Set(intv.nodes.map((n) => n.id))
    errors.push(...dupes(`interview[${intv.id}] node`, intv.nodes.map((n) => n.id)))
    if (!nodeIds.has(intv.startNodeId)) {
      errors.push(`interview[${intv.id}].startNodeId references unknown node: ${intv.startNodeId}`)
    }
    for (const node of intv.nodes) {
      if (node.next !== undefined && !nodeIds.has(node.next)) {
        errors.push(`interview[${intv.id}].node[${node.id}].next references unknown node: ${node.next}`)
      }
      if (Array.isArray(node.choices)) {
        for (const ch of node.choices) {
          if (!nodeIds.has(ch.next)) {
            errors.push(`interview[${intv.id}].node[${node.id}].choice[${ch.id}].next references unknown node: ${ch.next}`)
          }
          if (ch.requiresPhraseFromHypothesis && !hypothesisIds.has(ch.requiresPhraseFromHypothesis)) {
            errors.push(`interview[${intv.id}].node[${node.id}].choice[${ch.id}].requiresPhraseFromHypothesis references unknown hypothesis: ${ch.requiresPhraseFromHypothesis}`)
          }
        }
      }
    }
  }

  for (const act of actions) {
    for (const eff of act.effects) {
      if (eff.kind === 'unlockDocument' && !documentIds.has(eff.documentId)) {
        errors.push(`action[${act.id}].effect unlockDocument references unknown document: ${eff.documentId}`)
      }
      if (eff.kind === 'unlockContact' && !contactIds.has(eff.contactId)) {
        errors.push(`action[${act.id}].effect unlockContact references unknown contact: ${eff.contactId}`)
      }
    }
  }

  for (const rec of recommendations) {
    for (const req of rec.requiresHypotheses) {
      if (!hypothesisIds.has(req.hypothesisId)) {
        errors.push(`recommendation[${rec.id}].requiresHypotheses references unknown hypothesis: ${req.hypothesisId}`)
      }
    }
  }

  const epiloguesByRec = new Map()
  for (const ep of epilogues) {
    if (!recommendationIds.has(ep.recommendationId)) {
      errors.push(`epilogue[${ep.id}].recommendationId references unknown recommendation: ${ep.recommendationId}`)
    }
    if (!epiloguesByRec.has(ep.recommendationId)) epiloguesByRec.set(ep.recommendationId, new Set())
    epiloguesByRec.get(ep.recommendationId).add(ep.quality)
  }
  for (const rec of recommendations) {
    const quals = epiloguesByRec.get(rec.id) ?? new Set()
    for (const q of ['precise', 'imprecise', 'incorrect']) {
      if (!quals.has(q)) {
        errors.push(`recommendation[${rec.id}] is missing an epilogue with quality "${q}"`)
      }
    }
  }

  if (!(caseManifest.actionBudget >= 1)) {
    errors.push('actionBudget must be >= 1')
  }

  const v2Content = { caseManifest, hypotheses, documents, contacts, interviews, actions, recommendations, epilogues }
  for (const w of scanV2Content(v2Content)) warnings.push(w)

  return {
    caseId: caseManifest.id,
    counts: {
      documents: documents.length,
      contacts: contacts.length,
      hypotheses: hypotheses.length,
      interviews: interviews.length,
      actions: actions.length,
      recommendations: recommendations.length,
      epilogues: epilogues.length,
    },
    errors,
    warnings,
  }
}

// Run for case-01-proryv
const caseDir = join(casesRoot, 'case-01-proryv')
const { caseId, counts, errors, warnings } = validateV2(caseDir)

console.log(`\n[${caseId}] (v2 smoke)`)
console.log(`  Counts: documents=${counts.documents}, contacts=${counts.contacts}, hypotheses=${counts.hypotheses}, interviews=${counts.interviews}, actions=${counts.actions}, recommendations=${counts.recommendations}, epilogues=${counts.epilogues}`)

if (warnings.length > 0) {
  console.log('  Warnings:')
  for (const w of warnings) console.log('   - ' + w)
}

if (errors.length === 0) {
  console.log('  OK: v2 case content is valid')
  process.exit(0)
} else {
  console.error('  Errors:')
  for (const e of errors) console.error('   - ' + e)
  console.error(`\nSmoke test FAILED (${errors.length} error(s))`)
  process.exit(1)
}
