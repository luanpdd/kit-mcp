export const meta = {
  name: 'sample-dynamic-workflow',
  description: 'Fixture workflow — exercises the sync pipeline for the workflows capability.',
  phases: [{ title: 'Demo' }],
}

phase('Demo')
const result = await agent('Fixture agent prompt — not invoked in unit tests.', { label: 'demo' })
return { ok: true, result }
