const express = require('express');
const cors = require('cors');
const proxy = require('express-http-proxy');
const { nanoid } = require('nanoid');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('💎 Claude Bridge Vault is running...');
});

app.listen(PORT, () => {
  console.log(`Vault server running on port ${PORT}`);
});
