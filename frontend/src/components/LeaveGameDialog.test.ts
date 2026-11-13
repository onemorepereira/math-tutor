// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LeaveGameDialog from './LeaveGameDialog.vue'

// jsdom's <dialog> support is not relied on: showModal/close are stubbed to
// behave like the browser (open attribute, close event)
const proto = HTMLDialogElement.prototype as any
const original = { showModal: proto.showModal, close: proto.close }

function stubDialog() {
  proto.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
  proto.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  })
}

describe('LeaveGameDialog', () => {
  beforeEach(stubDialog)

  afterEach(() => {
    proto.showModal = original.showModal
    proto.close = original.close
    vi.restoreAllMocks()
  })

  it('opens as a modal with the leave question and focuses Keep playing by default', async () => {
    const wrapper = mount(LeaveGameDialog, { props: { open: false } })
    expect(proto.showModal).not.toHaveBeenCalled()

    await wrapper.setProps({ open: true })

    expect(proto.showModal).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Leave this game?')
    expect(wrapper.text()).toContain('Your progress is saved. You can continue it from Home.')
    expect(wrapper.get('[data-test="keep-playing"]').attributes('autofocus')).toBeDefined()
  })

  it('does not reopen a dialog that is already open', async () => {
    const wrapper = mount(LeaveGameDialog, { props: { open: true } })
    await wrapper.setProps({ open: false })
    wrapper.get('dialog').element.setAttribute('open', '')
    await wrapper.setProps({ open: true })
    expect(proto.showModal).toHaveBeenCalledOnce()
  })

  it('emits leave from the Leave button, and nothing else', async () => {
    const wrapper = mount(LeaveGameDialog, { props: { open: true } })
    await wrapper.get('[data-test="leave"]').trigger('click')
    expect(wrapper.emitted('leave')).toHaveLength(1)
    expect(wrapper.emitted('stay')).toBeUndefined()
  })

  it('emits stay from Keep playing', async () => {
    const wrapper = mount(LeaveGameDialog, { props: { open: true } })
    await wrapper.get('[data-test="keep-playing"]').trigger('click')
    expect(wrapper.emitted('stay')).toHaveLength(1)
    expect(wrapper.emitted('leave')).toBeUndefined()
  })

  it('treats Escape (a close without Leave, with or without cancel) as stay', async () => {
    const wrapper = mount(LeaveGameDialog, { props: { open: true } })
    // Chrome may close on a repeated Escape without firing cancel
    wrapper.get('dialog').element.dispatchEvent(new Event('close'))
    expect(wrapper.emitted('stay')).toHaveLength(1)
  })

  it('falls back to a confirm prompt where <dialog> is unsupported', async () => {
    delete proto.showModal
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false)

    const wrapper = mount(LeaveGameDialog, { props: { open: true } })
    expect(confirm).toHaveBeenCalledWith('Leave this game? Your progress is saved. You can continue it from Home.')
    expect(wrapper.emitted('leave')).toHaveLength(1)

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    expect(wrapper.emitted('stay')).toHaveLength(1)
  })
})
