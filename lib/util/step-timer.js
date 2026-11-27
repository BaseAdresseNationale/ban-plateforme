import {performance} from 'node:perf_hooks'

// Mesure la durée de chaque étape d'un traitement et l'écrit en une seule ligne de log,
// pour pouvoir filtrer facilement dans Loki/Grafana, par exemple :
// [step-timer] delta-report address districtID=… received=65000 | fetchExisting=243ms compare=30ms … | total=3012ms
export const createStepTimer = (label, context = {}) => {
  const startedAt = performance.now()
  let lastStepAt = startedAt
  const steps = []
  const metrics = {...context}

  const formatPairs = entries => entries.map(([key, value]) => `${key}=${value}`).join(' ')

  return {
    // Termine l'étape en cours, qui a commencé à la fin de l'étape précédente
    step(name) {
      const now = performance.now()
      steps.push([name, `${Math.round(now - lastStepAt)}ms`])
      lastStepAt = now
    },

    // Ajoute des compteurs à la ligne de log (nombre de lignes lues, etc.)
    set(values) {
      Object.assign(metrics, values)
    },

    end({error} = {}) {
      const total = Math.round(performance.now() - startedAt)
      const status = error ? ` | error=${error.name || 'Error'}` : ''
      console.log(`[step-timer] ${label} ${formatPairs(Object.entries(metrics))} | ${formatPairs(steps)} | total=${total}ms${status}`)
    },
  }
}
