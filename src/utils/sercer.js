import express from 'express'
import fetch from 'node-fetch'

const app = express()
app.use(express.json())

app.get('/api/xandeum/pods', async (req, res) => {
  try {
    const rpcRes = await fetch('http://192.190.136.28:6000/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get-pods-with-stats',
        params: [],
      }),
    })

    const json = await rpcRes.json()

    res.json({ pods: json.result || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(3001, () => {
  console.log('Xandeum proxy running on :3001')
})
