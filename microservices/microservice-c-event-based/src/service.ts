import { EventEmitter } from "events";

export class HelloService {
    private eventEmitter: EventEmitter;
    
    constructor(eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
    }

    accessRoute(routeName: string): void{
        try {
            console.log(`Accessing route: ${routeName}`);
            this.eventEmitter.emit('routeAccess', routeName);
        }catch (error) {
            console.error('Error accessing route:', error);
        }
    }
}