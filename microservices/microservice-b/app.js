const express = require('express');
const app = express();
const port = 4000;
const cors = require('cors');

const corsOptions = {
  origin: '*',
  methods: ['POST', 'GET', 'PATCH', 'DELETE'],
}
app.use(cors(corsOptions));

app.get('/users', (req, res) => {
  // In a real scenario, fetch user data from a database
  const users = [
    { id: 1, name: 'User 1' },
    { id: 2, name: 'User 2' },
  ];
  res.json(users);
});
app.listen(port, () => {
  console.log(`User Management Microservice listening at http://localhost:${port}`);
});