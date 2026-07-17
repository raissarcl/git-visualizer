import { describe, expect, it } from 'vitest'
import { parseWorkflowDispatchDetailed, parseWorkflowDispatchInputs } from './workflowYaml'

describe('parseWorkflowDispatchInputs', () => {
  it('returns null when workflow_dispatch is absent', () => {
    const yaml = `
name: CI
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`
    expect(parseWorkflowDispatchInputs(yaml)).toBeNull()
  })

  it('returns empty array when dispatch has no inputs', () => {
    const yaml = `
on:
  workflow_dispatch:
`
    expect(parseWorkflowDispatchInputs(yaml)).toEqual([])
  })

  it('parses typed inputs including amplify-style choice', () => {
    const yaml = `
on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Amplify environment (instance) to deploy to"
        required: true
        default: "polaris"
        type: choice
        options:
          - "aaa"
          - "franquia"
          - "empresa"
          - "all"
`
    const inputs = parseWorkflowDispatchInputs(yaml)
    expect(inputs).toHaveLength(1)
    expect(inputs?.[0]).toMatchObject({
      name: 'environment',
      type: 'choice',
      required: true,
      defaultValue: 'polaris',
      options: ['aaa', 'franquia', 'empresa', 'all'],
    })
  })

  it('accepts on as list including workflow_dispatch', () => {
    const yaml = `
on: [push, workflow_dispatch]
`
    expect(parseWorkflowDispatchInputs(yaml)).toEqual([])
  })

  it('reads dispatch when YAML 1.1 promoted on → true', () => {
    // Simula documento já com chave boolean (DEFAULT_SCHEMA)
    const yaml = `
on:
  workflow_dispatch:
    inputs:
      x:
        type: string
`
    // Forçar via parse detalhado — CORE deve achar; também cobrir chave true
    const detailed = parseWorkflowDispatchDetailed(yaml)
    expect(detailed.inputs).not.toBeNull()
    expect(detailed.inputs?.[0]?.name).toBe('x')
  })

  it('reports on keys when dispatch missing', () => {
    const yaml = `
on:
  push:
  pull_request:
`
    const detailed = parseWorkflowDispatchDetailed(yaml)
    expect(detailed.inputs).toBeNull()
    expect(detailed.onKeys).toEqual(expect.arrayContaining(['push', 'pull_request']))
    expect(detailed.rawMentionsDispatch).toBe(false)
  })

  it('flags raw mention when indentation put dispatch outside on', () => {
    const yaml = `
on:
  push:
workflow_dispatch:
  inputs:
    x:
      type: string
`
    const detailed = parseWorkflowDispatchDetailed(yaml)
    expect(detailed.inputs).toBeNull()
    expect(detailed.rawMentionsDispatch).toBe(true)
  })
})
