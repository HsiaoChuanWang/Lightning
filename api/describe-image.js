// describe-image.js
import { GoogleGenerativeAI } from '@google/generative-ai'
import cors from 'cors'
import express from 'express'

const app = express()

app.use(cors())
app.use(express.json({ limit: '20mb' }))

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// 新增一個 GET 路由，用來處理對根目錄的請求
app.get('/', (req, res) => {
  res.status(200).send('API is running!')
})

app.post('/api/describe-image', async (req, res) => {
  const { prompt, imageBase64 } = req.body

  if (!prompt || !imageBase64) {
    return res.status(400).json({ error: '缺少 prompt 或 imageBase64' })
  }

  try {
    const cleanedBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanedBase64,
        },
      },
    ])

    const text = result.response.text()
    res.json({ text })
  } catch (err) {
    console.error('Gemini API Error:', err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

// Vercel 伺服器less 函數不需要 app.listen()
// 相反地，我們需要匯出這個 Express 應用程式

export default app
