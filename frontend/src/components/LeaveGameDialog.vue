<template>
  <!-- Native modal dialog: the browser makes the page inert, traps focus
       and closes on Escape (treated as "Keep playing") -->
  <dialog
    ref="dialog"
    class="leave-dialog"
    aria-labelledby="leave-dialog-title"
    aria-describedby="leave-dialog-text"
    @close="handleClose"
  >
    <h3 id="leave-dialog-title">{{ TITLE }}</h3>
    <p id="leave-dialog-text">{{ TEXT }}</p>
    <div class="leave-actions">
      <button type="button" class="btn btn-primary" data-test="keep-playing" autofocus @click="stay">
        Keep playing
      </button>
      <button type="button" class="btn btn-secondary" data-test="leave" @click="leave">
        Leave
      </button>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const TITLE = 'Leave this game?'
const TEXT = 'Your progress is saved. You can continue it from Home.'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ leave: []; stay: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
let leaving = false

function show() {
  const el = dialog.value
  if (!el) return

  if (typeof el.showModal !== 'function') {
    // Very old browsers: same question, native prompt
    if (window.confirm(`${TITLE} ${TEXT}`)) emit('leave')
    else emit('stay')
    return
  }

  if (!el.open) el.showModal()
}

function stay() {
  dialog.value?.close()
}

function leave() {
  leaving = true
  dialog.value?.close()
}

// Every way of closing ends here: Leave, Keep playing, or Escape (Chrome may
// skip the cancel event on a repeated Escape, so close is the reliable signal)
function handleClose() {
  if (leaving) {
    leaving = false
    emit('leave')
  } else {
    emit('stay')
  }
}

watch(() => props.open, (open) => {
  if (open) show()
})

onMounted(() => {
  if (props.open) show()
})
</script>

<style scoped>
.leave-dialog {
  border: none;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 400px;
  width: calc(100% - 2rem);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.leave-dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

.leave-dialog h3 {
  margin-bottom: 0.5rem;
  color: #333;
}

.leave-dialog p {
  color: #495057;
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

.leave-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

@media (max-width: 480px) {
  .leave-actions {
    flex-direction: column;
  }

  .leave-actions .btn {
    width: 100%;
  }
}
</style>
