/**
 * Extrai inputs de workflow_dispatch a partir do YAML do workflow.
 */

import * as jsyaml from 'js-yaml'
import type { WorkflowInput, WorkflowInputType } from '../domain/workflowRun'

const { CORE_SCHEMA, load: loadYaml } = jsyaml
/** Schema 1.1 — promove `on:` para chave boolean/`"true"`. */
const YAML11_SCHEMA = (jsyaml as typeof jsyaml & { YAML11_SCHEMA: jsyaml.Schema }).YAML11_SCHEMA

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function normalizeType(raw: unknown): WorkflowInputType {
  const t = asString(raw, 'string').toLowerCase()
  if (t === 'boolean' || t === 'choice' || t === 'environment' || t === 'number') return t
  return 'string'
}

/** YAML 1.1 pode promover a chave `on` para boolean true → propriedade `"true"`. */
function getOnNode(doc: Record<string, unknown>): unknown {
  if ('on' in doc) return doc.on
  if ('true' in doc) return doc.true
  return undefined
}

function describeOnKeys(onNode: unknown): string[] {
  if (onNode === 'workflow_dispatch') return ['workflow_dispatch']
  if (Array.isArray(onNode)) {
    return onNode.map((item) => {
      if (typeof item === 'string') return item
      if (isRecord(item)) return Object.keys(item).join('|') || '(objeto)'
      return String(item)
    })
  }
  if (isRecord(onNode)) return Object.keys(onNode)
  if (onNode === undefined) return []
  return [String(onNode)]
}

function extractDispatchBlock(onNode: unknown): Record<string, unknown> | null {
  if (onNode === 'workflow_dispatch') return {}

  if (Array.isArray(onNode)) {
    for (const item of onNode) {
      if (item === 'workflow_dispatch') return {}
      if (isRecord(item) && 'workflow_dispatch' in item) {
        return extractDispatchBlock(item)
      }
    }
    return null
  }

  if (!isRecord(onNode)) return null
  if (!('workflow_dispatch' in onNode)) return null

  const block = onNode.workflow_dispatch
  if (block === null || block === undefined || block === true) return {}
  if (isRecord(block)) return block
  return {}
}

function mapInput(name: string, raw: unknown): WorkflowInput {
  if (!isRecord(raw)) {
    return {
      name,
      description: '',
      required: false,
      type: 'string',
      defaultValue: '',
      options: [],
    }
  }

  const options = Array.isArray(raw.options)
    ? raw.options.map((o) => asString(o)).filter(Boolean)
    : []

  return {
    name,
    description: asString(raw.description),
    required: Boolean(raw.required),
    type: normalizeType(raw.type),
    defaultValue: asString(raw.default),
    options,
  }
}

function inputsFromDispatch(dispatch: Record<string, unknown>): WorkflowInput[] {
  const inputsRaw = dispatch.inputs
  if (!isRecord(inputsRaw)) return []
  return Object.entries(inputsRaw).map(([name, value]) => mapInput(name, value))
}

export interface WorkflowDispatchParseResult {
  /** null = sem workflow_dispatch no `on` */
  inputs: WorkflowInput[] | null
  onKeys: string[]
  /** Texto bruto menciona workflow_dispatch (mesmo se o parse estruturado falhou) */
  rawMentionsDispatch: boolean
  parseError?: string
}

function tryParseDoc(yamlText: string, schema: jsyaml.Schema): unknown {
  return loadYaml(yamlText, { schema })
}

function resultFromDoc(doc: unknown, rawMentionsDispatch: boolean): WorkflowDispatchParseResult {
  if (!isRecord(doc)) {
    return {
      inputs: null,
      onKeys: [],
      rawMentionsDispatch,
      parseError: 'YAML raiz não é um objeto',
    }
  }

  const onNode = getOnNode(doc)
  const onKeys = describeOnKeys(onNode)
  const dispatch = extractDispatchBlock(onNode)

  if (dispatch === null) {
    return { inputs: null, onKeys, rawMentionsDispatch }
  }

  return {
    inputs: inputsFromDispatch(dispatch),
    onKeys,
    rawMentionsDispatch: true,
  }
}

/**
 * Parse detalhado — preferir CORE_SCHEMA; fallback DEFAULT (chave `on` → `true`).
 */
export function parseWorkflowDispatchDetailed(yamlText: string): WorkflowDispatchParseResult {
  const rawMentionsDispatch = /workflow_dispatch/i.test(yamlText)

  try {
    const coreDoc = tryParseDoc(yamlText, CORE_SCHEMA)
    const core = resultFromDoc(coreDoc, rawMentionsDispatch)
    if (core.inputs !== null) return core

    // Fallback: YAML 1.1 (chave `on` → `true`)
    try {
      const defaultDoc = tryParseDoc(yamlText, YAML11_SCHEMA)
      const fallback = resultFromDoc(defaultDoc, rawMentionsDispatch)
      if (fallback.inputs !== null) return fallback
      // Preferir onKeys do CORE (mais legível) se ambos sem dispatch
      return {
        inputs: null,
        onKeys: core.onKeys.length > 0 ? core.onKeys : fallback.onKeys,
        rawMentionsDispatch,
        parseError: core.parseError ?? fallback.parseError,
      }
    } catch {
      return core
    }
  } catch (err) {
    return {
      inputs: null,
      onKeys: [],
      rawMentionsDispatch,
      parseError: err instanceof Error ? err.message : 'Falha ao parsear YAML',
    }
  }
}

/**
 * Retorna inputs de `on.workflow_dispatch`, ou `null` se o workflow não tiver dispatch.
 */
export function parseWorkflowDispatchInputs(yamlText: string): WorkflowInput[] | null {
  return parseWorkflowDispatchDetailed(yamlText).inputs
}
