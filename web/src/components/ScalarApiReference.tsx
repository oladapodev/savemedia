import { useEffect, useState, type ComponentType } from 'react'
import '@scalar/api-reference-react/style.css'

import { iMediaSaveOpenApiSpec } from '@/lib/imediasave-openapi'

type ScalarReferenceComponent = ComponentType<{
  configuration: {
    spec: {
      content: string
    }
  }
}>

export default function ScalarApiReference() {
  const [ApiReferenceReact, setApiReferenceReact] = useState<ScalarReferenceComponent | null>(null)

  useEffect(() => {
    let active = true

    void import('@scalar/api-reference-react').then((module) => {
      if (!active) return
      setApiReferenceReact(() => module.ApiReferenceReact as ScalarReferenceComponent)
    })

    return () => {
      active = false
    }
  }, [])

  if (!ApiReferenceReact) {
    return (
      <div className="rounded-3xl border border-orange-100 bg-white p-8 text-center text-sm text-gray-500 shadow-lg shadow-orange-500/5">
        Loading interactive API reference...
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-orange-100 bg-white shadow-xl shadow-orange-500/5">
      <ApiReferenceReact
        configuration={{
          spec: {
            content: JSON.stringify(iMediaSaveOpenApiSpec),
          },
        }}
      />
    </div>
  )
}
