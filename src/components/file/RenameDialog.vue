<script setup lang="ts">
import { ref } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps<{
  currentName: string
}>()

const emit = defineEmits<{
  rename: [name: string]
  close: []
}>()

const name = ref(props.currentName)

function submit() {
  const trimmed = name.value.trim()
  if (!trimmed || trimmed === props.currentName) return
  emit('rename', trimmed)
}
</script>

<template>
  <Modal title="Rename" @close="$emit('close')">
    <Input
      v-model="name"
      placeholder="Name"
      @keydown.enter="submit"
    />
    <template #footer>
      <Button variant="ghost" @click="$emit('close')">Cancel</Button>
      <Button :disabled="!name.trim() || name.trim() === props.currentName" @click="submit">Rename</Button>
    </template>
  </Modal>
</template>
