const amqplib = require('amqplib');
const amqpUrl = process.env.AMQP_URL || 'amqp://localhost:5672';

(async () => {
    const connection = await amqplib.connect(amqpUrl, 'heartbeat=60');
    const channel = await connection.createChannel();
    
    try {
        console.log('Publishing to queue');
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
    }
    // finally {
    //     console.info('Closing channel and connection');
    //     channel.close();
    //     connection.close();
    //     console.info('Channel and connection closed');
    // }
    // process.exit(0);
})();
