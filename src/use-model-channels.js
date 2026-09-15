import axios from 'axios'
import { computed, onMounted, ref, watch } from 'vue'
import { availableTiers, flattenChannels, normalizeSelection, ratiosForTier, resolveOption, sizeFor } from './model-channels.js'
import { formatPixels, sizeCatalog } from './image-sizes.js'

const storageKey = 'image-target-selection'

export function useModelChannels(form) {
  const channels = ref([])
  const selectedKey = ref('')
  const selectedTier = ref('')
  const selectedRatio = ref('')

  const options = computed(() => flattenChannels(channels.value))
  const selected = computed(() => resolveOption(options.value, selectedKey.value))
  const allowedCatalog = computed(() => {
    const allowed = selected.value?.sizes || []
    if (!allowed.length) return sizeCatalog
    const values = new Set(allowed)
    return sizeCatalog.filter((entry) => values.has(entry.value))
  })
  const tierOptions = computed(() => availableTiers(allowedCatalog.value))
  const ratioOptions = computed(() => ratiosForTier(allowedCatalog.value, selectedTier.value).map((ratio) => {
    const entry = sizeFor(allowedCatalog.value, selectedTier.value, ratio)
    return { value: ratio, label: entry ? `${entry.ratio} ${entry.name}` : ratio }
  }))
  const currentEntry = computed(() => sizeFor(allowedCatalog.value, selectedTier.value, selectedRatio.value))
  const currentSizeLabel = computed(() => (currentEntry.value ? `${currentEntry.value.tier} ${currentEntry.value.ratio} ${currentEntry.value.name} · ${formatPixels(currentEntry.value.value)}` : ''))

  function applySize() {
    const entry = sizeFor(allowedCatalog.value, selectedTier.value, selectedRatio.value)
    if (entry && form?.value) form.value.size = entry.value
  }

  function syncFromSize() {
    if (!form?.value) return
    const next = normalizeSelection(allowedCatalog.value, form.value.size, selectedTier.value, selectedRatio.value)
    if (selectedTier.value !== next.tier) selectedTier.value = next.tier
    if (selectedRatio.value !== next.ratio) selectedRatio.value = next.ratio
    if (next.value && form.value.size !== next.value) form.value.size = next.value
  }

  watch(selected, (value) => {
    if (!value?.key) return
    if (selectedKey.value !== value.key) selectedKey.value = value.key
    if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, value.key)
    syncFromSize()
  })

  watch(selectedTier, () => {
    const ratios = ratiosForTier(allowedCatalog.value, selectedTier.value)
    if (!ratios.includes(selectedRatio.value)) selectedRatio.value = ratios[0] || ''
    applySize()
  })

  watch(selectedRatio, applySize)

  if (typeof localStorage !== 'undefined') selectedKey.value = localStorage.getItem(storageKey) || ''

  onMounted(async () => {
    try {
      const { data } = await axios.get('/api/model-channels')
      channels.value = data.channels || []
    } catch {
      channels.value = []
    }
    syncFromSize()
  })

  return { channels, options, selectedKey, selected, selectedTier, selectedRatio, tierOptions, ratioOptions, allowedCatalog, currentSizeLabel }
}
