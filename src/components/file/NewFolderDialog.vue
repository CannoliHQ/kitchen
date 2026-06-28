<script setup lang="ts">
import { ref } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

const emit = defineEmits<{
  create: [name: string]
  close: []
}>()

const name = ref('')

function submit() {
  const trimmed = name.value.trim()
  if (!trimmed) return
  emit('create', trimmed)
}
</script>

<template>
  <Modal :title="$t('common.newFolder')" @close="$emit('close')">
    <Input
      v-model="name"
      :placeholder="$t('common.folderName')"
      @keydown.enter="submit"
    />
    <template #footer>
      <Button variant="ghost" @click="$emit('close')">{{ $t('common.cancel') }}</Button>
      <Button :disabled="!name.trim()" @click="submit">{{ $t('common.create') }}</Button>
    </template>
  </Modal>
</template>
