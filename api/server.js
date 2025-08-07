import { GoogleGenerativeAI } from '@google/generative-ai'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

dotenv.config()

const app = express()
const port = 3000

app.use(cors())
app.use(express.json({ limit: '20mb' })) // 避免 PayloadTooLargeError

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

app.post('/api/gemini', async (req, res) => {
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

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`)
})
