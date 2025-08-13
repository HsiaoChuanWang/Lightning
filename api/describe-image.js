// describe-image.js
import { GoogleGenerativeAI } from '@google/generative-ai'
import cors from 'cors'
import express from 'express'

const app = express()

app.use(cors())
app.use(express.json({ limit: '20mb' }))

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

app.post('/api/describe-image', async (req, res) => {
  const { prompt, imageList } = req.body

  if (!prompt || !Array.isArray(imageList) || imageList.length === 0) {
    return res.status(400).json({ error: '缺少 prompt 或 imageList' })
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'STRING',
          },
        },
      },
    })

    // 建立 contents 陣列，先放文字 prompt
    const contents = [{ text: prompt }]

    // 每張圖片都轉成 inlineData
    for (const imgUrl of imageList) {
      const response = await fetch(imgUrl)
      const imageArrayBuffer = await response.arrayBuffer()
      const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64')

      contents.push({
        inlineData: {
          mimeType: 'image/jpeg', // 或 'image/png'
          data: base64ImageData,
        },
      })
    }

    const result = await model.generateContent(contents)
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
