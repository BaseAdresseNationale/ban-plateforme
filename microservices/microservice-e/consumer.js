const amqplib = require('amqplib');
const amqpUrl = process.env.AMQP_URL || 'amqp://localhost:5672';

async function processMessage(queue, message) {
    console.log(`Processing message from ${queue}:`, message);
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Finished processing message from ${queue}`);
}

(async () => {
    
    const connection = await amqplib.connect(amqpUrl, 'heartbeat=60');
    const channel = await connection.createChannel();

    // const exchange = 'queue_task_exchange_1';
    const queue = 'queue_task_1';
    // const routingKey = 'queue_task_key_1';
    const tag = 'microservice_e_consumer_1';
    
    process.once('SIGINT', async () => {
        console.log('got sigint, Closing channel and connection');
        await channel.close();
        await connection.close();
        process.exit(0);
    });

    await channel.assertQueue(queue, { durable: true });
    await channel.consume(queue, async (msg) => {
        await processMessage(queue, msg.content.toString());
        await channel.ack(msg);
    },
        {
            noAck: false,
            consumerTag: tag
        });

    console.log(`Waiting for messages in ${queue}. To exit press CTRL+C`);
})();