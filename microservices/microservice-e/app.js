const express = require('express');
const amqplib = require('amqplib');

// rabitmq connection details
const amqpUrl = process.env.AMQP_URL || 'amqp://rabbitmq:5672';
const exchange = 'queue_task_exchange_1';
const queue = 'queue_task_1';
const routingKey = 'queue_task_key_1';
const tag = 'microservice_e_consumer_1';

const app = express();
const port = 6000;

let channel, connection;

async function connect() {
  try {
    console.log('Connecting to RabbitMQ');
    connection = await amqplib.connect(amqpUrl, 'heartbeat=60');
    channel = await connection.createChannel();
    channel.prefetch(10); // Process 10 message at a time
    
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
    return channel; 
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
  }
}

const processMessage = async (queue, message) =>{
    console.log(`Processing message from ${queue}:`, message);
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Finished processing message from ${queue}`);
}


const consumer = async (queueName) => {
  await channel.assertQueue(queueName, { durable: true });
  await channel.consume(queueName, async (msg) => {
    await processMessage(queue, msg.content.toString());
    await channel.ack(msg);
  },
  {
    noAck: false,
    consumerTag: tag
  });
  console.log(`Waiting for messages in ${queue}. To exit press CTRL+C`);
};

app.get('/consume', async (req, res) => {
  try {
    await consumer(queue);
    res.status(200).send(`Consuming messages from ${queue}`);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

app.listen(port, () => {
  connect();
  console.log(`Microservice E listening at http://localhost:${port}`);
});