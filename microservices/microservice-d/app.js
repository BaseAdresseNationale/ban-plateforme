const express = require('express');
const amqplib = require('amqplib');

// rabitmq connection details
const amqpUrl = process.env.AMQP_URL || 'amqp://rabbitmq:5672';
const exchange = 'queue_task_exchange_1';
const queue = 'queue_task_1';
const routingKey = 'queue_task_key_1';

const app = express();
const port = 5000;

let channel, connection;

async function connect() {
  try {
    console.log('Connecting to RabbitMQ');
    connection = await amqplib.connect(amqpUrl, 'heartbeat=60');
    channel = await connection.createChannel();
    
    // Ensure the exchange and queue exist
    try {
      console.log('Asserting Exchange');
      await channel.assertExchange(exchange, 'direct', { durable: true });
    } catch (e) {
      console.error('Failed to assert exchange', e);
      // Try closing the connection and channel if they are set, but since we haven't created them, probably not.
    }

    try {
      console.log('Asserting Queue');
      await channel.assertQueue(queue, { durable: true });
    } catch (e) {
      console.error('Failed to assert queue', e);
    }
    
    try {
      console.log('Binding Queue to Exchange');
      await channel.bindQueue(queue, exchange, routingKey);
    } catch (e) {
        console.error('Failed to bind queue to exchange', e);
    }

    console.log('Connected to RabbitMQ');
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
  }
}

app.get('/publish', async (req, res) => {
  console.log('Received request to publish message');
  try {
    console.log('Publishing to queue');
    const message = { text: 'Hello from microservice D' };
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
    res.status(200).send('Message published to queue');
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

app.listen(port, () => {
  connect();
  console.log(`Microservice D listening at http://localhost:${port}`);
});