import { EventEmitter } from "events";
export class HelloService {
    eventEmitter;
    constructor(eventEmitter) {
        this.eventEmitter = eventEmitter;
    }
    accessRoute(routeName) {
        try {
            console.log(`Accessing route: ${routeName}`);
            this.eventEmitter.emit('routeAccess', routeName);
        }
        catch (error) {
            console.error('Error accessing route:', error);
        }
    }
}
//# sourceMappingURL=service.js.map