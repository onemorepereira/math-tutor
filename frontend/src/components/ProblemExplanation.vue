<template>
  <!-- Clicks and keys stop here: the scorecard nests this inside a clickable row,
       and the game's feedback card advances on Enter -->
  <div class="problem-explanation" @click.stop @keydown.stop @keyup.stop>
    <button
      v-if="state === 'idle'"
      type="button"
      class="btn btn-secondary"
      data-test="show-me-how"
      @click="load"
    >
      💡 Show me how
    </button>

    <p v-else-if="state === 'loading'" class="loading-explanation" role="status">Working it out...</p>

    <div v-else-if="state === 'error'" class="explanation-error" role="alert">
      <span>Couldn't load the explanation.</span>
      <button
        ref="retryButton"
        type="button"
        class="btn btn-secondary"
        data-test="explanation-retry"
        @click="load"
      >
        Try again
      </button>
    </div>

    <div
      v-else-if="explanation"
      ref="content"
      class="explanation-content"
      tabindex="-1"
      data-test="explanation"
    >
      <h4>How to Solve This:</h4>
      <p class="explanation-text">{{ explanation.explanation }}</p>

      <div v-if="explanation.steps.length > 0" class="steps-section">
        <h5>Step by Step:</h5>
        <ol class="steps-list">
          <li v-for="(step, index) in explanation.steps" :key="index">{{ step }}</li>
        </ol>
      </div>

      <div v-if="explanation.ageAppropriateInsight" class="insight-section">
        <h5>Insight:</h5>
        <p class="insight-text">{{ explanation.ageAppropriateInsight }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import type { SolutionExplanation } from '@/types'

const props = withDefaults(defineProps<{ problemId: string; autoload?: boolean }>(), {
  autoload: false
})

const gameStore = useGameStore()
const state = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')
const explanation = ref<SolutionExplanation | null>(null)
const content = ref<HTMLElement | null>(null)
const retryButton = ref<HTMLButtonElement | null>(null)

// Only the latest request may update the view: a slow answer for a problem
// that is no longer shown must not appear under the current one
let latestRequest = 0

async function load() {
  const request = ++latestRequest
  const problemId = props.problemId
  state.value = 'loading'
  explanation.value = null

  try {
    const result = await gameStore.getSolutionExplanation(problemId)
    if (request !== latestRequest) return
    if (!result) throw new Error('No explanation returned')
    explanation.value = result
    state.value = 'loaded'
    await nextTick()
    content.value?.focus()
  } catch (error) {
    if (request !== latestRequest) return
    console.error('Failed to load explanation:', error)
    state.value = 'error'
    await nextTick()
    retryButton.value?.focus()
  }
}

function reset() {
  latestRequest++
  explanation.value = null
  state.value = 'idle'
}

watch(() => props.problemId, () => {
  reset()
  if (props.autoload) load()
})

onMounted(() => {
  if (props.autoload) load()
})
</script>

<style scoped>
.problem-explanation {
  margin-top: 1rem;
}

.loading-explanation {
  text-align: center;
  padding: 1.5rem;
  color: #495057;
}

.explanation-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  color: #721c24;
}

.explanation-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  text-align: left;
}

.explanation-content h4,
.explanation-content h5 {
  color: #4c51bf;
  margin-bottom: 0.5rem;
}

.explanation-text {
  color: #333;
  line-height: 1.6;
}

.steps-section {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
}

.steps-list {
  margin: 0.5rem 0 0 1.5rem;
  color: #333;
}

.steps-list li {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.insight-section {
  background: #e7f3ff;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #0066cc;
}

.insight-text {
  color: #0066cc;
  line-height: 1.6;
  margin: 0;
}

@media (max-width: 768px) {
  .explanation-content {
    gap: 1rem;
  }

  .explanation-text,
  .insight-text {
    font-size: 0.95rem;
  }

  .steps-section,
  .insight-section {
    padding: 0.75rem;
  }
}
</style>
