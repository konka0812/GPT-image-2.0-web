import axios from 'axios'
import { computed, onMounted, ref, watch } from 'vue'
import { filterSizeOptions, flattenChannels, resolveOption } from './model-channels.js'
import { sizeOptions } from './image-sizes.js'

const storageKey = 'image-target-selection'

export function useModelChannels() {
  const channels = ref([])
  const selectedKey = ref('')
  const options = computed(() => flattenChannels(channels.value))
  const selected = computed(() => resolveOption(options.value, selectedKey.value))
  const allowedSizes = computed(() => selected.value?.sizes || [])
  const availableSizeOptions = computed(() => (allowedSizes.value.length ? filterSizeOptions(sizeOptions, allowedSizes.value) : sizeOptions))

  if (typeof localStorage !== 'undefined') selectedKey.value = localStorage.getItem(storageKey) || ''

  watch(selected, (value) => {
    if (!value?.key) return
    if (selectedKey.value !== value.key) selectedKey.value = value.key
    if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, value.key)
  })

  onMounted(async () => {
    try {
      const { data } = await axios.get('/api/model-channels')
      channels.value = data.channels || []
    } catch {
      channels.value = []
    }
  })

  return { channels, options, selectedKey, selected, allowedSizes, availableSizeOptions }
}
