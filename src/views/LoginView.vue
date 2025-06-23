<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import router from '@/router'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'

const userName = ref('')
const selectedFile = ref<File | null>(null)

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

async function uploadFileToSupabase(
  bucketName: string,
  folderPath: string,
  file: File,
): Promise<string | null> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${uuidv4()}.${fileExt}`
  const filePath = `${folderPath}/${fileName}`

  const { data, error } = await supabase.storage.from(bucketName).upload(filePath, file)

  if (error) {
    console.error('supabase storage upload failed:', error)
    return null
  }

  const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath)

  return publicUrlData.publicUrl
}

async function handleStart(event: Event) {
  if (!userName.value) {
    alert('請輸入 User Name')
    return
  }
  if (!selectedFile.value) {
    alert('請選擇上傳的圖片')
    return
  }

  const publicUrl = await uploadFileToSupabase('storage', 'avatars', selectedFile.value)

  const { data, error } = await supabase
    .from('user')
    .insert([
      {
        username: userName.value,
        avatar_url: publicUrl,
      },
    ])
    .select()

  if (error) {
    console.error('寫入資料庫失敗:', error)
    alert('資料庫寫入失敗')
    return
  }

  console.log('成功新增資料:', data)
  router.push('/home')
}
</script>

<template>
  <div class="login-view">
    <h1>Login</h1>

    <div>
      <label for="username">User Name: </label>
      <input id="username" v-model="userName" type="text" />
    </div>

    <div>
      <label for="file">Upload Image: </label>
      <input id="file" type="file" accept="image/*" @change="handleFileChange" />
    </div>

    <button @click="handleStart">Start !</button>
  </div>
</template>

<style>
@media (min-width: 1024px) {
  .login-view {
    min-height: 100vh;
    display: flex;
    align-items: self-start;
    flex-direction: column;
    justify-content: center;
    gap: 20px;
  }
}
</style>
