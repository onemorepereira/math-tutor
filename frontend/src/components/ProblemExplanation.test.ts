// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProblemExplanation from './ProblemExplanation.vue'
import { useGameStore } from '@/stores/game'
import type { SolutionExplanation } from '@/types'

function explanation(problemId: string): SolutionExplanation {
  return {
    problemId,
    explanation: `Why ${problemId}`,
    steps: ['Keep the 4', 'Add the tops'],
    ageAppropriateInsight: 'Fractions are pieces'
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('ProblemExplanation', () => {
  let store: ReturnType<typeof useGameStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useGameStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('waits for "Show me how", then shows the explanation and steps', async () => {
    const pending = deferred<SolutionExplanation>()
    const load = vi.spyOn(store, 'getSolutionExplanation').mockReturnValue(pending.promise)
    const wrapper = mount(ProblemExplanation, { props: { problemId: 'p1' }, attachTo: document.body })

    expect(load).not.toHaveBeenCalled()
    await wrapper.get('[data-test="show-me-how"]').trigger('click')
    expect(wrapper.text()).toContain('Working it out...')
    pending.resolve(explanation('p1'))
    await flushPromises()

    expect(load).toHaveBeenCalledWith('p1')
    expect(wrapper.text()).toContain('Why p1')
    expect(wrapper.findAll('ol li').map((li) => li.text())).toEqual(['Keep the 4', 'Add the tops'])
    expect(wrapper.find('[data-test="show-me-how"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[data-test="explanation"]').element)
  })

  it('loads straight away with autoload', async () => {
    vi.spyOn(store, 'getSolutionExplanation').mockResolvedValue(explanation('p1'))
    const wrapper = mount(ProblemExplanation, { props: { problemId: 'p1', autoload: true } })
    await flushPromises()
    expect(wrapper.text()).toContain('Why p1')
  })

  it('offers Try again after a failure, and recovers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const load = vi.spyOn(store, 'getSolutionExplanation')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(explanation('p1'))
    const wrapper = mount(ProblemExplanation, { props: { problemId: 'p1', autoload: true }, attachTo: document.body })
    await flushPromises()

    expect(wrapper.text()).toContain("Couldn't load the explanation.")
    const retry = wrapper.get('[data-test="explanation-retry"]')
    expect(document.activeElement).toBe(retry.element)

    await retry.trigger('click')
    await flushPromises()
    expect(load).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Why p1')
  })

  it('ignores a slow response for a problem that is no longer shown', async () => {
    const first = deferred<SolutionExplanation>()
    const second = deferred<SolutionExplanation>()
    vi.spyOn(store, 'getSolutionExplanation')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const wrapper = mount(ProblemExplanation, { props: { problemId: 'a', autoload: true } })
    await wrapper.setProps({ problemId: 'b' })

    second.resolve(explanation('b'))
    await flushPromises()
    first.resolve(explanation('a'))
    await flushPromises()

    expect(wrapper.text()).toContain('Why b')
    expect(wrapper.text()).not.toContain('Why a')
  })

  it('keeps its clicks and keys from reaching a clickable parent', async () => {
    vi.spyOn(store, 'getSolutionExplanation').mockResolvedValue(explanation('p1'))
    const parentClick = vi.fn()
    const parentKey = vi.fn()
    const wrapper = mount({
      components: { ProblemExplanation },
      template: '<div @click="parentClick" @keydown="parentKey" @keyup="parentKey"><ProblemExplanation problem-id="p1" /></div>',
      setup: () => ({ parentClick, parentKey })
    })

    const button = wrapper.get('[data-test="show-me-how"]')
    await button.trigger('keydown', { key: 'Enter' })
    await button.trigger('keyup', { key: 'Enter' })
    await button.trigger('click')
    await flushPromises()

    expect(parentClick).not.toHaveBeenCalled()
    expect(parentKey).not.toHaveBeenCalled()
  })
})
