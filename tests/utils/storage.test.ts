// @ts-nocheck
import { getAnnotations, saveAnnotations, clearAnnotations } from '../../src/utils/storage'

describe('storage', () => {
  describe('getAnnotations', () => {
    it('returns empty array when no data stored', async () => {
      const result = await getAnnotations('/about')
      expect(result).toEqual([])
    })

    it('returns stored annotations for a path', async () => {
      const annotations = [{ id: '1', feedback: 'Fix this', status: 'active' }]
      await chrome.storage.local.set({ 'pinpoint:/about': annotations })
      const result = await getAnnotations('/about')
      expect(result).toEqual(annotations)
    })

    it('isolates annotations by path', async () => {
      const a1 = [{ id: '1', feedback: 'Page 1' }]
      const a2 = [{ id: '2', feedback: 'Page 2' }]
      await chrome.storage.local.set({ 'pinpoint:/page1': a1, 'pinpoint:/page2': a2 })
      expect(await getAnnotations('/page1')).toEqual(a1)
      expect(await getAnnotations('/page2')).toEqual(a2)
    })
  })

  describe('saveAnnotations', () => {
    it('persists annotations under the correct key', async () => {
      const annotations = [{ id: '1', feedback: 'Test' }]
      await saveAnnotations('/home', annotations)
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        'pinpoint:/home': annotations,
      })
    })

    it('overwrites previously saved annotations', async () => {
      await saveAnnotations('/home', [{ id: '1' }])
      await saveAnnotations('/home', [{ id: '2' }])
      const result = await getAnnotations('/home')
      expect(result).toEqual([{ id: '2' }])
    })
  })

  describe('clearAnnotations', () => {
    it('removes annotations for a path', async () => {
      await saveAnnotations('/about', [{ id: '1' }])
      await clearAnnotations('/about')
      const result = await getAnnotations('/about')
      expect(result).toEqual([])
    })
  })
})
