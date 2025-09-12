import express, {} from 'express';
import { EventHandlers } from './events.js';
import { HelloService } from './service.js';
import { EventEmitter } from 'events';
const app = express();
const PORT = 8083;
// Initialize EventEmitter
const eventEmitter = new EventEmitter();
// Initialize services and event handlers
const helloService = new HelloService(eventEmitter);
const eventHandlers = new EventHandlers(eventEmitter);
eventHandlers.registerRouteEventHandlers();
app.get('/hello', (req, res) => {
    try {
        helloService.accessRoute('/hello');
        return res.status(200).json({ "message": 'Hello from Microservice C - Event Based!' });
    }
    catch (error) {
        console.error('Error in /hello route:', error);
        return res.status(500).json({ "error": "Internal Server Error" });
    }
});
app.listen(PORT, () => {
    console.log(`Microservice C - Event Based is running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map