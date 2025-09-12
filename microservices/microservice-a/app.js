const express = require('express');
const axios = require('axios'); // Add this line
const app = express();
const port = 3000;
const cors = require('cors');

app.use(cors());

app.get('/', async (req, res) => {
  try {
    const response = await axios.get('http://microservice-b:4000/users'); // Notice the URL
    const users = response.data;
    const greeting = 'Hello from the Microservice! Users: ' + users.map(user => user.name).join(', ');
    res.send(greeting);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

app.listen(port, () => {
  console.log(`Microservice listening at http://localhost:${port}`);
});