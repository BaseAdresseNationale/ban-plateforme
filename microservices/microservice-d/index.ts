import amqplib from 'amqplib';
import express, { Request, Response } from 'express'

const app = express();
const amqpUrl = process.env.AMQP_URL || 'amqp://localhost:5672';

app.use(express.json());
const port = 5000;

connect();

app.get('/publish', (req, res) => {
    connect();
    res.send('Hello from microservice D');
});

app.get('*', (req: Request, res: Response) => {
    res.status(404).send('Not Found');
});

app.listen(port, () => {
    console.log(`Microservice D listening at http://localhost:${port}`);
});

async function connect() {
    console.log('Connecting to RabbitMQ');
    const connection = await amqplib.connect(amqpUrl, 'heartbeat=60');
    const channel = await connection.createChannel();
    console.log('Connected to RabbitMQ');
    try {

        // Ensure the exchange and queue exist
        const exchange = 'queue_task_exchange_1';
        const queue = 'queue_task_1';
        const routingKey = 'queue_task_key_1';

        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queue, { durable: true });
        await channel.bindQueue(queue, exchange, routingKey);

        const message = { text: 'Hello from microservice D' };
        channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
        console.log('Message published to queue:', message);
    } catch (error) {
        console.error('Error in publishing channel:', error);
    } finally {
        console.info('Closing channel and connection');
        channel.close();
        connection.close();
        console.info('Channel and connection closed');
    }
    process.exit(0);
};
