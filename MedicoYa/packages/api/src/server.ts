import 'dotenv/config'
import { createApp } from './app'

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const app = createApp()

app.listen(PORT, () => {
  console.log(`MédicoYa API running on port ${PORT}`)
})
